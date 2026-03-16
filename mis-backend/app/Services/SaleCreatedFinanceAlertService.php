<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\User;
use App\Notifications\SaleCreatedFinanceNotification;

class SaleCreatedFinanceAlertService
{
    public function notifyFinance(ApartmentSale $sale): void
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

        $notification = new SaleCreatedFinanceNotification($sale);
        foreach ($financeUsers as $financeUser) {
            $financeUser->notify($notification);
        }
    }
}

