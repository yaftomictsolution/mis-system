<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('installment_payments')) {
            Schema::create('installment_payments', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->foreignId('installment_id')->constrained('installments')->cascadeOnDelete();
                $table->decimal('amount', 15, 2);
                $table->timestamp('payment_date');
                $table->string('payment_method', 30)->default('cash');
                $table->string('reference_no', 100)->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('apartment_sale_possession_logs')) {
            Schema::create('apartment_sale_possession_logs', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->foreignId('apartment_sale_id')->constrained('apartment_sales')->cascadeOnDelete();
                $table->string('action', 30);
                $table->timestamp('action_date');
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->text('note')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('apartment_sale_possession_logs');
        Schema::dropIfExists('installment_payments');
    }
};

