<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rental_payments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('rental_id')->constrained('apartment_rentals')->cascadeOnDelete();
            $table->string('period_month')->nullable();
            $table->date('due_date')->nullable();

            $table->string('payment_type')->default('monthly'); // advance | monthly | late_fee | adjustment
            $table->decimal('amount_due', 14, 2)->default(0);
            $table->decimal('amount_paid', 14, 2)->default(0);
            $table->decimal('remaining_amount', 14, 2)->default(0);

            $table->timestamp('paid_date')->nullable();
            $table->string('status')->default('pending'); // pending | partial | paid | late | waived | cancelled
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['rental_id', 'status']);
            $table->index(['rental_id', 'due_date']);
            $table->index(['payment_type', 'status']);
            $table->index(['period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_payments');
    }
};

