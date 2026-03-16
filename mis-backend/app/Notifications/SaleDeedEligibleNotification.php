<?php

namespace App\Notifications;

use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SaleDeedEligibleNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ApartmentSale $sale,
        private readonly ApartmentSaleFinancial $financial
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
            ->line('Customer Debt: $' . number_format((float) $payload['customer_debt'], 2))
            ->line('Remaining Municipality: $' . number_format((float) $payload['remaining_municipality'], 2))
            ->action('Open Sale', $payload['action_url'])
            ->line('Please review and issue the ownership deed.');
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
        $actionUrl = $frontendBase . '/apartment-sales/' . $this->sale->uuid . '/financial';

        return [
            'category' => 'sale_deed_eligible',
            'title' => 'Deed Approval Required: ' . $saleId,
            'message' => 'Customer installments and municipality share are fully settled. Deed approval is now required.',
            'sale_uuid' => (string) $this->sale->uuid,
            'sale_id' => $saleId,
            'customer_id' => (int) $this->sale->customer_id,
            'customer_name' => $customerName,
            'apartment_id' => (int) $this->sale->apartment_id,
            'apartment_label' => $apartmentLabel,
            'customer_debt' => round((float) ($this->financial->customer_debt ?? 0), 2),
            'remaining_municipality' => round((float) ($this->financial->remaining_municipality ?? 0), 2),
            'action_url' => $actionUrl,
            'eligible_at' => now()->toISOString(),
        ];
    }
}

