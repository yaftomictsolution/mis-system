<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_material_stocks', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->decimal('qty_issued', 14, 2)->default(0);
            $table->decimal('qty_consumed', 14, 2)->default(0);
            $table->decimal('qty_returned', 14, 2)->default(0);
            $table->decimal('qty_on_site', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['project_id', 'material_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_material_stocks');
    }
};
