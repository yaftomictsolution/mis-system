<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table): void {
            $table->string('request_type', 30)->default('material')->after('request_no');
        });

        Schema::table('purchase_request_items', function (Blueprint $table): void {
            $table->string('item_kind', 30)->default('material')->after('purchase_request_id');
            $table->foreignId('material_id')->nullable()->change();
            $table->string('asset_name')->nullable()->after('material_id');
            $table->string('asset_type', 50)->nullable()->after('asset_name');
            $table->string('asset_code_prefix', 50)->nullable()->after('asset_type');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_request_items', function (Blueprint $table): void {
            $table->dropColumn(['item_kind', 'asset_name', 'asset_type', 'asset_code_prefix']);
            $table->foreignId('material_id')->nullable(false)->change();
        });

        Schema::table('purchase_requests', function (Blueprint $table): void {
            $table->dropColumn('request_type');
        });
    }
};
