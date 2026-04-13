<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('installment_payments', function (Blueprint $table): void {
            $table->foreignId('account_id')->nullable()->after('received_by')->constrained('accounts')->nullOnDelete();
            $table->foreignId('account_transaction_id')->nullable()->after('account_id')->constrained('account_transactions')->nullOnDelete();
            $table->string('payment_currency_code', 10)->nullable()->after('account_transaction_id');
            $table->decimal('exchange_rate_snapshot', 12, 6)->nullable()->after('payment_currency_code');
            $table->decimal('account_amount', 15, 2)->nullable()->after('exchange_rate_snapshot');
        });

        Schema::table('rental_payment_receipts', function (Blueprint $table): void {
            $table->foreignId('account_id')->nullable()->after('received_by')->constrained('accounts')->nullOnDelete();
            $table->foreignId('account_transaction_id')->nullable()->after('account_id')->constrained('account_transactions')->nullOnDelete();
            $table->string('payment_currency_code', 10)->nullable()->after('account_transaction_id');
            $table->decimal('exchange_rate_snapshot', 12, 6)->nullable()->after('payment_currency_code');
            $table->decimal('account_amount', 15, 2)->nullable()->after('exchange_rate_snapshot');
        });

        Schema::table('municipality_receipts', function (Blueprint $table): void {
            $table->foreignId('account_id')->nullable()->after('received_by')->constrained('accounts')->nullOnDelete();
            $table->foreignId('account_transaction_id')->nullable()->after('account_id')->constrained('account_transactions')->nullOnDelete();
            $table->string('payment_currency_code', 10)->nullable()->after('account_transaction_id');
            $table->decimal('exchange_rate_snapshot', 12, 6)->nullable()->after('payment_currency_code');
            $table->decimal('account_amount', 15, 2)->nullable()->after('exchange_rate_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('municipality_receipts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('account_transaction_id');
            $table->dropConstrainedForeignId('account_id');
            $table->dropColumn(['payment_currency_code', 'exchange_rate_snapshot', 'account_amount']);
        });

        Schema::table('rental_payment_receipts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('account_transaction_id');
            $table->dropConstrainedForeignId('account_id');
            $table->dropColumn(['payment_currency_code', 'exchange_rate_snapshot', 'account_amount']);
        });

        Schema::table('installment_payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('account_transaction_id');
            $table->dropConstrainedForeignId('account_id');
            $table->dropColumn(['payment_currency_code', 'exchange_rate_snapshot', 'account_amount']);
        });
    }
};
