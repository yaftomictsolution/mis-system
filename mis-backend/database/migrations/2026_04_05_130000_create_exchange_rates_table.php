<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exchange_rates', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('base_currency', 10)->default('USD');
            $table->string('quote_currency', 10)->default('AFN');
            $table->decimal('rate', 16, 6);
            $table->string('source', 20)->default('manual');
            $table->date('effective_date');
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['base_currency', 'quote_currency', 'is_active']);
            $table->index('effective_date');
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};
