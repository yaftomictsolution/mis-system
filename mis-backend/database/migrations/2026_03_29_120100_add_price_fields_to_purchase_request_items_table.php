<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_request_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('purchase_request_items', 'estimated_unit_price')) {
                $table->decimal('estimated_unit_price', 14, 2)->nullable()->after('quantity_received');
            }
            if (! Schema::hasColumn('purchase_request_items', 'estimated_line_total')) {
                $table->decimal('estimated_line_total', 14, 2)->nullable()->after('estimated_unit_price');
            }
            if (! Schema::hasColumn('purchase_request_items', 'actual_unit_price')) {
                $table->decimal('actual_unit_price', 14, 2)->nullable()->after('estimated_line_total');
            }
            if (! Schema::hasColumn('purchase_request_items', 'actual_line_total')) {
                $table->decimal('actual_line_total', 14, 2)->nullable()->after('actual_unit_price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_request_items', function (Blueprint $table): void {
            $drop = [];
            foreach (['estimated_unit_price', 'estimated_line_total', 'actual_unit_price', 'actual_line_total'] as $column) {
                if (Schema::hasColumn('purchase_request_items', $column)) {
                    $drop[] = $column;
                }
            }
            if ($drop !== []) {
                $table->dropColumn($drop);
            }
        });
    }
};
