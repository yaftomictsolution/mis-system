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
        if (!Schema::hasTable('document_types')) {
            Schema::create('document_types', function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->string('module', 40);
                $table->string('code', 80);
                $table->string('label', 120);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['module', 'code'], 'document_types_module_code_unique');
                $table->index(['module', 'is_active'], 'document_types_module_active_idx');
            });
        }

        $now = now();
        $rows = [
            ['module' => 'customer', 'code' => 'customer_image', 'label' => 'Customer Image'],
            ['module' => 'customer', 'code' => 'customer_deed_document', 'label' => 'Customer Deed Document'],
            ['module' => 'customer', 'code' => 'customer_attachment', 'label' => 'Customer Attachment'],
            ['module' => 'apartment', 'code' => 'apartment_image', 'label' => 'Apartment Image'],
            ['module' => 'apartment', 'code' => 'apartment_document', 'label' => 'Apartment Document'],
            ['module' => 'apartment_sale', 'code' => 'deed_document', 'label' => 'Deed Document'],
            ['module' => 'apartment_sale', 'code' => 'sale_contract', 'label' => 'Sale Contract'],
            ['module' => 'apartment_sale', 'code' => 'sale_receipt', 'label' => 'Sale Receipt'],
            ['module' => 'rental', 'code' => 'rental_contract', 'label' => 'Rental Contract'],
            ['module' => 'rental', 'code' => 'rental_receipt', 'label' => 'Rental Receipt'],
            ['module' => 'rental', 'code' => 'tenant_document', 'label' => 'Tenant Document'],
        ];

        foreach ($rows as $row) {
            $existing = DB::table('document_types')
                ->where('module', $row['module'])
                ->where('code', $row['code'])
                ->first(['uuid', 'created_at']);
            $existingUuid = $existing?->uuid;
            $existingCreatedAt = $existing?->created_at;

            DB::table('document_types')->updateOrInsert(
                ['module' => $row['module'], 'code' => $row['code']],
                [
                    'uuid' => $existingUuid ?: (string) Str::uuid(),
                    'label' => $row['label'],
                    'is_active' => true,
                    'updated_at' => $now,
                    'created_at' => $existingCreatedAt ?: $now,
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_types');
    }
};
