<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('apartment_sales', function (Blueprint $table): void {
            if (!Schema::hasColumn('apartment_sales', 'sale_id')) {
                $table->string('sale_id', 30)->nullable()->after('uuid');
            }
        });

        $rows = DB::table('apartment_sales')
            ->select('id', 'sale_id')
            ->orderBy('id')
            ->get();

        foreach ($rows as $row) {
            $current = trim((string) ($row->sale_id ?? ''));
            if ($current !== '') {
                continue;
            }

            $saleId = 'SAL-' . str_pad((string) $row->id, 6, '0', STR_PAD_LEFT);
            DB::table('apartment_sales')
                ->where('id', $row->id)
                ->update(['sale_id' => $saleId]);
        }

        Schema::table('apartment_sales', function (Blueprint $table): void {
            $table->unique('sale_id');
        });
    }

    public function down(): void
    {
        Schema::table('apartment_sales', function (Blueprint $table): void {
            $table->dropUnique(['sale_id']);
            $table->dropColumn('sale_id');
        });
    }
};

