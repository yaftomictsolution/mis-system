<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_messages', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('customer_id');
            $table->string('channel', 20); // sms | email
            $table->string('message_type', 120);
            $table->dateTime('sent_at')->nullable();
            $table->string('status', 30)->default('queued'); // queued | sent | failed
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->index(['customer_id', 'channel', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_messages');
    }
};

