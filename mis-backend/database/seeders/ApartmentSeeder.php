<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ApartmentSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('apartments')->insert([
            'uuid' => Str::uuid(),

            // آي دی آپارتمان
            'apartment_code' => 'G-101',

            // residential | commercial
            'usage_type' => 'residential',

            'block_number' => 'B1',
            'unit_number' => '101',
            'floor_number' => '1',

            'bedrooms' => 2,
            'halls' => 1,
            'bathrooms' => 2,
            'kitchens' => 1,
            'balcony' => true,

            'area_sqm' => 120.50,
            'apartment_shape' => 'square',
            'corridor' => 'main corridor',

            'status' => 'available',
            'qr_code' => 'QR-A101',

            'additional_info' => 'Sample apartment for testing',

            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}