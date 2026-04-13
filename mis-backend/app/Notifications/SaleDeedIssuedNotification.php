<?php

namespace App\Notifications;

use App\Models\ApartmentSale;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SaleDeedIssuedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ApartmentSale $sale,
        private readonly ?User $issuedBy = null,
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
            ->greeting('Hello ' . (trim((string) ($notifiable->full_name ?? $notifiable->name ?? 'Sales Officer')) ?: 'Sales Officer') . ',')
            ->line($payload['message'])
            ->line('Sale: ' . $payload['sale_id'])
            ->line('Customer: ' . $payload['customer_name'])
            ->line('Apartment: ' . $payload['apartment_label'])
            ->action('Open Sale History', $payload['action_url'])
            ->line('The sale deed workflow is now complete.');
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

        $issuedByName = trim((string) ($this->issuedBy?->full_name ?? $this->issuedBy?->name ?? ''));
        $frontendBase = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $actionUrl = $frontendBase . '/apartment-sales/' . $this->sale->uuid . '/history';

        return [
            'category' => 'sale_deed_issued',
            'title' => 'Deed Issued: ' . $saleId,
            'message' => $issuedByName !== ''
                ? "Ownership deed was issued by {$issuedByName}."
                : 'Ownership deed was issued for your apartment sale.',
            'sale_uuid' => (string) $this->sale->uuid,
            'sale_id' => $saleId,
            'customer_id' => (int) $this->sale->customer_id,
            'customer_name' => $customerName,
            'apartment_id' => (int) $this->sale->apartment_id,
            'apartment_label' => $apartmentLabel,
            'issued_by_user_id' => $this->issuedBy?->id,
            'issued_by_name' => $issuedByName !== '' ? $issuedByName : null,
            'action_url' => $actionUrl,
            'deed_issued_at' => $this->sale->deed_issued_at?->toISOString() ?? now()->toISOString(),
        ];
    }
}