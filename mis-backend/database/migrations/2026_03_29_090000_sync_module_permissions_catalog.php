<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Arr;
use App\Models\Roles;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const NEW_PERMISSIONS = [
        'employees.view',
        'employees.create',
        'employees.update',
        'projects.view',
        'projects.create',
        'projects.update',
        'inventory_master.view',
        'vendors.view',
        'vendors.create',
        'vendors.update',
        'warehouses.view',
        'warehouses.create',
        'warehouses.update',
        'materials.view',
        'materials.create',
        'materials.update',
        'company_assets.view',
        'company_assets.create',
        'company_assets.update',
        'warehouse_stock.view',
        'material_requests.view',
        'material_requests.create',
        'material_requests.update',
        'purchase_requests.view',
        'purchase_requests.create',
        'purchase_requests.update',
        'asset_requests.view',
        'asset_requests.create',
        'asset_requests.update',
        'stock_movements.view',
    ];

    private const INVENTORY_VIEW_PERMISSIONS = [
        'projects.view',
        'inventory_master.view',
        'warehouse_stock.view',
        'material_requests.view',
        'purchase_requests.view',
        'asset_requests.view',
        'stock_movements.view',
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $configured = collect(Arr::flatten(config('permission.permissions', [])))
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn ($value) => trim($value))
            ->unique()
            ->values();

        foreach ($configured as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        Roles::query()
            ->whereHas('permissions', fn ($query) => $query->where('name', 'inventory.request'))
            ->get()
            ->each(function (Roles $role): void {
                $role->givePermissionTo(self::INVENTORY_VIEW_PERMISSIONS);
            });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::query()
            ->where('guard_name', 'web')
            ->whereIn('name', self::NEW_PERMISSIONS)
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
