<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('apartments', function (Blueprint $table): void {
            $table->string('north_boundary')->nullable()->after('corridor');
            $table->string('south_boundary')->nullable()->after('north_boundary');
            $table->string('east_boundary')->nullable()->after('south_boundary');
            $table->string('west_boundary')->nullable()->after('east_boundary');
        });
    }

    public function down(): void
    {
        Schema::table('apartments', function (Blueprint $table): void {
            $table->dropColumn([
                'north_boundary',
                'south_boundary',
                'east_boundary',
                'west_boundary',
            ]);
        });
    }
};
