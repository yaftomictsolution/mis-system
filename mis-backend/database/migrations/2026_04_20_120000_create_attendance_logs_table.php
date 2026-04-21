<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->uuid('employee_uuid')->nullable()->index();
            $table->string('employee_name');
            $table->string('employee_job_title')->nullable();
            $table->string('biometric_user_id')->nullable()->index();
            $table->dateTime('event_time')->index();
            $table->enum('event_type', ['check_in', 'check_out']);
            $table->enum('source', ['demo', 'biometric', 'import'])->default('biometric');
            $table->string('device_label')->nullable();
            $table->uuid('sync_batch_uuid')->nullable()->index();
            $table->enum('status', ['matched', 'unmatched'])->default('matched')->index();
            $table->json('raw_payload')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'event_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_logs');
    }
};
