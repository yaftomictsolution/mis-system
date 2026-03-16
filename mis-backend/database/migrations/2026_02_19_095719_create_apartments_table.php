<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('apartments', function (Blueprint $table) {
      $table->id();
      $table->uuid('uuid')->unique();
      // آي دي آپارتمان/دوکان
      $table->string('apartment_code')->unique(); // e.g. A-101, S-12
      // رهایشی/تجارتی
      $table->string('usage_type'); // residential | commercial
      // basic
      $table->string('block_number')->nullable();
      $table->string('unit_number');     // نمبر آپارتمان/دوکان
      $table->string('floor_number')->nullable();
      // layout
      $table->unsignedInteger('bedrooms')->default(0);
      $table->unsignedInteger('halls')->default(0);
      $table->unsignedInteger('bathrooms')->default(0);
      $table->unsignedInteger('kitchens')->default(0);
      $table->boolean('balcony')->default(false);
      // متراژ + شکل + دهلیز
      $table->decimal('area_sqm', 10, 2)->nullable();
      $table->string('apartment_shape')->nullable();
      $table->string('corridor')->nullable();
      // وضعیت فعلی
      $table->string('status')->default('available'); // available | sold | rented | company_use
      $table->string('qr_code')->nullable();
      $table->text('additional_info')->nullable();

      $table->timestamps();
    });
  }

  public function down(): void {
    Schema::dropIfExists('apartments');
  }
};