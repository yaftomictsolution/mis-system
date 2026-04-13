<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_salary_histories', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->decimal('previous_salary', 14, 2)->nullable();
            $table->decimal('new_salary', 14, 2)->nullable();
            $table->date('effective_from')->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source', 50)->default('manual');
            $table->timestamps();

            $table->index(['employee_id', 'effective_from']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_salary_histories');
    }
};
