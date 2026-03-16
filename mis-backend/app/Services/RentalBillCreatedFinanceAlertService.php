<?php

namespace App\Services;

use App\Models\ApartmentRental;
use App\Models\RentalPayment;
use App\Models\User;
use App\Notifications\RentalBillCreatedFinanceNotification;

class RentalBillCreatedFinanceAlertService
{
    public function notifyFinance(ApartmentRental $rental, RentalPayment $payment): void
    {
        $financeUsers = User::query()
            ->where('status', 'active')
            ->get()
            ->filter(function (User $user): bool {
                return
                    $user->can('installments.pay') ||
                    $user->can('municipality.record_receipt') ||
                    $user->hasRole('Accountant');
            })
            ->values();

        if ($financeUsers->isEmpty()) {
            return;
        }

        $notification = new RentalBillCreatedFinanceNotification($rental, $payment);
        foreach ($financeUsers as $financeUser) {
            $financeUser->notify($notification);
        }
    }
}
