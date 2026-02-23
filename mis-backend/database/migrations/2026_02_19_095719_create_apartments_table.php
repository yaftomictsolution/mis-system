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
        Schema::create('apartments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->string('block_number');
            $table->string('unit_number');
            $table->string('floor_number')->nullable();

            $table->integer('bedrooms')->default(0);
            $table->integer('halls')->default(0);
            $table->integer('bathrooms')->default(0);
            $table->integer('kitchens')->default(0);

            $table->boolean('balcony')->default(false);
            $table->enum('sun_side', ['sun', 'shade'])->nullable();

            $table->enum('status', [
                'available',
                'sold',
                'rented',
                'company_use',
            ])->default('available');

            $table->timestamps();

            $table->index(['block_number', 'unit_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('apartments');
    }
};
