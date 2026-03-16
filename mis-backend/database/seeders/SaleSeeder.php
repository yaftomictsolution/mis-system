<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class SaleSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('apartment_sales')->insert([
            [
                'uuid' => Str::uuid(),

                // IMPORTANT:
                // these must exist in your database
                'apartment_id' => 1,
                'customer_id'  => 2,

                'sale_date' => Carbon::now()->toDateString(),

                'total_price' => 50000.00,
                'discount' => 2000.00,

                'payment_type' => 'installment', // full | installment
                'status' => 'active', // active | cancelled | completed

                'created_at' => now(),
                'updated_at' => now(),
            ],

           
        ]);
    }
}