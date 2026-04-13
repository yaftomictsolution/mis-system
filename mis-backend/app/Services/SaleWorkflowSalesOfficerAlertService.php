<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\User;
use App\Notifications\SaleDeedIssuedNotification;
use App\Notifications\SalePaymentReceivedNotification;
use App\Notifications\SaleRejectedNotification;

class SaleWorkflowSalesOfficerAlertService
{
    public function notifyRejected(ApartmentSale $sale, ?User $actor = null): void
    {
        $salesOfficer = $this->resolveSalesOfficer($sale, $actor);
        if (!$salesOfficer) {
            return;
        }

        $salesOfficer->notify(new SaleRejectedNotification($sale, $actor));
    }

    public function notifyDeedIssued(ApartmentSale $sale, ?User $actor = null): void
    {
        $salesOfficer = $this->resolveSalesOfficer($sale, $actor);
        if (!$salesOfficer) {
            return;
        }

        $salesOfficer->notify(new SaleDeedIssuedNotification($sale, $actor));
    }

    public function notifyPaymentReceived(
        ApartmentSale $sale,
        float $amount,
        int $installmentNo = 1,
        ?User $actor = null,
        ?string $paymentMethod = null,
    ): void {
        $salesOfficer = $this->resolveSalesOfficer($sale, $actor);
        if (!$salesOfficer) {
            return;
        }

        $salesOfficer->notify(new SalePaymentReceivedNotification(
            sale: $sale,
            amount: $amount,
            installmentNo: $installmentNo,
            paymentMethod: $paymentMethod,
            receivedBy: $actor,
        ));
    }

    private function resolveSalesOfficer(ApartmentSale $sale, ?User $actor = null): ?User
    {
        $sale->loadMissing('user');

        /** @var User|null $salesOfficer */
        $salesOfficer = $sale->user;
        if (!$salesOfficer) {
            return null;
        }

        if (strtolower(trim((string) ($salesOfficer->status ?? ''))) !== 'active') {
            return null;
        }

        if ($actor && (int) $actor->id === (int) $salesOfficer->id) {
            return null;
        }

        return $salesOfficer;
    }
}