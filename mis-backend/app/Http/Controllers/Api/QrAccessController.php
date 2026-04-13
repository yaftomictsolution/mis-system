<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Apartment;
use App\Models\ApartmentQrAccessToken;
use App\Models\ApartmentQrScanLog;
use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\User;
use App\Support\ApartmentSaleCustomerAmounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class QrAccessController extends Controller
{
    private const CUSTOMER_VISIBLE_SALE_STATUSES = [
        'pending',
        'approved',
        'active',
        'completed',
    ];

    private const STAFF_ROLES = [
        'Admin',
        'SalesOfficer',
        'ApartmentManager',
        'Accountant',
        'Auditor',
        'ProjectManager',
    ];

    private const STAFF_PERMISSIONS = [
        'apartments.view',
        'customers.view',
        'sales.create',
        'sales.approve',
        'accounts.view',
        'municipality.view',
    ];

    public function show(Request $request, string $token): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        $qrToken = ApartmentQrAccessToken::query()
            ->with('apartment')
            ->where('token', $token)
            ->where('status', 'active')
            ->first();

        if (! $qrToken || ! $qrToken->apartment) {
            $this->logScan($request, null, null, null, $user, 'invalid', null);

            return response()->json([
                'message' => 'QR code not found or inactive.',
            ], 404);
        }

        $apartment = $qrToken->apartment;
        $staffSale = $this->resolveSale($apartment->id);
        $customerSale = (int) ($user?->customer_id ?? 0) > 0
            ? $this->resolveSale($apartment->id, (int) $user->customer_id, true)
            : null;

        $accessScope = $this->resolveAccessScope($user, $customerSale);
        if ($accessScope === null) {
            $this->touchToken($qrToken);
            $this->logScan($request, $qrToken, $apartment, $staffSale, $user, 'denied', null);

            return response()->json([
                'message' => 'You are not allowed to view this apartment from QR access.',
            ], 403);
        }

        $sale = $accessScope === 'customer' ? $customerSale : $staffSale;
        $this->touchToken($qrToken);
        $this->logScan($request, $qrToken, $apartment, $sale, $user, 'allowed', $accessScope);

        return response()->json([
            'data' => [
                'access_scope' => $accessScope,
                'apartment' => $this->apartmentPayload($apartment, $qrToken),
                'sale' => $sale ? $this->salePayload($sale) : null,
                'customer' => $sale?->customer ? $this->customerPayload($sale->customer) : null,
                'financial' => $sale && in_array($accessScope, ['admin', 'sales'], true)
                    ? $this->financialPayload($sale->financial)
                    : null,
                'installments' => $sale ? $this->installmentPayloads($sale, $sale->installments) : [],
            ],
        ]);
    }

    private function resolveAccessScope(?User $user, ?ApartmentSale $customerSale): ?string
    {
        if (! $user) {
            return null;
        }

        if ($user->hasRole('Admin')) {
            return 'admin';
        }

        if ($this->isStaffUser($user)) {
            return 'sales';
        }

        if ((int) ($user->customer_id ?? 0) > 0 && $customerSale !== null) {
            return 'customer';
        }

        return null;
    }

    private function isStaffUser(User $user): bool
    {
        if ($user->hasAnyRole(self::STAFF_ROLES)) {
            return true;
        }

        $permissionNames = $user->getAllPermissions()->pluck('name')->values()->all();

        foreach (self::STAFF_PERMISSIONS as $permission) {
            if (in_array($permission, $permissionNames, true)) {
                return true;
            }
        }

        return false;
    }

    private function resolveSale(int $apartmentId, ?int $customerId = null, bool $strictCustomerScope = false): ?ApartmentSale
    {
        $baseQuery = ApartmentSale::query()
            ->with([
                'customer:id,uuid,name,phone,email',
                'financial:id,apartment_sale_id,municipality_share_15,delivered_to_municipality,remaining_municipality,company_share_85,delivered_to_company,customer_debt',
                'installments:id,uuid,apartment_sale_id,installment_no,amount,due_date,paid_amount,paid_date,status',
            ])
            ->where('apartment_id', $apartmentId)
            ->orderByDesc('sale_date')
            ->orderByDesc('id');

        if ($customerId !== null && $customerId > 0) {
            $baseQuery->where('customer_id', $customerId);
        }

        $preferred = (clone $baseQuery)
            ->whereIn('status', self::CUSTOMER_VISIBLE_SALE_STATUSES)
            ->first();

        if ($preferred) {
            return $preferred;
        }

        if ($strictCustomerScope) {
            return null;
        }

        return $baseQuery->first();
    }

    private function apartmentPayload(Apartment $apartment, ApartmentQrAccessToken $qrToken): array
    {
        return [
            'uuid' => $apartment->uuid,
            'apartment_code' => $apartment->apartment_code,
            'block_number' => $apartment->block_number,
            'unit_number' => $apartment->unit_number,
            'floor_number' => $apartment->floor_number,
            'status' => $apartment->status,
            'usage_type' => $apartment->usage_type,
            'area_sqm' => $apartment->area_sqm,
            'bedrooms' => $apartment->bedrooms,
            'halls' => $apartment->halls,
            'bathrooms' => $apartment->bathrooms,
            'kitchens' => $apartment->kitchens,
            'north_boundary' => $apartment->north_boundary,
            'south_boundary' => $apartment->south_boundary,
            'east_boundary' => $apartment->east_boundary,
            'west_boundary' => $apartment->west_boundary,
            'qr_status' => $qrToken->status,
            'qr_token' => $qrToken->token,
        ];
    }

    private function salePayload(ApartmentSale $sale): array
    {
        $paidTotal = ApartmentSaleCustomerAmounts::paidTotal($sale->installments);
        $netPrice = round((float) ($sale->net_price ?? 0), 2);
        $customerReceivable = ApartmentSaleCustomerAmounts::companyShare($sale);

        return [
            'uuid' => $sale->uuid,
            'sale_id' => $sale->sale_id,
            'sale_date' => optional($sale->sale_date)->toDateString(),
            'status' => $sale->status,
            'payment_type' => $sale->payment_type,
            'total_price' => round((float) ($sale->total_price ?? 0), 2),
            'discount' => round((float) ($sale->discount ?? 0), 2),
            'net_price' => $netPrice,
            'paid_total' => $paidTotal,
            'customer_remaining' => max(0, round($customerReceivable - $paidTotal, 2)),
            'approved_at' => optional($sale->approved_at)->toISOString(),
            'deed_status' => $sale->deed_status,
            'deed_issued_at' => optional($sale->deed_issued_at)->toISOString(),
            'key_handover_status' => $sale->key_handover_status,
            'key_handover_at' => optional($sale->key_handover_at)->toISOString(),
        ];
    }

    private function customerPayload(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'uuid' => $customer->uuid,
            'name' => $customer->name,
            'phone' => $customer->phone,
            'email' => $customer->email,
        ];
    }

    private function financialPayload(?ApartmentSaleFinancial $financial): ?array
    {
        if (! $financial) {
            return null;
        }

        return [
            'municipality_share_15' => round((float) ($financial->municipality_share_15 ?? 0), 2),
            'delivered_to_municipality' => round((float) ($financial->delivered_to_municipality ?? 0), 2),
            'remaining_municipality' => round((float) ($financial->remaining_municipality ?? 0), 2),
            'company_share_85' => round((float) ($financial->company_share_85 ?? 0), 2),
            'delivered_to_company' => round((float) ($financial->delivered_to_company ?? 0), 2),
            'customer_debt' => round((float) ($financial->customer_debt ?? 0), 2),
        ];
    }

    private function installmentPayloads(ApartmentSale $sale, Collection $installments): array
    {
        $scaledAmounts = ApartmentSaleCustomerAmounts::installmentAmounts($sale, $installments);

        return $installments
            ->sortBy('installment_no')
            ->values()
            ->map(function (Installment $installment) use ($scaledAmounts): array {
                $key = $installment->id ? 'id:' . $installment->id : (!empty($installment->uuid) ? 'uuid:' . $installment->uuid : null);
                $amount = $key && array_key_exists($key, $scaledAmounts)
                    ? round((float) $scaledAmounts[$key], 2)
                    : round((float) ($installment->amount ?? 0), 2);

                return [
                    'uuid' => $installment->uuid,
                    'installment_no' => (int) $installment->installment_no,
                    'amount' => $amount,
                    'paid_amount' => round((float) ($installment->paid_amount ?? 0), 2),
                    'remaining_amount' => max(0, round($amount - (float) ($installment->paid_amount ?? 0), 2)),
                    'status' => $installment->status,
                    'due_date' => optional($installment->due_date)->toDateString(),
                    'paid_date' => optional($installment->paid_date)->toDateString(),
                ];
            })
            ->all();
    }

    private function touchToken(ApartmentQrAccessToken $qrToken): void
    {
        $qrToken->forceFill([
            'last_scanned_at' => now(),
        ])->saveQuietly();
    }

    private function logScan(
        Request $request,
        ?ApartmentQrAccessToken $qrToken,
        ?Apartment $apartment,
        ?ApartmentSale $sale,
        ?User $user,
        string $result,
        ?string $accessScope,
    ): void {
        ApartmentQrScanLog::query()->create([
            'uuid' => (string) Str::uuid(),
            'apartment_qr_access_token_id' => $qrToken?->id,
            'apartment_id' => $apartment?->id,
            'apartment_sale_id' => $sale?->id,
            'user_id' => $user?->id,
            'scan_result' => $result,
            'access_scope' => $accessScope,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            'scanned_at' => now(),
        ]);
    }
}
