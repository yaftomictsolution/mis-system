<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('municipality_payment_letters')) {
            Schema::create('municipality_payment_letters', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->foreignId('apartment_sale_id')->unique()->constrained('apartment_sales')->cascadeOnDelete();
                $table->string('letter_no', 50)->unique();
                $table->timestamp('issued_at');
                $table->decimal('municipality_share_amount', 15, 2)->default(0);
                $table->decimal('remaining_municipality', 15, 2)->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('municipality_payment_letters');
    }
};

