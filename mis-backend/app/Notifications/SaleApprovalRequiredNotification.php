<?php

namespace App\Notifications;

use App\Models\ApartmentSale;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SaleApprovalRequiredNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ApartmentSale $sale
    ) {
    }

    public function via(object $notifiable): array
    {
        $hasEmail = trim((string) ($notifiable->email ?? '')) !== '';
        return $hasEmail ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payload = $this->payload();

        return (new MailMessage())
            ->subject($payload['title'])
            ->greeting('Hello ' . (trim((string) ($notifiable->full_name ?? 'Admin')) ?: 'Admin') . ',')
            ->line($payload['message'])
            ->line('Sale: ' . $payload['sale_id'])
            ->line('Customer: ' . $payload['customer_name'])
            ->line('Apartment: ' . $payload['apartment_label'])
            ->line('Net Price: $' . number_format((float) $payload['net_price'], 2))
            ->action('Review Sale', $payload['action_url'])
            ->line('Please review and approve this apartment sale before payments and municipality workflow continue.');
    }

    public function toArray(object $notifiable): array
    {
        return $this->payload();
    }

    private function payload(): array
    {
        $this->sale->loadMissing([
            'customer:id,name',
            'apartment:id,apartment_code,unit_number',
        ]);

        $saleId = trim((string) ($this->sale->sale_id ?? '')) ?: strtoupper(substr((string) $this->sale->uuid, 0, 8));
        $customerName = trim((string) ($this->sale->customer?->name ?? '')) ?: ('Customer #' . $this->sale->customer_id);
        $apartmentCode = trim((string) ($this->sale->apartment?->apartment_code ?? ''));
        $unitNo = trim((string) ($this->sale->apartment?->unit_number ?? ''));
        $apartmentLabel = $apartmentCode !== ''
            ? ($unitNo !== '' ? "{$apartmentCode} - Unit {$unitNo}" : $apartmentCode)
            : ('Apartment #' . $this->sale->apartment_id);

        $frontendBase = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $actionUrl = $frontendBase . '/apartment-sales?tab=pending-approval';

        return [
            'category' => 'sale_approval_required',
            'title' => 'Sale Approval Required: ' . $saleId,
            'message' => 'A new apartment sale was created and is waiting for admin approval.',
            'sale_uuid' => (string) $this->sale->uuid,
            'sale_id' => $saleId,
            'customer_id' => (int) $this->sale->customer_id,
            'customer_name' => $customerName,
            'apartment_id' => (int) $this->sale->apartment_id,
            'apartment_label' => $apartmentLabel,
            'payment_type' => trim((string) ($this->sale->payment_type ?? 'full')) ?: 'full',
            'net_price' => round((float) ($this->sale->net_price ?? 0), 2),
            'status' => trim((string) ($this->sale->status ?? 'pending')) ?: 'pending',
            'action_url' => $actionUrl,
            'requested_at' => now()->toISOString(),
        ];
    }
}
