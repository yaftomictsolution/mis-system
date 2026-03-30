<?php

namespace Database\Seeders;

use App\Models\Roles;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;

class AuthSeed extends Seeder
{
    public function run()
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
        ];

        foreach ($roles as $r) {
            $role = Roles::withTrashed()->firstOrNew([
                'name' => $r,
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

        foreach ($permissions as $p) {
            Permission::firstOrCreate([
                'name' => $p,
                'guard_name' => 'web',
            ]);
        }

        // Admin has all permissions
        // $adminRole = Role::where('name', 'Admin')->first();
        // $adminRole->syncPermissions(Permission::all());

        // $admin = User::firstOrCreate(
        //     ['email' => 'admin@example.com'],
        //     [
        //         'uuid' => (string) Str::uuid(),
        //         'name' => 'System Admin',
        //         'phone' => '000000000',
        //         'password' => Hash::make('password123'),
        //         'status' => 'active',
        //     ]
        // );

        // $admin->assignRole('Admin');
    }
}
