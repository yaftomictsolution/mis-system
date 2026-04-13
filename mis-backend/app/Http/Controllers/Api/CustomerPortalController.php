<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApartmentSale;
use App\Models\Installment;
use App\Support\ApartmentSaleCustomerAmounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerPortalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $customerId = (int) ($user?->customer_id ?? 0);

        if ($customerId <= 0) {
            return response()->json([
                'message' => 'This account is not linked to a customer portal profile.',
            ], 403);
        }

        $sales = ApartmentSale::query()
            ->with([
                'customer:id,uuid,name,phone,email',
                'apartment:id,uuid,apartment_code,block_number,unit_number,floor_number,status,usage_type,area_sqm',
                'apartment.qrAccessToken:id,apartment_id,token,status',
                'financial:id,apartment_sale_id,municipality_share_15,remaining_municipality,company_share_85,customer_debt',
                'installments:id,apartment_sale_id,installment_no,amount,paid_amount,status,due_date,paid_date',
            ])
            ->where('customer_id', $customerId)
            ->whereIn('status', ['pending', 'approved', 'active', 'completed'])
            ->orderByDesc('sale_date')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $sales->map(fn (ApartmentSale $sale): array => $this->payload($sale))->values()->all(),
        ]);
    }

    private function payload(ApartmentSale $sale): array
    {
        $paidTotal = ApartmentSaleCustomerAmounts::paidTotal($sale->installments);
        $netPrice = round((float) ($sale->net_price ?? 0), 2);
        $customerReceivable = ApartmentSaleCustomerAmounts::companyShare($sale);
        $remainingAmount = max(0, round($customerReceivable - $paidTotal, 2));
        $scaledAmounts = ApartmentSaleCustomerAmounts::installmentAmounts($sale, $sale->installments);

        return [
            'sale' => [
                'uuid' => $sale->uuid,
                'sale_id' => $sale->sale_id,
                'sale_date' => optional($sale->sale_date)->toDateString(),
                'status' => $sale->status,
                'payment_type' => $sale->payment_type,
                'total_price' => round((float) ($sale->total_price ?? 0), 2),
                'discount' => round((float) ($sale->discount ?? 0), 2),
                'net_price' => $netPrice,
                'paid_total' => $paidTotal,
                'remaining_amount' => $remainingAmount,
                'deed_status' => $sale->deed_status,
                'key_handover_status' => $sale->key_handover_status,
            ],
            'apartment' => [
                'uuid' => $sale->apartment?->uuid,
                'apartment_code' => $sale->apartment?->apartment_code,
                'block_number' => $sale->apartment?->block_number,
                'unit_number' => $sale->apartment?->unit_number,
                'floor_number' => $sale->apartment?->floor_number,
                'status' => $sale->apartment?->status,
                'usage_type' => $sale->apartment?->usage_type,
                'area_sqm' => $sale->apartment?->area_sqm,
                'qr_access_token' => $sale->apartment?->qrAccessToken?->status === 'active'
                    ? $sale->apartment?->qrAccessToken?->token
                    : null,
            ],
            'financial' => [
                'municipality_share_15' => round((float) ($sale->financial?->municipality_share_15 ?? 0), 2),
                'remaining_municipality' => round((float) ($sale->financial?->remaining_municipality ?? 0), 2),
                'customer_debt' => round((float) ($sale->financial?->customer_debt ?? $remainingAmount), 2),
            ],
            'installments' => $sale->installments
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
                ->all(),
        ];
    }
}
