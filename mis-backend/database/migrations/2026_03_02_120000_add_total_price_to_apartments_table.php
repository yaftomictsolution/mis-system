<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('apartments', 'total_price')) {
            Schema::table('apartments', function (Blueprint $table): void {
                $table->decimal('total_price', 15, 2)->default(0)->after('apartment_code');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('apartments', 'total_price')) {
            Schema::table('apartments', function (Blueprint $table): void {
                $table->dropColumn('total_price');
            });
        }
    }
};
