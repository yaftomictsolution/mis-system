<?php

namespace App\Notifications;

use App\Models\ApartmentSale;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SaleApprovedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ApartmentSale $sale,
        private readonly ?User $approvedBy = null,
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
            ->line('Net Price: $' . number_format((float) $payload['net_price'], 2))
            ->action('Open Sale Workflow', $payload['action_url'])
            ->line('You can now continue payment and follow-up workflow for this sale.');
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

        $approverName = trim((string) ($this->approvedBy?->full_name ?? $this->approvedBy?->name ?? ''));
        $frontendBase = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $actionUrl = $frontendBase . '/apartment-sales/' . $this->sale->uuid . '/financial';

        return [
            'category' => 'sale_approved',
            'title' => 'Sale Approved: ' . $saleId,
            'message' => $approverName !== ''
                ? "Your apartment sale was approved by {$approverName}. You can continue the next workflow."
                : 'Your apartment sale was approved. You can continue the next workflow.',
            'sale_uuid' => (string) $this->sale->uuid,
            'sale_id' => $saleId,
            'customer_id' => (int) $this->sale->customer_id,
            'customer_name' => $customerName,
            'apartment_id' => (int) $this->sale->apartment_id,
            'apartment_label' => $apartmentLabel,
            'net_price' => round((float) ($this->sale->net_price ?? 0), 2),
            'approved_by_user_id' => $this->approvedBy?->id,
            'approved_by_name' => $approverName !== '' ? $approverName : null,
            'action_url' => $actionUrl,
            'approved_at' => $this->sale->approved_at?->toISOString() ?? now()->toISOString(),
        ];
    }
}
