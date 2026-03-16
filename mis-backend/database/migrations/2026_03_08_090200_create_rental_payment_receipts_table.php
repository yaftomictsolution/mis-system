<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rental_payment_receipts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('rental_payment_id')->nullable()->constrained('rental_payments')->nullOnDelete();
            $table->foreignId('rental_id')->constrained('apartment_rentals')->cascadeOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained('customers')->nullOnDelete();

            $table->string('receipt_no')->unique();
            $table->timestamp('payment_date');
            $table->decimal('amount', 14, 2);
            $table->string('payment_method')->default('cash'); // cash | bank | transfer | cheque
            $table->string('reference_no')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['rental_id', 'payment_date']);
            $table->index(['rental_payment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_payment_receipts');
    }
};

