<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\User;
use App\Notifications\SaleApprovedNotification;

class SaleApprovedAlertService
{
    public function notifySalesOfficer(ApartmentSale $sale, ?User $approvedBy = null): void
    {
        $sale->loadMissing('user');

        /** @var User|null $salesOfficer */
        $salesOfficer = $sale->user;
        if (!$salesOfficer) {
            return;
        }

        if (strtolower(trim((string) ($salesOfficer->status ?? ''))) !== 'active') {
            return;
        }

        if ($approvedBy && (int) $approvedBy->id === (int) $salesOfficer->id) {
            return;
        }

        $salesOfficer->notify(new SaleApprovedNotification($sale, $approvedBy));
    }
}
