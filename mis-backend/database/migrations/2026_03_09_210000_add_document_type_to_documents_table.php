<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (!Schema::hasColumn('documents', 'document_type')) {
                $table->string('document_type', 60)->nullable()->after('module');
                $table->index(['module', 'document_type'], 'documents_module_type_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (Schema::hasColumn('documents', 'document_type')) {
                $table->dropIndex('documents_module_type_idx');
                $table->dropColumn('document_type');
            }
        });
    }
};