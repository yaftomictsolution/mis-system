<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('employees')->insert([
            [
                'uuid' => Str::uuid(),
                'first_name' => 'Ahmad',
                'last_name' => 'Khan',
                'job_title' => 'Manager',
                'salary_type' => 'monthly',
                'base_salary' => '20000',
                'address' => 'Kabul',
                'email' => 'ahmad@example.com',
                'phone' => '0700000001',
                'status' => 'active',
                'hire_date' => now(),
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'uuid' => Str::uuid(),
                'first_name' => 'Ali',
                'last_name' => 'Ahmadi',
                'job_title' => 'Accountant',
                'salary_type' => 'monthly',
                'base_salary' => '15000',
                'address' => 'Herat',
                'email' => 'ali@example.com',
                'phone' => '0700000002',
                'status' => 'active',
                'hire_date' => now(),
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => null,
            ],
            [
                'uuid' => Str::uuid(),
                'first_name' => 'Karim',
                'last_name' => 'Rahimi',
                'job_title' => 'HR Officer',
                'salary_type' => 'monthly',
                'base_salary' => '12000',
                'address' => 'Mazar',
                'email' => 'karim@example.com',
                'phone' => '0700000003',
                'status' => 'inactive',
                'hire_date' => now(),
                'created_at' => now(),
                'updated_at' => now(),
                'deleted_at' => now(), // soft deleted record
            ],
        ]);
    }
}