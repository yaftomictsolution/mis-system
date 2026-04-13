<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_transactions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained('accounts')->restrictOnDelete();
            $table->string('direction', 10);
            $table->decimal('amount', 14, 2);
            $table->string('module', 100)->nullable();
            $table->string('reference_type', 100)->nullable();
            $table->uuid('reference_uuid')->nullable();
            $table->text('description')->nullable();
            $table->string('payment_method', 50)->nullable();
            $table->dateTime('transaction_date');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('posted');
            $table->foreignId('reversal_of_id')->nullable()->constrained('account_transactions')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['account_id', 'transaction_date']);
            $table->index(['reference_type', 'reference_uuid']);
            $table->index(['module', 'status']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_transactions');
    }
};
