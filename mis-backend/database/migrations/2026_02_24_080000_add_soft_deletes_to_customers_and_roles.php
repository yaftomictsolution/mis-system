<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('customers', 'deleted_at')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->softDeletes();
                $table->index('deleted_at');
            });
        }

        if (!Schema::hasColumn('roles', 'deleted_at')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->softDeletes();
                $table->index('deleted_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('customers', 'deleted_at')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropIndex(['deleted_at']);
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('roles', 'deleted_at')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropIndex(['deleted_at']);
                $table->dropSoftDeletes();
            });
        }
    }
};