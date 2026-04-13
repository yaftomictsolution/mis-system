<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_advances', function (Blueprint $table): void {
            $table->decimal('deducted_amount', 14, 2)->default(0)->after('amount');
            $table->decimal('remaining_amount', 14, 2)->default(0)->after('deducted_amount');
        });

        DB::table('salary_advances')->update([
            'deducted_amount' => DB::raw("CASE WHEN status = 'deducted' THEN amount ELSE 0 END"),
            'remaining_amount' => DB::raw("CASE WHEN status = 'deducted' THEN 0 ELSE amount END"),
        ]);
    }

    public function down(): void
    {
        Schema::table('salary_advances', function (Blueprint $table): void {
            $table->dropColumn(['deducted_amount', 'remaining_amount']);
        });
    }
};
