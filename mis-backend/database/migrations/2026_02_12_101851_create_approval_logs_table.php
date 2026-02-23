<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('approval_id');
            $table->unsignedBigInteger('approved_by'); // users.id
            $table->string('action'); // approve|reject
            $table->text('remarks')->nullable();
            $table->timestamp('action_date');
            $table->timestamps();

            $table->foreign('approval_id')->references('id')->on('approvals')->cascadeOnDelete();
            $table->foreign('approved_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_logs');
    }
};
