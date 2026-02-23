<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_inbox', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('idempotency_key')->unique();  // unique per operation
            $table->string('entity');                     // apartments, customers, ...
            $table->string('entity_uuid');                // uuid of record
            $table->string('action');                     // create|update|delete
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users');
            $table->index(['entity', 'entity_uuid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_inbox');
    }
};
