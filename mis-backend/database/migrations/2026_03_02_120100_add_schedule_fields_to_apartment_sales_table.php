<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('apartment_sales', 'status')) {
            $driver = DB::getDriverName();
            if ($driver === 'mysql' || $driver === 'mariadb') {
                DB::statement("ALTER TABLE apartment_sales MODIFY status VARCHAR(50) NOT NULL DEFAULT 'active'");
            } elseif ($driver === 'pgsql') {
                DB::statement("ALTER TABLE apartment_sales ALTER COLUMN status TYPE VARCHAR(50)");
                DB::statement("ALTER TABLE apartment_sales ALTER COLUMN status SET DEFAULT 'active'");
            }
        }

        if (!Schema::hasColumn('apartment_sales', 'frequency_type')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->string('frequency_type')->nullable()->after('payment_type');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'interval_count')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->unsignedInteger('interval_count')->default(1)->after('frequency_type');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'installment_count')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->unsignedInteger('installment_count')->nullable()->after('interval_count');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'first_due_date')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->date('first_due_date')->nullable()->after('installment_count');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'custom_dates')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->json('custom_dates')->nullable()->after('first_due_date');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'schedule_locked')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->boolean('schedule_locked')->default(false)->after('custom_dates');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'schedule_locked_at')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->timestamp('schedule_locked_at')->nullable()->after('schedule_locked');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'approved_at')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->timestamp('approved_at')->nullable()->after('schedule_locked_at');
            });
        }

        if (!Schema::hasColumn('apartment_sales', 'net_price')) {
            Schema::table('apartment_sales', function (Blueprint $table): void {
                $table->decimal('net_price', 15, 2)->nullable()->after('discount');
            });
        }
    }

    public function down(): void
    {
        $columns = [
            'frequency_type',
            'interval_count',
            'installment_count',
            'first_due_date',
            'custom_dates',
            'schedule_locked',
            'schedule_locked_at',
            'approved_at',
            'net_price',
        ];

        foreach ($columns as $column) {
            if (Schema::hasColumn('apartment_sales', $column)) {
                Schema::table('apartment_sales', function (Blueprint $table) use ($column): void {
                    $table->dropColumn($column);
                });
            }
        }
    }
};
