<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'customer_id')) {
                if (Schema::hasTable('customers')) {
                    $table->foreignId('customer_id')->nullable()->after('phone')->constrained('customers')->nullOnDelete();
                } else {
                    $table->unsignedBigInteger('customer_id')->nullable()->after('phone');
                }
            }
        });

        if (Schema::hasColumn('users', 'customer_id')) {
            try {
                DB::statement('CREATE UNIQUE INDEX users_customer_id_unique ON users (customer_id)');
            } catch (\Throwable $e) {
                // Ignore if the index already exists.
            }
        }

        if (Schema::hasTable('roles')) {
            $exists = DB::table('roles')
                ->where('name', 'Customer')
                ->where('guard_name', 'web')
                ->exists();

            if (! $exists) {
                DB::table('roles')->insert([
                    'uuid' => (string) Str::uuid(),
                    'name' => 'Customer',
                    'guard_name' => 'web',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'customer_id')) {
            try {
                DB::statement('DROP INDEX users_customer_id_unique ON users');
            } catch (\Throwable $e) {
                // Ignore if the index does not exist.
            }

            Schema::table('users', function (Blueprint $table): void {
                try {
                    $table->dropConstrainedForeignId('customer_id');
                } catch (\Throwable $e) {
                    if (Schema::hasColumn('users', 'customer_id')) {
                        $table->dropColumn('customer_id');
                    }
                }
            });
        }
    }
};