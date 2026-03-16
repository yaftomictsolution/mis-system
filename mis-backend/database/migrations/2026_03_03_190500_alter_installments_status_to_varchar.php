<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('installments', 'status')) {
            return;
        }

        $driver = DB::getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement("ALTER TABLE installments MODIFY status VARCHAR(50) NOT NULL DEFAULT 'pending'");
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE installments ALTER COLUMN status TYPE VARCHAR(50)");
            DB::statement("ALTER TABLE installments ALTER COLUMN status SET DEFAULT 'pending'");
        }
    }

    public function down(): void
    {
        // Keep as VARCHAR to avoid losing rows with non-legacy statuses (e.g. cancelled).
    }
};

