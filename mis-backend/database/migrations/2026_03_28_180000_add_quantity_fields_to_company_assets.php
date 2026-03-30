<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_assets', function (Blueprint $table): void {
            $table->decimal('quantity', 14, 2)->default(0)->after('asset_type');
            $table->decimal('allocated_quantity', 14, 2)->default(0)->after('quantity');
            $table->decimal('maintenance_quantity', 14, 2)->default(0)->after('allocated_quantity');
            $table->decimal('damaged_quantity', 14, 2)->default(0)->after('maintenance_quantity');
            $table->decimal('retired_quantity', 14, 2)->default(0)->after('damaged_quantity');
        });

        DB::table('company_assets')
            ->orderBy('id')
            ->get()
            ->each(function (object $asset): void {
                $available = 0;
                $allocated = 0;
                $maintenance = 0;
                $damaged = 0;
                $retired = 0;

                $status = strtolower(trim((string) ($asset->status ?? 'available')));
                if ($status === 'allocated') {
                    $allocated = 1;
                } elseif ($status === 'maintenance') {
                    $maintenance = 1;
                } elseif ($status === 'damaged') {
                    $damaged = 1;
                } elseif ($status === 'retired') {
                    $retired = 1;
                } else {
                    $available = 1;
                }

                DB::table('company_assets')
                    ->where('id', $asset->id)
                    ->update([
                        'quantity' => $available,
                        'allocated_quantity' => $allocated,
                        'maintenance_quantity' => $maintenance,
                        'damaged_quantity' => $damaged,
                        'retired_quantity' => $retired,
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('company_assets', function (Blueprint $table): void {
            $table->dropColumn([
                'quantity',
                'allocated_quantity',
                'maintenance_quantity',
                'damaged_quantity',
                'retired_quantity',
            ]);
        });
    }
};
