<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crm_messages', function (Blueprint $table): void {
            if (!Schema::hasColumn('crm_messages', 'installment_id')) {
                $table->unsignedBigInteger('installment_id')->nullable()->after('customer_id');
                $table->index(['installment_id', 'channel', 'created_at'], 'crm_msg_installment_channel_created_idx');
            }

            if (!Schema::hasColumn('crm_messages', 'error_message')) {
                $table->string('error_message', 500)->nullable()->after('status');
            }

            if (!Schema::hasColumn('crm_messages', 'metadata')) {
                $table->json('metadata')->nullable()->after('error_message');
            }
        });
    }

    public function down(): void
    {
        Schema::table('crm_messages', function (Blueprint $table): void {
            if (Schema::hasColumn('crm_messages', 'metadata')) {
                $table->dropColumn('metadata');
            }

            if (Schema::hasColumn('crm_messages', 'error_message')) {
                $table->dropColumn('error_message');
            }

            if (Schema::hasColumn('crm_messages', 'installment_id')) {
                $table->dropIndex('crm_msg_installment_channel_created_idx');
                $table->dropColumn('installment_id');
            }
        });
    }
};

