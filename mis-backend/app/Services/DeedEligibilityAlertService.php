<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use App\Models\User;
use App\Notifications\SaleDeedEligibleNotification;
use Illuminate\Support\Facades\Notification;

class DeedEligibilityAlertService
{
    public function notifyAdmins(ApartmentSale $sale, ApartmentSaleFinancial $financial): void
    {
        $admins = User::query()
            ->where('status', 'active')
            ->get()
            ->filter(fn (User $user): bool => $user->can('sales.approve'));

        $notification = new SaleDeedEligibleNotification($sale, $financial);
        foreach ($admins as $admin) {
            $admin->notify($notification);
        }

        // Optional fallback recipients from env/config for guaranteed email delivery.
        $configuredRecipients = collect((array) config('app.deed_alert_emails', []))
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->filter(fn (string $email): bool => $email !== '')
            ->values();

        if ($configuredRecipients->isEmpty()) {
            return;
        }

        $adminEmails = $admins
            ->map(fn (User $user): string => strtolower(trim((string) ($user->email ?? ''))))
            ->filter(fn (string $email): bool => $email !== '')
            ->values()
            ->all();

        $dedupedRecipients = $configuredRecipients
            ->reject(fn (string $email): bool => in_array($email, $adminEmails, true))
            ->values();

        foreach ($dedupedRecipients as $email) {
            Notification::route('mail', $email)->notify($notification);
        }
    }
}
