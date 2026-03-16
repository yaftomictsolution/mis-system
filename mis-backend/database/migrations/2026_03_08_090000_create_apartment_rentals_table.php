<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('apartment_rentals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('rental_id')->unique();

            $table->foreignId('apartment_id')->constrained('apartments');
            $table->foreignId('tenant_id')->constrained('customers');
            $table->foreignId('created_by')->nullable()->constrained('users');

            $table->date('contract_start');
            $table->date('contract_end')->nullable();

            $table->decimal('monthly_rent', 14, 2)->default(0);
            $table->unsignedInteger('advance_months')->default(3);
            $table->decimal('advance_required_amount', 14, 2)->default(0);
            $table->decimal('advance_paid_amount', 14, 2)->default(0);
            $table->decimal('advance_remaining_amount', 14, 2)->default(0);
            $table->string('advance_status')->default('pending');

            $table->decimal('security_deposit', 14, 2)->default(0);
            $table->unsignedSmallInteger('grace_days')->default(0);
            $table->string('late_fee_rule')->nullable();
            $table->unsignedTinyInteger('payment_day')->nullable();
            $table->date('next_due_date')->nullable();

            $table->string('status')->default('draft');
            $table->string('key_handover_status')->default('not_handed_over');
            $table->timestamp('key_handover_at')->nullable();
            $table->foreignId('key_handover_by')->nullable()->constrained('users');
            $table->timestamp('key_returned_at')->nullable();
            $table->foreignId('key_returned_by')->nullable()->constrained('users');

            $table->text('termination_reason')->nullable();
            $table->timestamp('terminated_at')->nullable();

            $table->timestamps();

            $table->index(['apartment_id', 'status']);
            $table->index(['tenant_id', 'status']);
            $table->index(['status', 'next_due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apartment_rentals');
    }
};

