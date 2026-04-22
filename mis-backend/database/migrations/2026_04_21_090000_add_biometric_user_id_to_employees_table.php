<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('employees', 'biometric_user_id')) {
            return;
        }

        Schema::table('employees', function (Blueprint $table): void {
            $table->string('biometric_user_id')->nullable()->unique()->after('last_name');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('employees', 'biometric_user_id')) {
            return;
        }

        Schema::table('employees', function (Blueprint $table): void {
            $table->dropColumn('biometric_user_id');
        });
    }
};
