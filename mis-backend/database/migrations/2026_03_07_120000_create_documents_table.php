<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('module', 50);
            $table->unsignedBigInteger('reference_id');
            $table->string('file_path', 1024);
            $table->date('expiry_date')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['module', 'reference_id'], 'documents_module_reference_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};

