<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->decimal('tax_percentage', 5, 2)->default(0)->after('advance_deducted');
        });
    }

    public function down(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->dropColumn('tax_percentage');
        });
    }
};
