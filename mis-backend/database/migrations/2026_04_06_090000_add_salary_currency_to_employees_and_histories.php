<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table): void {
            $table->string('salary_currency_code', 10)->default('USD')->after('base_salary');
        });

        Schema::table('employee_salary_histories', function (Blueprint $table): void {
            $table->string('previous_salary_currency_code', 10)->nullable()->after('previous_salary');
            $table->string('new_salary_currency_code', 10)->nullable()->after('new_salary');
        });

        DB::table('employees')
            ->whereNull('salary_currency_code')
            ->update(['salary_currency_code' => 'USD']);

        DB::table('employee_salary_histories')
            ->whereNull('new_salary_currency_code')
            ->update(['new_salary_currency_code' => 'USD']);

        DB::table('employee_salary_histories')
            ->whereNotNull('previous_salary')
            ->whereNull('previous_salary_currency_code')
            ->update(['previous_salary_currency_code' => 'USD']);
    }

    public function down(): void
    {
        Schema::table('employee_salary_histories', function (Blueprint $table): void {
            $table->dropColumn(['previous_salary_currency_code', 'new_salary_currency_code']);
        });

        Schema::table('employees', function (Blueprint $table): void {
            $table->dropColumn('salary_currency_code');
        });
    }
};
