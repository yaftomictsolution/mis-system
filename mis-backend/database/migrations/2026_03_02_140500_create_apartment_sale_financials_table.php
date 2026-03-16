<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('apartment_sale_financials')) {
            Schema::create('apartment_sale_financials', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->foreignId('apartment_sale_id')->unique()->constrained('apartment_sales')->cascadeOnDelete();
                $table->string('accounts_status', 100)->default('open');
                $table->decimal('municipality_share_15', 15, 2)->default(0);
                $table->decimal('delivered_to_municipality', 15, 2)->default(0);
                $table->decimal('remaining_municipality', 15, 2)->default(0);
                $table->decimal('company_share_85', 15, 2)->default(0);
                $table->decimal('delivered_to_company', 15, 2)->default(0);
                $table->decimal('rahnama_fee_1', 15, 2)->default(0);
                $table->decimal('customer_debt', 15, 2)->default(0);
                $table->decimal('discount_or_contractor_deduction', 15, 2)->default(0);
                $table->timestamps();
            });
        }

        $sales = DB::table('apartment_sales')
            ->select('id', 'uuid', 'payment_type', 'status', 'total_price', 'discount', 'net_price')
            ->orderBy('id')
            ->get();

        foreach ($sales as $sale) {
            $exists = DB::table('apartment_sale_financials')
                ->where('apartment_sale_id', $sale->id)
                ->exists();

            if ($exists) {
                continue;
            }

            $netPrice = max(0, round((float) ($sale->net_price ?? ((float) $sale->total_price - (float) $sale->discount)), 2));
            $municipalityShare = round($netPrice * 0.15, 2);
            $companyShare = round($netPrice * 0.85, 2);
            $paidTotal = round((float) DB::table('installments')->where('apartment_sale_id', $sale->id)->sum('paid_amount'), 2);
            $effectivePaid = ($sale->payment_type === 'full' && $sale->status === 'completed') ? $netPrice : $paidTotal;
            $customerDebt = max(0, round($netPrice - $effectivePaid, 2));

            DB::table('apartment_sale_financials')->insert([
                'uuid' => $sale->uuid,
                'apartment_sale_id' => $sale->id,
                'accounts_status' => $customerDebt <= 0 && $municipalityShare <= 0 ? 'settled' : ($paidTotal > 0 ? 'partial' : 'open'),
                'municipality_share_15' => $municipalityShare,
                'delivered_to_municipality' => 0,
                'remaining_municipality' => $municipalityShare,
                'company_share_85' => $companyShare,
                'delivered_to_company' => 0,
                'rahnama_fee_1' => round($netPrice * 0.01, 2),
                'customer_debt' => $customerDebt,
                'discount_or_contractor_deduction' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('apartment_sale_financials');
    }
};

