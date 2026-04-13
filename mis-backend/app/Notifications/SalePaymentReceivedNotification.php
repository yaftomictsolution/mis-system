<?php

namespace App\Notifications;

use App\Models\ApartmentSale;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SalePaymentReceivedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ApartmentSale $sale,
        private readonly float $amount,
        private readonly int $installmentNo = 1,
        private readonly ?string $paymentMethod = null,
        private readonly ?User $receivedBy = null,
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
            ->line('Received Amount: $' . number_format((float) $payload['payment_amount'], 2))
            ->action('Open Sale Financials', $payload['action_url'])
            ->line('You can continue follow-up on the remaining payment workflow from the sale financial screen.');
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

        $paymentScope = strtolower(trim((string) ($this->sale->payment_type ?? ''))) === 'installment'
            ? 'installment #' . max(1, $this->installmentNo)
            : 'full payment';
        $receivedByName = trim((string) ($this->receivedBy?->full_name ?? $this->receivedBy?->name ?? ''));
        $frontendBase = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $actionUrl = $frontendBase . '/apartment-sales/' . $this->sale->uuid . '/financial';

        $message = 'A payment was received for your apartment sale.';
        if ($receivedByName !== '') {
            $message = "A {$paymentScope} payment of $" . number_format($this->amount, 2) . " was recorded by {$receivedByName}.";
        } else {
            $message = "A {$paymentScope} payment of $" . number_format($this->amount, 2) . " was recorded for your apartment sale.";
        }

        return [
            'category' => 'sale_payment_received',
            'title' => 'Payment Received: ' . $saleId,
            'message' => $message,
            'sale_uuid' => (string) $this->sale->uuid,
            'sale_id' => $saleId,
            'customer_id' => (int) $this->sale->customer_id,
            'customer_name' => $customerName,
            'apartment_id' => (int) $this->sale->apartment_id,
            'apartment_label' => $apartmentLabel,
            'payment_amount' => round($this->amount, 2),
            'payment_method' => $this->paymentMethod ? trim((string) $this->paymentMethod) : null,
            'installment_no' => max(1, $this->installmentNo),
            'received_by_user_id' => $this->receivedBy?->id,
            'received_by_name' => $receivedByName !== '' ? $receivedByName : null,
            'action_url' => $actionUrl,
            'received_at' => now()->toISOString(),
        ];
    }
}