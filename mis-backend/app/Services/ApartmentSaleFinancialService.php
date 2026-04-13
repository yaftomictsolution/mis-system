<?php

namespace App\Services;

use App\Models\ApartmentSale;
use App\Models\Apartment;
use App\Models\ApartmentSaleFinancial;
use App\Models\ApartmentRental;
use App\Support\ApartmentSaleCustomerAmounts;
use Illuminate\Support\Facades\DB;

class ApartmentSaleFinancialService
{
    public function __construct(
        private readonly DeedEligibilityAlertService $alerts
    ) {
    }

    public function recalculateForSale(ApartmentSale $sale, array $overrides = []): ApartmentSaleFinancial
    {
        $sale->loadMissing('termination');
        $financial = ApartmentSaleFinancial::query()
            ->where('apartment_sale_id', $sale->id)
            ->first();

        if (!$financial) {
            $financial = new ApartmentSaleFinancial();
            $financial->uuid = (string) $sale->uuid;
            $financial->apartment_sale_id = (int) $sale->id;
        }

        $netPrice = ApartmentSaleCustomerAmounts::netPrice($sale);
        $municipalityShare15 = ApartmentSaleCustomerAmounts::municipalityShare($sale);
        $companyShare85 = ApartmentSaleCustomerAmounts::companyShare($sale);

        $discountOrDeduction = array_key_exists('discount_or_contractor_deduction', $overrides)
            ? $this->toMoney($overrides['discount_or_contractor_deduction'])
            : $this->toMoney($financial->discount_or_contractor_deduction ?? 0);

        $deliveredToMunicipalityRaw = array_key_exists('delivered_to_municipality', $overrides)
            ? $this->toMoney($overrides['delivered_to_municipality'])
            : $this->toMoney($financial->delivered_to_municipality ?? 0);
        $deliveredToMunicipality = min($deliveredToMunicipalityRaw, $municipalityShare15);

        $deliveredToCompanyRaw = array_key_exists('delivered_to_company', $overrides)
            ? $this->toMoney($overrides['delivered_to_company'])
            : $this->toMoney($financial->delivered_to_company ?? 0);
        $deliveredToCompany = min($deliveredToCompanyRaw, $companyShare85);

        $remainingMunicipality = $this->toMoney(max(0, $municipalityShare15 - $deliveredToMunicipality));

        $rahnamaFee1 = array_key_exists('rahnama_fee_1', $overrides)
            ? $this->toMoney($overrides['rahnama_fee_1'])
            : $this->toMoney($financial->rahnama_fee_1 ?? ($netPrice * 0.01));

        $installments = $sale->installments()->get();
        $paidTotal = ApartmentSaleCustomerAmounts::paidTotal($installments);
        $hasInstallmentRows = $sale->installments()->exists();
        $status = strtolower(trim((string) $sale->status));
        $effectivePaid = (!$hasInstallmentRows && $sale->payment_type === 'full' && $status === 'completed')
            ? $companyShare85
            : $paidTotal;
        $customerDebt = $this->toMoney(max(0, $companyShare85 - $effectivePaid - $discountOrDeduction));

        $accountsStatus = $this->resolveAccountsStatus(
            $financial,
            $overrides,
            $customerDebt,
            $remainingMunicipality,
            $deliveredToMunicipality,
            $deliveredToCompany
        );

        $financial->uuid = (string) $sale->uuid;
        $financial->apartment_sale_id = (int) $sale->id;
        $financial->accounts_status = $accountsStatus;
        $financial->municipality_share_15 = $municipalityShare15;
        $financial->delivered_to_municipality = $deliveredToMunicipality;
        $financial->remaining_municipality = $remainingMunicipality;
        $financial->company_share_85 = $companyShare85;
        $financial->delivered_to_company = $deliveredToCompany;
        $financial->rahnama_fee_1 = $rahnamaFee1;
        $financial->customer_debt = $customerDebt;
        $financial->discount_or_contractor_deduction = $discountOrDeduction;
        $financial->save();

        $this->syncActualNetRevenue($sale, $financial, $netPrice, $paidTotal, $status);
        $this->syncDeedEligibility($sale, $financial);
        $this->syncApartmentStatus($sale);

        return $financial;
    }

    private function toMoney($value): float
    {
        $n = (float) $value;
        if (!is_finite($n) || $n < 0) {
            return 0.0;
        }
        return round($n, 2);
    }

    private function resolveAccountsStatus(
        ApartmentSaleFinancial $financial,
        array $overrides,
        float $customerDebt,
        float $remainingMunicipality,
        float $deliveredToMunicipality,
        float $deliveredToCompany
    ): string {
        if (array_key_exists('accounts_status', $overrides)) {
            $status = trim((string) $overrides['accounts_status']);
            return $status !== '' ? mb_substr($status, 0, 100) : 'open';
        }

        $existing = trim((string) ($financial->accounts_status ?? ''));
        if ($existing !== '') {
            return mb_substr($existing, 0, 100);
        }

        if ($customerDebt <= 0 && $remainingMunicipality <= 0) {
            return 'settled';
        }

        if ($deliveredToMunicipality > 0 || $deliveredToCompany > 0) {
            return 'partial';
        }

        return 'open';
    }

    private function syncApartmentStatus(ApartmentSale $sale): void
    {
        $this->refreshApartmentStatusForApartment((int) $sale->apartment_id);
    }

    public function refreshApartmentStatusForApartment(int $apartmentId): void
    {
        if ($apartmentId <= 0) {
            return;
        }

        $apartment = Apartment::query()->find($apartmentId);
        if (!$apartment) {
            return;
        }

        $activeSale = ApartmentSale::query()
            ->where('apartment_id', $apartmentId)
            ->whereNotIn('status', ['cancelled', 'terminated', 'defaulted'])
            ->orderByDesc('updated_at')
            ->first();

        $openRental = ApartmentRental::query()
            ->where('apartment_id', $apartmentId)
            ->whereIn('status', ['draft', 'advance_pending', 'active'])
            ->orderByDesc('updated_at')
            ->first();

        $targetStatus = 'available';

        if ($activeSale) {
            $deedStatus = strtolower(trim((string) ($activeSale->deed_status ?? 'not_issued')));
            $handoverStatus = strtolower(trim((string) ($activeSale->key_handover_status ?? 'not_handed_over')));

            if ($deedStatus === 'issued') {
                $targetStatus = 'sold';
            } elseif ($handoverStatus === 'handed_over') {
                $targetStatus = 'handed_over';
            } else {
                $targetStatus = 'reserved';
            }
        } elseif ($openRental) {
            $targetStatus = strtolower(trim((string) $openRental->status)) === 'active'
                ? 'rented'
                : 'reserved';
        }

        if ((string) $apartment->status !== $targetStatus) {
            $apartment->status = $targetStatus;
            $apartment->save();
        }
    }

    private function syncDeedEligibility(ApartmentSale $sale, ApartmentSaleFinancial $financial): void
    {
        $current = strtolower(trim((string) ($sale->deed_status ?? 'not_issued')));
        if ($current === 'issued') {
            return;
        }

        $status = strtolower(trim((string) $sale->status));
        $installments = $sale->relationLoaded('installments') ? $sale->installments : $sale->installments()->get();
        $hasUnpaidInstallment = ApartmentSaleCustomerAmounts::hasUnpaidInstallments($sale, $installments);
        $eligible =
            $status === 'completed' &&
            !$hasUnpaidInstallment &&
            (float) $financial->customer_debt <= 0.0001 &&
            (float) $financial->remaining_municipality <= 0.0001;

        $next = $eligible ? 'eligible' : 'not_issued';
        if ($next !== $current) {
            $sale->deed_status = $next;
            $sale->save();

            if ($next === 'eligible') {
                $saleId = (int) $sale->id;
                DB::afterCommit(function () use ($saleId): void {
                    $freshSale = ApartmentSale::query()
                        ->with([
                            'financial',
                            'customer:id,name',
                            'apartment:id,apartment_code,unit_number',
                        ])
                        ->find($saleId);

                    if (!$freshSale || !$freshSale->financial) {
                        return;
                    }

                    $this->alerts->notifyAdmins($freshSale, $freshSale->financial);
                });
            }
        }
    }

    private function syncActualNetRevenue(
        ApartmentSale $sale,
        ApartmentSaleFinancial $financial,
        float $netPrice,
        float $paidTotal,
        string $status
    ): void {
        $refundAmount = $this->toMoney($sale->termination?->refund_amount ?? 0);
        $hasInstallmentRows = $sale->installments()->exists();
        $receivedFromCustomer = (!$hasInstallmentRows && $sale->payment_type === 'full' && $status === 'completed')
            ? ApartmentSaleCustomerAmounts::companyShare($sale)
            : $paidTotal;
        $deliveredToMunicipality = $this->toMoney($financial->delivered_to_municipality ?? 0);

        $actualNetRevenue = round(
            $receivedFromCustomer
            - $refundAmount
            - $deliveredToMunicipality
            - $this->toMoney($financial->rahnama_fee_1 ?? 0)
            - $this->toMoney($financial->discount_or_contractor_deduction ?? 0),
            2
        );
        $actualNetRevenue = max(0, $actualNetRevenue);

        if ((float) $sale->actual_net_revenue !== $actualNetRevenue) {
            $sale->actual_net_revenue = $actualNetRevenue;
            $sale->save();
        }
    }
}
