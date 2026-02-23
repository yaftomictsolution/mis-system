<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

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
            Role::firstOrCreate(['name' => $r]);
        }

        $permissions = [
            'apartments.view', 'apartments.create', 'apartments.update',
            'customers.view', 'customers.create', 'customers.update',
            'sales.create', 'sales.approve', 'sales.cancel',
            'installments.pay',
            'municipality.view', 'municipality.record_receipt', 'municipality.approve',
            'inventory.request', 'inventory.approve', 'inventory.issue',
            'vendors.manage', 'contracts.manage', 'payments.approve',
            'payroll.view', 'payroll.pay', 'payroll.advance', 'payroll.approve',
            'reports.view',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }

        // Admin has all permissions
        $adminRole = Role::where('name', 'Admin')->first();
        $adminRole->syncPermissions(Permission::all());

        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'System Admin',
                'phone' => '000000000',
                'password' => Hash::make('password123'),
                'status' => 'active',
            ]
        );

        $admin->assignRole('Admin');
    }
}
