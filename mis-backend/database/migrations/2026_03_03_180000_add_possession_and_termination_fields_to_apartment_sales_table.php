<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('apartment_sales', function (Blueprint $table): void {
            if (!Schema::hasColumn('apartment_sales', 'key_handover_status')) {
                $table->string('key_handover_status', 30)->default('not_handed_over')->after('deed_issued_by');
            }
            if (!Schema::hasColumn('apartment_sales', 'key_handover_at')) {
                $table->timestamp('key_handover_at')->nullable()->after('key_handover_status');
            }
            if (!Schema::hasColumn('apartment_sales', 'key_handover_by')) {
                $table->foreignId('key_handover_by')->nullable()->after('key_handover_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('apartment_sales', 'possession_start_date')) {
                $table->date('possession_start_date')->nullable()->after('key_handover_by');
            }
            if (!Schema::hasColumn('apartment_sales', 'vacated_at')) {
                $table->date('vacated_at')->nullable()->after('possession_start_date');
            }
            if (!Schema::hasColumn('apartment_sales', 'key_returned_at')) {
                $table->timestamp('key_returned_at')->nullable()->after('vacated_at');
            }
            if (!Schema::hasColumn('apartment_sales', 'key_returned_by')) {
                $table->foreignId('key_returned_by')->nullable()->after('key_returned_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('apartment_sales', 'termination_reason')) {
                $table->text('termination_reason')->nullable()->after('key_returned_by');
            }
            if (!Schema::hasColumn('apartment_sales', 'termination_charge')) {
                $table->decimal('termination_charge', 15, 2)->default(0)->after('termination_reason');
            }
            if (!Schema::hasColumn('apartment_sales', 'refund_amount')) {
                $table->decimal('refund_amount', 15, 2)->default(0)->after('termination_charge');
            }
            if (!Schema::hasColumn('apartment_sales', 'remaining_debt_after_termination')) {
                $table->decimal('remaining_debt_after_termination', 15, 2)->default(0)->after('refund_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('apartment_sales', function (Blueprint $table): void {
            if (Schema::hasColumn('apartment_sales', 'key_returned_by')) {
                $table->dropConstrainedForeignId('key_returned_by');
            }
            if (Schema::hasColumn('apartment_sales', 'key_handover_by')) {
                $table->dropConstrainedForeignId('key_handover_by');
            }

            $columns = [
                'key_handover_status',
                'key_handover_at',
                'possession_start_date',
                'vacated_at',
                'key_returned_at',
                'termination_reason',
                'termination_charge',
                'refund_amount',
                'remaining_debt_after_termination',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('apartment_sales', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

