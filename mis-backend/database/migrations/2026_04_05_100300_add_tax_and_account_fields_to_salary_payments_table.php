<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->decimal('tax_deducted', 14, 2)->default(0)->after('advance_deducted');
            $table->decimal('other_deductions', 14, 2)->default(0)->after('tax_deducted');
            $table->foreignId('account_id')->nullable()->after('status')->constrained('accounts')->nullOnDelete();
            $table->foreignId('account_transaction_id')->nullable()->after('account_id')->constrained('account_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('account_transaction_id');
            $table->dropConstrainedForeignId('account_id');
            $table->dropColumn(['tax_deducted', 'other_deductions']);
        });
    }
};
