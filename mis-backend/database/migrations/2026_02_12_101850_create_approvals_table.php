<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approvals', function (Blueprint $table) {
            $table->id();
            $table->string('module');               // e.g. apartment_sale, inventory_issue
            $table->unsignedBigInteger('reference_id');
            $table->unsignedBigInteger('requested_by'); // users.id
            $table->string('status')->default('pending'); // pending|approved|rejected
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['module', 'reference_id']);
            $table->foreign('requested_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approvals');
    }
};
