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
            $table->string('currency_code', 10)->default('USD')->after('amount');
        });

        DB::table('salary_advances')
            ->whereNull('currency_code')
            ->update(['currency_code' => 'USD']);
    }

    public function down(): void
    {
        Schema::table('salary_advances', function (Blueprint $table): void {
            $table->dropColumn('currency_code');
        });
    }
};
