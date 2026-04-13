<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        foreach ([
            ['code' => 'office', 'label' => 'Office'],
            ['code' => 'cash', 'label' => 'Cash'],
            ['code' => 'bank', 'label' => 'Bank'],
            ['code' => 'personal', 'label' => 'Personal'],
        ] as $type) {
            $exists = DB::table('document_types')
                ->where('module', 'accounts')
                ->where('code', $type['code'])
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('document_types')->insert([
                'uuid' => (string) Str::uuid(),
                'module' => 'accounts',
                'code' => $type['code'],
                'label' => $type['label'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('document_types')
            ->where('module', 'accounts')
            ->whereIn('code', ['office', 'cash', 'bank', 'personal'])
            ->delete();
    }
};
