<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_assets', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('asset_code')->unique();
            $table->string('asset_name');
            $table->string('asset_type', 50);
            $table->foreignId('supplier_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->string('serial_no', 100)->nullable();
            $table->string('status', 30)->default('available');
            $table->unsignedBigInteger('current_employee_id')->nullable();
            $table->unsignedBigInteger('current_project_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('current_employee_id')->references('id')->on('employees')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_assets');
    }
};
