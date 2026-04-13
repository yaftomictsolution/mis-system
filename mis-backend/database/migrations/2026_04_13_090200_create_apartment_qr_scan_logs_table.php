<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('apartment_qr_scan_logs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('apartment_qr_access_token_id')->nullable()->constrained('apartment_qr_access_tokens')->nullOnDelete();
            $table->foreignId('apartment_id')->nullable()->constrained('apartments')->nullOnDelete();
            $table->foreignId('apartment_sale_id')->nullable()->constrained('apartment_sales')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('scan_result', 30);
            $table->string('access_scope', 30)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('scanned_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apartment_qr_scan_logs');
    }
};