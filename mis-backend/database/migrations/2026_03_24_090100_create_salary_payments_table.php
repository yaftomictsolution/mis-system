<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_payments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->string('period', 100);
            $table->decimal('gross_salary', 14, 2);
            $table->decimal('advance_deducted', 14, 2)->default(0);
            $table->decimal('net_salary', 14, 2);
            $table->string('status', 50)->default('draft');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('paid_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['employee_id', 'status']);
            $table->index('period');
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_payments');
    }
};
