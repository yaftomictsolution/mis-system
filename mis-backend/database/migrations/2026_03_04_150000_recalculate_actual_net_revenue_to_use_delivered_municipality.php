<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('apartment_sales') || !Schema::hasColumn('apartment_sales', 'actual_net_revenue')) {
            return;
        }

        $paidTotals = DB::table('installments')
            ->select('apartment_sale_id', DB::raw('COALESCE(SUM(paid_amount), 0) as paid_total'))
            ->groupBy('apartment_sale_id')
            ->pluck('paid_total', 'apartment_sale_id');

        $financials = DB::table('apartment_sale_financials')
            ->select([
                'apartment_sale_id',
                'delivered_to_municipality',
                'rahnama_fee_1',
                'discount_or_contractor_deduction',
            ])
            ->get()
            ->keyBy('apartment_sale_id');

        $terminations = DB::table('apartment_sale_terminations')
            ->select([
                'apartment_sale_id',
                'refund_amount',
            ])
            ->get()
            ->keyBy('apartment_sale_id');

        DB::table('apartment_sales')
            ->select(['id', 'payment_type', 'status', 'total_price', 'discount', 'net_price'])
            ->orderBy('id')
            ->chunkById(500, function ($sales) use ($paidTotals, $financials, $terminations): void {
                foreach ($sales as $sale) {
                    $netPrice = round((float) (($sale->net_price ?? ((float) $sale->total_price - (float) $sale->discount) ?? 0)), 2);
                    if ($netPrice < 0) {
                        $netPrice = 0;
                    }

                    $paidTotal = round((float) ($paidTotals[$sale->id] ?? 0), 2);
                    if ($paidTotal < 0) {
                        $paidTotal = 0;
                    }

                    $status = strtolower(trim((string) $sale->status));
                    $paymentType = strtolower(trim((string) $sale->payment_type));
                    $receivedFromCustomer = ($paymentType === 'full' && $status === 'completed') ? $netPrice : $paidTotal;

                    $financial = $financials->get($sale->id);
                    $deliveredToMunicipality = round((float) ($financial->delivered_to_municipality ?? 0), 2);
                    $rahnamaFee = round((float) ($financial->rahnama_fee_1 ?? 0), 2);
                    $discountOrDeduction = round((float) ($financial->discount_or_contractor_deduction ?? 0), 2);
                    $refundAmount = round((float) (($terminations->get($sale->id)->refund_amount ?? 0)), 2);

                    $actualNetRevenue = round(
                        $receivedFromCustomer
                        - $refundAmount
                        - $deliveredToMunicipality
                        - $rahnamaFee
                        - $discountOrDeduction,
                        2
                    );
                    if ($actualNetRevenue < 0) {
                        $actualNetRevenue = 0;
                    }

                    DB::table('apartment_sales')
                        ->where('id', $sale->id)
                        ->update(['actual_net_revenue' => $actualNetRevenue]);
                }
            });
    }

    public function down(): void
    {
        // No-op: recalculation migration.
    }
};

