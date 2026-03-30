<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_assignments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('asset_id')->constrained('company_assets')->cascadeOnDelete();
            $table->foreignId('asset_request_id')->nullable()->constrained('asset_requests')->nullOnDelete();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->date('assigned_date');
            $table->date('return_date')->nullable();
            $table->string('status', 40)->default('active');
            $table->string('condition_on_issue', 255)->nullable();
            $table->string('condition_on_return', 255)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_assignments');
    }
};
