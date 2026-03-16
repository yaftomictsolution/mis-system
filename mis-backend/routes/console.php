<?php

use App\Models\ApartmentSale;
use App\Models\CrmMessage;
use App\Models\Customer;
use App\Models\User;
use App\Notifications\SaleDeedEligibleNotification;
use App\Services\ApartmentSaleFinancialService;
use App\Services\CrmMessageSender;
use App\Services\DeedEligibilityAlertService;
use App\Services\InstallmentReminderService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('deed-alert:verify {saleUuid?} {--send : Send notification/email to admins when eligible}', function (?string $saleUuid = null) {
    $this->line('Checking deed-eligibility alert workflow...');

    $admins = User::query()
        ->where('status', 'active')
        ->get()
        ->filter(fn (User $user): bool => $user->can('sales.approve'))
        ->values();

    $this->info('Active admin approvers: ' . $admins->count());
    if ($admins->isEmpty()) {
        $this->warn('No active user has "sales.approve". Alerts cannot be delivered.');
    }

    if (!$saleUuid) {
        $candidate = ApartmentSale::query()
            ->where('deed_status', 'eligible')
            ->where('status', 'completed')
            ->latest('updated_at')
            ->first();

        if ($candidate) {
            $saleUuid = (string) $candidate->uuid;
            $this->line('Using latest eligible sale: ' . $saleUuid);
        }
    }

    if (!$saleUuid) {
        $this->warn('No sale UUID provided and no eligible sale found. Usage: php artisan deed-alert:verify {saleUuid}');
        return self::SUCCESS;
    }

    $sale = ApartmentSale::query()
        ->with(['financial', 'customer:id,name', 'apartment:id,apartment_code,unit_number'])
        ->where('uuid', $saleUuid)
        ->first();

    if (!$sale) {
        $this->error('Sale not found for UUID: ' . $saleUuid);
        return self::FAILURE;
    }

    /** @var ApartmentSaleFinancialService $financials */
    $financials = app(ApartmentSaleFinancialService::class);
    $financial = $financials->recalculateForSale($sale);
    $sale = $sale->fresh();

    $hasUnpaidInstallment = $sale->installments()->whereRaw('paid_amount < amount')->exists();
    $eligible =
        strtolower(trim((string) $sale->status)) === 'completed' &&
        strtolower(trim((string) ($sale->deed_status ?? 'not_issued'))) === 'eligible' &&
        !$hasUnpaidInstallment &&
        (float) ($financial->customer_debt ?? 0) <= 0.0001 &&
        (float) ($financial->remaining_municipality ?? 0) <= 0.0001;

    $this->table(
        ['Field', 'Value'],
        [
            ['Sale UUID', (string) $sale->uuid],
            ['Sale ID', (string) ($sale->sale_id ?? '-')],
            ['Sale Status', (string) ($sale->status ?? '-')],
            ['Deed Status', (string) ($sale->deed_status ?? '-')],
            ['Customer Debt', number_format((float) ($financial->customer_debt ?? 0), 2)],
            ['Remaining Municipality', number_format((float) ($financial->remaining_municipality ?? 0), 2)],
            ['Has Unpaid Installment', $hasUnpaidInstallment ? 'yes' : 'no'],
            ['Eligible', $eligible ? 'yes' : 'no'],
        ]
    );

    if ($this->option('send')) {
        if (!$eligible) {
            $this->warn('Alert not sent because sale is not currently eligible.');
            return self::SUCCESS;
        }

        /** @var DeedEligibilityAlertService $alerts */
        $alerts = app(DeedEligibilityAlertService::class);
        $alerts->notifyAdmins($sale->fresh(['customer:id,name', 'apartment:id,apartment_code,unit_number']), $financial->fresh());
        $this->info('Deed-eligible alerts sent to admin approvers.');
    } else {
        $this->line('Dry run only. Use --send to dispatch notification/email.');
    }

    foreach ($admins as $admin) {
        $count = $admin->unreadNotifications()->where('type', SaleDeedEligibleNotification::class)->count();
        $this->line('- ' . ($admin->full_name ?: $admin->email ?: ('User#' . $admin->id)) . ': unread deed alerts = ' . $count);
    }

    return self::SUCCESS;
})->purpose('Verify deed-eligibility alert logic and optionally send admin alerts.');

Artisan::command('crm:send-installment-reminders {--days=10 : Days before due date}', function () {
    $days = max(1, (int) $this->option('days'));

    /** @var InstallmentReminderService $service */
    $service = app(InstallmentReminderService::class);
    $stats = $service->sendDueSoonReminders($days);

    $this->table(
        ['Metric', 'Value'],
        [
            ['Days Before Due', (string) $stats['days']],
            ['Total Records Checked', (string) $stats['checked']],
            ['Installments Checked', (string) ($stats['installment_checked'] ?? 0)],
            ['Rental Bills Checked', (string) ($stats['rental_bill_checked'] ?? 0)],
            ['Messages Attempted', (string) $stats['attempted']],
            ['Messages Sent', (string) $stats['sent']],
            ['Messages Failed', (string) $stats['failed']],
            ['Skipped', (string) $stats['skipped']],
        ]
    );

    return self::SUCCESS;
})->purpose('Send daily installment and rental-bill reminders through CRM.');

Artisan::command('crm:test-message {--customer_id= : Customer ID (optional)} {--channel=sms : sms or email} {--message_type=test_manual : Message type label} {--message= : Custom message body}', function () {
    $channel = strtolower(trim((string) $this->option('channel')));
    if (!in_array($channel, ['sms', 'email'], true)) {
        $this->error('Invalid channel. Use --channel=sms or --channel=email');
        return self::FAILURE;
    }

    $customerId = (int) ($this->option('customer_id') ?? 0);
    $customer = $customerId > 0
        ? Customer::query()->find($customerId)
        : Customer::query()->whereNotNull('phone')->orderBy('id')->first();

    if (!$customer) {
        $this->error('No customer found. Pass --customer_id or create a customer with phone/email first.');
        return self::FAILURE;
    }

    $messageType = trim((string) $this->option('message_type')) ?: 'test_manual';
    $customMessage = trim((string) $this->option('message'));
    $subject = 'MIS CRM Test Message';
    $body = $customMessage !== ''
        ? $customMessage
        : "Test {$channel} from MIS CRM. If you received this, {$channel} is working.";

    /** @var CrmMessageSender $sender */
    $sender = app(CrmMessageSender::class);
    $result = $sender->sendCustom($customer, $channel, $subject, $body);

    $crm = CrmMessage::query()->create([
        'customer_id' => (int) $customer->id,
        'channel' => $channel,
        'message_type' => $messageType,
        'status' => $result['ok'] ? 'sent' : 'failed',
        'sent_at' => $result['ok'] ? now() : null,
        'error_message' => $result['ok'] ? null : ($result['error'] ?? 'Failed to send'),
        'metadata' => [
            'source' => 'crm:test-message',
            'customer_name' => (string) ($customer->name ?? ''),
            'customer_phone' => (string) ($customer->phone ?? ''),
            'customer_email' => (string) ($customer->email ?? ''),
        ],
    ]);

    $this->table(
        ['Field', 'Value'],
        [
            ['CRM Row ID', (string) $crm->id],
            ['Customer ID', (string) $customer->id],
            ['Customer Name', (string) ($customer->name ?? '-')],
            ['Channel', $channel],
            ['Status', $result['ok'] ? 'sent' : 'failed'],
            ['Error', $result['ok'] ? '-' : (string) ($result['error'] ?? 'Unknown error')],
        ]
    );

    return $result['ok'] ? self::SUCCESS : self::FAILURE;
})->purpose('Send one test CRM message (sms/email) and log result in crm_messages.');


