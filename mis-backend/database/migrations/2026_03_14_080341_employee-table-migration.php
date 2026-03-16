<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
       Schema::create('employees', function (Blueprint $table): void {
           $table->id();
           $table->uuid('uuid')->unique();
           $table->string('first_name')->nullable();
           $table->string('last_name')->nullable();
           $table->string('job_title')->nullable();
           $table->string('salary_type')->nullable();
           $table->string('base_salary')->nullable();
           $table->string('address')->nullable();
           $table->string('email')->nullable();
           $table->string('phone')->nullable();
           $table->string('status')->nullable();
           $table->string('hire_date')->nullable();
           $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
