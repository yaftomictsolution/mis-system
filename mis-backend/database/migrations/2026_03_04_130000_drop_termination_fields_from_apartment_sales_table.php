<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('apartment_sales')) {
            return;
        }

        $dropColumns = [];
        foreach ([
            'termination_reason',
            'termination_charge',
            'refund_amount',
            'remaining_debt_after_termination',
        ] as $column) {
            if (Schema::hasColumn('apartment_sales', $column)) {
                $dropColumns[] = $column;
            }
        }

        if (empty($dropColumns)) {
            return;
        }

        Schema::table('apartment_sales', function (Blueprint $table) use ($dropColumns): void {
            $table->dropColumn($dropColumns);
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('apartment_sales')) {
            return;
        }

        $hasReason = Schema::hasColumn('apartment_sales', 'termination_reason');
        $hasCharge = Schema::hasColumn('apartment_sales', 'termination_charge');
        $hasRefund = Schema::hasColumn('apartment_sales', 'refund_amount');
        $hasDebt = Schema::hasColumn('apartment_sales', 'remaining_debt_after_termination');

        if ($hasReason && $hasCharge && $hasRefund && $hasDebt) {
            return;
        }

        Schema::table('apartment_sales', function (Blueprint $table) use ($hasReason, $hasCharge, $hasRefund, $hasDebt): void {
            if (!$hasReason) {
                $table->text('termination_reason')->nullable()->after('key_returned_by');
            }
            if (!$hasCharge) {
                $table->decimal('termination_charge', 15, 2)->default(0)->after('termination_reason');
            }
            if (!$hasRefund) {
                $table->decimal('refund_amount', 15, 2)->default(0)->after('termination_charge');
            }
            if (!$hasDebt) {
                $table->decimal('remaining_debt_after_termination', 15, 2)->default(0)->after('refund_amount');
            }
        });
    }
};

