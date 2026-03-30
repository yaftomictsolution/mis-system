<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->string('material_type', 100)->nullable();
            $table->string('unit', 50);
            $table->decimal('quantity', 14, 2)->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->string('batch_no', 100)->nullable();
            $table->string('serial_no', 100)->nullable();
            $table->date('expiry_date')->nullable();
            $table->decimal('min_stock_level', 14, 2)->default(0);
            $table->string('status', 30)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materials');
    }
};
