<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_requests', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('request_no')->unique();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->foreignId('requested_by_employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('requested_asset_id')->nullable()->constrained('company_assets')->nullOnDelete();
            $table->string('asset_type', 50)->nullable();
            $table->string('status', 40)->default('pending');
            $table->text('reason')->nullable();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('allocated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('allocated_at')->nullable();
            $table->string('allocation_receipt_no')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_requests');
    }
};
