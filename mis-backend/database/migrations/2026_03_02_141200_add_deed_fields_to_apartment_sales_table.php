<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('apartment_sales', function (Blueprint $table): void {
            if (!Schema::hasColumn('apartment_sales', 'deed_status')) {
                $table->string('deed_status', 30)->default('not_issued')->after('status');
            }
            if (!Schema::hasColumn('apartment_sales', 'deed_issued_at')) {
                $table->timestamp('deed_issued_at')->nullable()->after('deed_status');
            }
            if (!Schema::hasColumn('apartment_sales', 'deed_issued_by')) {
                $table->foreignId('deed_issued_by')->nullable()->after('deed_issued_at')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('apartment_sales', function (Blueprint $table): void {
            if (Schema::hasColumn('apartment_sales', 'deed_issued_by')) {
                $table->dropConstrainedForeignId('deed_issued_by');
            }
            if (Schema::hasColumn('apartment_sales', 'deed_issued_at')) {
                $table->dropColumn('deed_issued_at');
            }
            if (Schema::hasColumn('apartment_sales', 'deed_status')) {
                $table->dropColumn('deed_status');
            }
        });
    }
};

