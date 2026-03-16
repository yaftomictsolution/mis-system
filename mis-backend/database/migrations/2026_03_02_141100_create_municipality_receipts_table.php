<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('municipality_receipts')) {
            Schema::create('municipality_receipts', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->foreignId('apartment_sale_id')->constrained('apartment_sales')->cascadeOnDelete();
                $table->string('receipt_no', 50)->unique();
                $table->date('payment_date');
                $table->decimal('amount', 15, 2);
                $table->string('payment_method', 30)->default('cash');
                $table->text('notes')->nullable();
                $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('municipality_receipts');
    }
};

