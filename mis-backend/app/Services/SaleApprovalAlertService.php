<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\User;
use App\Notifications\SaleApprovalRequiredNotification;

class SaleApprovalAlertService
{
    public function notifyAdmins(ApartmentSale $sale): void
    {
        $admins = User::query()
            ->where('status', 'active')
            ->get()
            ->filter(fn (User $user): bool => $user->can('sales.approve'))
            ->values();

        if ($admins->isEmpty()) {
            return;
        }

        $notification = new SaleApprovalRequiredNotification($sale);
        foreach ($admins as $admin) {
            $admin->notify($notification);
        }
    }
}
