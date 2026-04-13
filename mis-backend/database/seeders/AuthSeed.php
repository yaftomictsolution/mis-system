<?php

namespace Database\Seeders;

use App\Models\Roles;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;

class AuthSeed extends Seeder
{
    public function run(): void
    {
        $roles = [
            'Admin',
            'ApartmentManager',
            'SalesOfficer',
            'Accountant',
            'ProjectManager',
            'Storekeeper',
            'ProcurementOfficer',
            'Auditor',
            'Customer',
        ];

        foreach ($roles as $roleName) {
            $role = Roles::withTrashed()->firstOrNew([
                'name' => $roleName,
                'guard_name' => 'web',
            ]);

            if (! $role->uuid) {
                $role->uuid = (string) Str::uuid();
            }

            if ($role->trashed()) {
                $role->restore();
            }

            $role->save();
        }

        $permissions = collect(Arr::flatten(config('permission.permissions', [])))
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->map(fn ($value) => trim($value))
            ->unique()
            ->values()
            ->all();

        foreach ($permissions as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }
    }
}