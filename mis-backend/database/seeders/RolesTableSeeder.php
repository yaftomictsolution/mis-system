<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RolesTableSeeder extends Seeder
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
        ];

        foreach ($roles as $role) {
            DB::table('roles')->insert([
                'uuid' => Str::uuid()->toString(),
                'name' => $role,
                'guard_name' => 'web',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}