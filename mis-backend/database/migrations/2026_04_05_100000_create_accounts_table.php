<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name', 255)->unique();
            $table->string('account_type', 50)->default('office');
            $table->string('bank_name', 255)->nullable();
            $table->string('account_number', 100)->nullable();
            $table->string('currency', 10)->default('USD');
            $table->decimal('opening_balance', 14, 2)->default(0);
            $table->decimal('current_balance', 14, 2)->default(0);
            $table->string('status', 50)->default('active');
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['account_type', 'status']);
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
