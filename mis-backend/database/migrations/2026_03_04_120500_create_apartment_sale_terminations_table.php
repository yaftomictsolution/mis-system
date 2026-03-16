<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('apartment_sale_terminations')) {
            Schema::create('apartment_sale_terminations', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('apartment_sale_id')->unique()->constrained('apartment_sales')->cascadeOnDelete();
                $table->text('reason')->nullable();
                $table->decimal('termination_charge', 15, 2)->default(0);
                $table->decimal('refund_amount', 15, 2)->default(0);
                $table->decimal('remaining_debt_after_termination', 15, 2)->default(0);
                $table->timestamps();
            });
        }

        if (
            !Schema::hasTable('apartment_sales') ||
            !Schema::hasColumn('apartment_sales', 'termination_reason') ||
            !Schema::hasColumn('apartment_sales', 'termination_charge') ||
            !Schema::hasColumn('apartment_sales', 'refund_amount') ||
            !Schema::hasColumn('apartment_sales', 'remaining_debt_after_termination')
        ) {
            return;
        }

        $rows = DB::table('apartment_sales')
            ->select([
                'id',
                'termination_reason',
                'termination_charge',
                'refund_amount',
                'remaining_debt_after_termination',
                'created_at',
                'updated_at',
            ])
            ->whereNotNull('termination_reason')
            ->orWhere('termination_charge', '>', 0)
            ->orWhere('refund_amount', '>', 0)
            ->orWhere('remaining_debt_after_termination', '>', 0)
            ->orderBy('id')
            ->get();

        foreach ($rows as $row) {
            DB::table('apartment_sale_terminations')->updateOrInsert(
                ['apartment_sale_id' => (int) $row->id],
                [
                    'reason' => $row->termination_reason,
                    'termination_charge' => (float) ($row->termination_charge ?? 0),
                    'refund_amount' => (float) ($row->refund_amount ?? 0),
                    'remaining_debt_after_termination' => (float) ($row->remaining_debt_after_termination ?? 0),
                    'created_at' => $row->created_at ?? now(),
                    'updated_at' => $row->updated_at ?? now(),
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('apartment_sale_terminations');
    }
};

