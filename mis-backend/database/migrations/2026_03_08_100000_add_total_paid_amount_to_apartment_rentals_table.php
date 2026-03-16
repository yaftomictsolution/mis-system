<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('apartment_rentals', function (Blueprint $table): void {
            $table->decimal('total_paid_amount', 14, 2)->default(0)->after('advance_remaining_amount');
        });

        DB::statement('
            UPDATE apartment_rentals r
            LEFT JOIN (
                SELECT rental_id, COALESCE(SUM(amount_paid), 0) AS total_paid
                FROM rental_payments
                GROUP BY rental_id
            ) p ON p.rental_id = r.id
            SET r.total_paid_amount = COALESCE(p.total_paid, 0)
        ');
    }

    public function down(): void
    {
        Schema::table('apartment_rentals', function (Blueprint $table): void {
            $table->dropColumn('total_paid_amount');
        });
    }
};

