<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_advance_deductions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('salary_payment_id')->constrained('salary_payments')->cascadeOnDelete();
            $table->foreignId('salary_advance_id')->constrained('salary_advances')->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['salary_payment_id', 'deleted_at']);
            $table->index(['salary_advance_id', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advance_deductions');
    }
};
