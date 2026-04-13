<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->string('salary_currency_code', 10)->default('USD')->after('gross_salary');
            $table->decimal('salary_exchange_rate_snapshot', 14, 6)->nullable()->after('salary_currency_code');
            $table->decimal('gross_salary_usd', 14, 2)->nullable()->after('gross_salary');
            $table->decimal('advance_deducted_usd', 14, 2)->nullable()->after('advance_deducted');
            $table->decimal('tax_deducted_usd', 14, 2)->nullable()->after('tax_deducted');
            $table->decimal('other_deductions_usd', 14, 2)->nullable()->after('other_deductions');
            $table->decimal('net_salary_usd', 14, 2)->nullable()->after('net_salary');
        });

        DB::table('salary_payments')->update([
            'salary_currency_code' => DB::raw("COALESCE(salary_currency_code, 'USD')"),
            'salary_exchange_rate_snapshot' => DB::raw('COALESCE(salary_exchange_rate_snapshot, 1)'),
            'gross_salary_usd' => DB::raw('COALESCE(gross_salary_usd, gross_salary)'),
            'advance_deducted_usd' => DB::raw('COALESCE(advance_deducted_usd, advance_deducted)'),
            'tax_deducted_usd' => DB::raw('COALESCE(tax_deducted_usd, tax_deducted)'),
            'other_deductions_usd' => DB::raw('COALESCE(other_deductions_usd, other_deductions)'),
            'net_salary_usd' => DB::raw('COALESCE(net_salary_usd, net_salary)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->dropColumn([
                'salary_currency_code',
                'salary_exchange_rate_snapshot',
                'gross_salary_usd',
                'advance_deducted_usd',
                'tax_deducted_usd',
                'other_deductions_usd',
                'net_salary_usd',
            ]);
        });
    }
};
