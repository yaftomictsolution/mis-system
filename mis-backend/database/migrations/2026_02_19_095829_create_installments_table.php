<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('installments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('apartment_sale_id')->constrained()->cascadeOnDelete();

            $table->integer('installment_no');
            $table->decimal('amount', 15, 2);

            $table->date('due_date');

            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->date('paid_date')->nullable();

            $table->enum('status', ['pending', 'paid', 'overdue'])->default('pending');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('installments');
    }
};
