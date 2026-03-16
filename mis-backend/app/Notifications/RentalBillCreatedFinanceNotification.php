<?php

namespace App\Notifications;

use App\Models\ApartmentRental;
use App\Models\RentalPayment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RentalBillCreatedFinanceNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ApartmentRental $rental,
        private readonly RentalPayment $payment
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
            ->greeting('Hello ' . (trim((string) ($notifiable->full_name ?? 'Finance')) ?: 'Finance') . ',')
            ->line($payload['message'])
            ->line('Bill: ' . $payload['bill_no'])
            ->line('Rental: ' . $payload['rental_id'])
            ->line('Customer: ' . $payload['tenant_name'])
            ->line('Apartment: ' . $payload['apartment_label'])
            ->line('Payment Type: ' . $payload['payment_type'])
            ->line('Due Date: ' . $payload['due_date'])
            ->line('Amount Due: $' . number_format((float) $payload['amount_due'], 2))
            ->action('Open Rental Payments', $payload['action_url'])
            ->line('Please verify the customer bill and approve payment.');
    }

    public function toArray(object $notifiable): array
    {
        return $this->payload();
    }

    private function payload(): array
    {
        $this->rental->loadMissing([
            'tenant:id,name,phone,email',
            'apartment:id,apartment_code,unit_number',
        ]);

        $billNo = trim((string) ($this->payment->bill_no ?? '')) ?: strtoupper(substr((string) $this->payment->uuid, 0, 8));
        $rentalId = trim((string) ($this->rental->rental_id ?? '')) ?: strtoupper(substr((string) $this->rental->uuid, 0, 8));
        $tenantName = trim((string) ($this->rental->tenant?->name ?? '')) ?: ('Customer #' . $this->rental->tenant_id);

        $apartmentCode = trim((string) ($this->rental->apartment?->apartment_code ?? ''));
        $unitNo = trim((string) ($this->rental->apartment?->unit_number ?? ''));
        $apartmentLabel = $apartmentCode !== ''
            ? ($unitNo !== '' ? "{$apartmentCode} - Unit {$unitNo}" : $apartmentCode)
            : ('Apartment #' . $this->rental->apartment_id);

        $frontendBase = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $actionUrl = $frontendBase . '/rental-payments';

        return [
            'category' => 'rental_bill_created_finance',
            'title' => 'New Rental Bill: ' . $billNo,
            'message' => 'A customer rental bill was generated and is waiting for finance approval.',
            'rental_uuid' => (string) $this->rental->uuid,
            'rental_id' => $rentalId,
            'bill_uuid' => (string) $this->payment->uuid,
            'bill_no' => $billNo,
            'tenant_id' => (int) $this->rental->tenant_id,
            'tenant_name' => $tenantName,
            'apartment_id' => (int) $this->rental->apartment_id,
            'apartment_label' => $apartmentLabel,
            'payment_type' => (string) ($this->payment->payment_type ?? 'monthly'),
            'amount_due' => round((float) ($this->payment->amount_due ?? 0), 2),
            'due_date' => $this->payment->due_date?->toDateString(),
            'action_url' => $actionUrl,
            'created_at' => now()->toISOString(),
        ];
    }
}
