<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            if (! Schema::hasColumn('materials', 'reference_unit_price')) {
                $table->decimal('reference_unit_price', 14, 2)->nullable()->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table): void {
            if (Schema::hasColumn('materials', 'reference_unit_price')) {
                $table->dropColumn('reference_unit_price');
            }
        });
    }
};
