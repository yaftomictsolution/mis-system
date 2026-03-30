<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('material_id');
            $table->unsignedBigInteger('warehouse_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('employee_id')->nullable();
            $table->unsignedBigInteger('material_request_item_id')->nullable();
            $table->decimal('quantity', 12, 2);
            $table->string('movement_type', 50);
            $table->string('reference_type', 50)->nullable();
            $table->string('reference_no', 100)->nullable();
            $table->unsignedBigInteger('approved_by_user_id')->nullable();
            $table->unsignedBigInteger('issued_by_user_id')->nullable();
            $table->dateTime('movement_date');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['material_id', 'movement_date']);
            $table->index(['warehouse_id', 'movement_date']);
            $table->index(['project_id', 'movement_date']);
            $table->index(['movement_type', 'movement_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
