<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('account_transactions', function (Blueprint $table): void {
            $table->string('currency_code', 10)->default('USD')->after('amount');
            $table->decimal('exchange_rate_snapshot', 16, 6)->nullable()->after('currency_code');
            $table->decimal('amount_usd', 14, 2)->nullable()->after('exchange_rate_snapshot');
        });

        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->string('payment_currency_code', 10)->nullable()->after('account_transaction_id');
            $table->decimal('exchange_rate_snapshot', 16, 6)->nullable()->after('payment_currency_code');
            $table->decimal('net_salary_account_amount', 14, 2)->nullable()->after('exchange_rate_snapshot');
        });

        DB::table('account_transactions')
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $currency = strtoupper((string) (DB::table('accounts')->where('id', $row->account_id)->value('currency') ?? 'USD'));
                    DB::table('account_transactions')
                        ->where('id', $row->id)
                        ->update([
                            'currency_code' => $currency,
                            'exchange_rate_snapshot' => $currency === 'USD' ? 1 : null,
                            'amount_usd' => $currency === 'USD' ? $row->amount : null,
                        ]);
                }
            });

        DB::table('salary_payments')
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $currency = $row->account_id
                        ? strtoupper((string) (DB::table('accounts')->where('id', $row->account_id)->value('currency') ?? 'USD'))
                        : 'USD';

                    DB::table('salary_payments')
                        ->where('id', $row->id)
                        ->update([
                            'payment_currency_code' => $currency,
                            'exchange_rate_snapshot' => $currency === 'USD' ? 1 : null,
                            'net_salary_account_amount' => $currency === 'USD' ? $row->net_salary : null,
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->dropColumn(['payment_currency_code', 'exchange_rate_snapshot', 'net_salary_account_amount']);
        });

        Schema::table('account_transactions', function (Blueprint $table): void {
            $table->dropColumn(['currency_code', 'exchange_rate_snapshot', 'amount_usd']);
        });
    }
};
