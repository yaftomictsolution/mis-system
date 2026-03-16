<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('apartment_rentals', function (Blueprint $table): void {
            if (Schema::hasColumn('apartment_rentals', 'security_deposit')) {
                $table->dropColumn('security_deposit');
            }
            if (Schema::hasColumn('apartment_rentals', 'grace_days')) {
                $table->dropColumn('grace_days');
            }
            if (Schema::hasColumn('apartment_rentals', 'late_fee_rule')) {
                $table->dropColumn('late_fee_rule');
            }
            if (Schema::hasColumn('apartment_rentals', 'payment_day')) {
                $table->dropColumn('payment_day');
            }
        });
    }

    public function down(): void
    {
        Schema::table('apartment_rentals', function (Blueprint $table): void {
            if (!Schema::hasColumn('apartment_rentals', 'security_deposit')) {
                $table->decimal('security_deposit', 14, 2)->default(0)->after('advance_status');
            }
            if (!Schema::hasColumn('apartment_rentals', 'grace_days')) {
                $table->unsignedSmallInteger('grace_days')->default(0)->after('security_deposit');
            }
            if (!Schema::hasColumn('apartment_rentals', 'late_fee_rule')) {
                $table->string('late_fee_rule')->nullable()->after('grace_days');
            }
            if (!Schema::hasColumn('apartment_rentals', 'payment_day')) {
                $table->unsignedTinyInteger('payment_day')->nullable()->after('late_fee_rule');
            }
        });
    }
};

