<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rental_payments', function (Blueprint $table): void {
            $table->string('bill_no')->nullable()->unique()->after('uuid');
            $table->timestamp('bill_generated_at')->nullable()->after('bill_no');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete()->after('notes');
            $table->timestamp('approved_at')->nullable()->after('approved_by');

            $table->index(['bill_generated_at']);
            $table->index(['approved_by', 'approved_at']);
        });
    }

    public function down(): void
    {
        Schema::table('rental_payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn(['bill_no', 'bill_generated_at', 'approved_at']);
        });
    }
};

