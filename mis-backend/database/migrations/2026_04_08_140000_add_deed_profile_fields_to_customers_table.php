<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('job_title')->nullable()->after('gname');
            $table->string('tazkira_number')->nullable()->after('job_title');
            $table->string('current_area')->nullable()->after('address');
            $table->string('current_district')->nullable()->after('current_area');
            $table->string('current_province')->nullable()->after('current_district');
            $table->string('original_area')->nullable()->after('current_province');
            $table->string('original_district')->nullable()->after('original_area');
            $table->string('original_province')->nullable()->after('original_district');
            $table->string('representative_name')->nullable()->after('original_province');
            $table->string('representative_fname')->nullable()->after('representative_name');
            $table->string('representative_gname')->nullable()->after('representative_fname');
            $table->string('representative_job_title')->nullable()->after('representative_gname');
            $table->string('representative_relationship')->nullable()->after('representative_job_title');
            $table->string('representative_phone')->nullable()->after('representative_relationship');
            $table->string('representative_tazkira_number')->nullable()->after('representative_phone');
            $table->string('representative_current_area')->nullable()->after('representative_tazkira_number');
            $table->string('representative_current_district')->nullable()->after('representative_current_area');
            $table->string('representative_current_province')->nullable()->after('representative_current_district');
            $table->string('representative_original_area')->nullable()->after('representative_current_province');
            $table->string('representative_original_district')->nullable()->after('representative_original_area');
            $table->string('representative_original_province')->nullable()->after('representative_original_district');
        });

        if (Schema::hasTable('document_types')) {
            $now = now();
            $existing = DB::table('document_types')
                ->where('module', 'customer')
                ->where('code', 'customer_representative_image')
                ->first(['uuid', 'created_at']);

            DB::table('document_types')->updateOrInsert(
                ['module' => 'customer', 'code' => 'customer_representative_image'],
                [
                    'uuid' => $existing?->uuid ?: (string) Str::uuid(),
                    'label' => 'Customer Representative Image',
                    'is_active' => true,
                    'updated_at' => $now,
                    'created_at' => $existing?->created_at ?: $now,
                ]
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('document_types')) {
            DB::table('document_types')
                ->where('module', 'customer')
                ->where('code', 'customer_representative_image')
                ->delete();
        }

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropColumn([
                'job_title',
                'tazkira_number',
                'current_area',
                'current_district',
                'current_province',
                'original_area',
                'original_district',
                'original_province',
                'representative_name',
                'representative_fname',
                'representative_gname',
                'representative_job_title',
                'representative_relationship',
                'representative_phone',
                'representative_tazkira_number',
                'representative_current_area',
                'representative_current_district',
                'representative_current_province',
                'representative_original_area',
                'representative_original_district',
                'representative_original_province',
            ]);
        });
    }
};
