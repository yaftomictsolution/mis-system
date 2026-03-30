<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_requests', function (Blueprint $table): void {
            $table->decimal('quantity_requested', 14, 2)->default(1)->after('asset_type');
            $table->decimal('quantity_allocated', 14, 2)->default(0)->after('quantity_requested');
        });

        Schema::table('asset_assignments', function (Blueprint $table): void {
            $table->decimal('quantity_assigned', 14, 2)->default(1)->after('employee_id');
        });
    }

    public function down(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table): void {
            $table->dropColumn('quantity_assigned');
        });

        Schema::table('asset_requests', function (Blueprint $table): void {
            $table->dropColumn(['quantity_requested', 'quantity_allocated']);
        });
    }
};
