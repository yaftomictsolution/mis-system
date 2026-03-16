<?php

namespace App\Services;

use App\Models\CrmMessage;
use App\Models\Installment;
use App\Models\RentalPayment;
use Carbon\CarbonImmutable;

class InstallmentReminderService
{
    public function __construct(private readonly CrmMessageSender $sender)
    {
    }

    /**
     * Send daily reminders for installments and rental bills due within N days.
     *
     * @return array{days:int,checked:int,installment_checked:int,rental_bill_checked:int,attempted:int,sent:int,failed:int,skipped:int}
     */
    public function sendDueSoonReminders(int $daysBeforeDue = 10): array
    {
        $daysBeforeDue = max(1, $daysBeforeDue);
        $today = CarbonImmutable::today();
        $until = $today->addDays($daysBeforeDue);

        $stats = [
            'days' => $daysBeforeDue,
            'checked' => 0,
            'installment_checked' => 0,
            'rental_bill_checked' => 0,
            'attempted' => 0,
            'sent' => 0,
            'failed' => 0,
            'skipped' => 0,
        ];

        $installments = Installment::query()
            ->with(['sale:id,uuid,sale_id,customer_id,status', 'sale.customer:id,name,email,phone'])
            ->whereDate('due_date', '>=', $today->toDateString())
            ->whereDate('due_date', '<=', $until->toDateString())
            ->whereRaw('paid_amount < amount')
            ->whereIn('status', ['pending', 'overdue'])
            ->orderBy('due_date')
            ->get();

        $stats['installment_checked'] = $installments->count();
        $stats['checked'] += $installments->count();

        foreach ($installments as $installment) {
            $sale = $installment->sale;
            $customer = $sale?->customer;
            if (!$sale || !$customer) {
                $stats['skipped'] += 1;
                continue;
            }

            $saleStatus = strtolower(trim((string) ($sale->status ?? '')));
            if (in_array($saleStatus, ['cancelled', 'terminated', 'defaulted'], true)) {
                $stats['skipped'] += 1;
                continue;
            }

            $dueDate = CarbonImmutable::parse((string) $installment->due_date);
            $daysLeft = $today->diffInDays($dueDate, false);
            if ($daysLeft < 0) {
                $stats['skipped'] += 1;
                continue;
            }

            $remaining = max(0, round((float) $installment->amount - (float) $installment->paid_amount, 2));
            $subject = sprintf(
                'Installment Reminder: %s day(s) left (Sale %s)',
                $daysLeft,
                (string) ($sale->sale_id ?? $sale->uuid)
            );
            $message = sprintf(
                "Dear %s, your installment #%d is due on %s. Remaining amount: $%0.2f. Please pay before due date.",
                (string) ($customer->name ?? 'Customer'),
                (int) $installment->installment_no,
                $dueDate->toDateString(),
                $remaining
            );

            foreach (['email', 'sms'] as $channel) {
                $alreadySentToday = CrmMessage::query()
                    ->where('installment_id', (int) $installment->id)
                    ->where('channel', $channel)
                    ->where('message_type', 'installment_due_reminder')
                    ->whereDate('created_at', $today->toDateString())
                    ->exists();

                if ($alreadySentToday) {
                    $stats['skipped'] += 1;
                    continue;
                }

                $stats['attempted'] += 1;
                $result = $this->sender->sendCustom($customer, $channel, $subject, $message);

                CrmMessage::query()->create([
                    'customer_id' => (int) $customer->id,
                    'installment_id' => (int) $installment->id,
                    'channel' => $channel,
                    'message_type' => 'installment_due_reminder',
                    'status' => $result['ok'] ? 'sent' : 'failed',
                    'sent_at' => $result['ok'] ? now() : null,
                    'error_message' => $result['ok'] ? null : ($result['error'] ?? 'Failed to send'),
                    'metadata' => [
                        'sale_uuid' => (string) $sale->uuid,
                        'sale_id' => (string) ($sale->sale_id ?? ''),
                        'installment_uuid' => (string) $installment->uuid,
                        'installment_no' => (int) $installment->installment_no,
                        'due_date' => $dueDate->toDateString(),
                        'days_left' => $daysLeft,
                        'remaining_amount' => $remaining,
                    ],
                ]);

                if ($result['ok']) {
                    $stats['sent'] += 1;
                } else {
                    $stats['failed'] += 1;
                }
            }
        }

        $rentalBills = RentalPayment::query()
            ->with([
                'rental:id,uuid,rental_id,tenant_id,status',
                'rental.tenant:id,name,email,phone',
            ])
            ->whereDate('due_date', '>=', $today->toDateString())
            ->whereDate('due_date', '<=', $until->toDateString())
            ->where('remaining_amount', '>', 0)
            ->whereIn('status', ['pending', 'partial', 'overdue'])
            ->orderBy('due_date')
            ->get();

        $stats['rental_bill_checked'] = $rentalBills->count();
        $stats['checked'] += $rentalBills->count();

        foreach ($rentalBills as $bill) {
            $rental = $bill->rental;
            $customer = $rental?->tenant;
            if (!$rental || !$customer) {
                $stats['skipped'] += 1;
                continue;
            }

            $rentalStatus = strtolower(trim((string) ($rental->status ?? '')));
            if (in_array($rentalStatus, ['completed', 'terminated', 'defaulted', 'cancelled'], true)) {
                $stats['skipped'] += 1;
                continue;
            }

            $dueDate = CarbonImmutable::parse((string) $bill->due_date);
            $daysLeft = $today->diffInDays($dueDate, false);
            if ($daysLeft < 0) {
                $stats['skipped'] += 1;
                continue;
            }

            $billNo = trim((string) ($bill->bill_no ?? '')) ?: strtoupper(substr((string) $bill->uuid, 0, 8));
            $rentalId = trim((string) ($rental->rental_id ?? '')) ?: strtoupper(substr((string) $rental->uuid, 0, 8));
            $remaining = max(0, round((float) ($bill->remaining_amount ?? 0), 2));

            $subject = sprintf('Rental Bill Reminder: %s day(s) left (Bill %s)', $daysLeft, $billNo);
            $message = sprintf(
                "Dear %s, your rental bill %s (rental %s) is due on %s. Remaining amount: $%0.2f. Please pay before due date.",
                (string) ($customer->name ?? 'Customer'),
                $billNo,
                $rentalId,
                $dueDate->toDateString(),
                $remaining
            );

            $alreadySentToday = CrmMessage::query()
                ->where('customer_id', (int) $customer->id)
                ->where('channel', 'email')
                ->where('message_type', 'rental_bill_due_reminder')
                ->whereDate('created_at', $today->toDateString())
                ->where('metadata->bill_uuid', (string) $bill->uuid)
                ->exists();

            if ($alreadySentToday) {
                $stats['skipped'] += 1;
                continue;
            }

            $stats['attempted'] += 1;
            $result = $this->sender->sendCustom($customer, 'email', $subject, $message);

            CrmMessage::query()->create([
                'customer_id' => (int) $customer->id,
                'installment_id' => null,
                'channel' => 'email',
                'message_type' => 'rental_bill_due_reminder',
                'status' => $result['ok'] ? 'sent' : 'failed',
                'sent_at' => $result['ok'] ? now() : null,
                'error_message' => $result['ok'] ? null : ($result['error'] ?? 'Failed to send'),
                'metadata' => [
                    'bill_uuid' => (string) $bill->uuid,
                    'bill_no' => $billNo,
                    'rental_uuid' => (string) $rental->uuid,
                    'rental_id' => $rentalId,
                    'due_date' => $dueDate->toDateString(),
                    'days_left' => $daysLeft,
                    'remaining_amount' => $remaining,
                ],
            ]);

            if ($result['ok']) {
                $stats['sent'] += 1;
            } else {
                $stats['failed'] += 1;
            }
        }

        return $stats;
    }
}
