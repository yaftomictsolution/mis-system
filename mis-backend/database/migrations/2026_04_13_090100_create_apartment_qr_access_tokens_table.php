<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('apartment_qr_access_tokens', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('apartment_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('token', 100)->unique();
            $table->string('status', 30)->default('active');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_scanned_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        $apartmentIds = DB::table('apartments')->pluck('id');

        foreach ($apartmentIds as $apartmentId) {
            $exists = DB::table('apartment_qr_access_tokens')
                ->where('apartment_id', $apartmentId)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('apartment_qr_access_tokens')->insert([
                'uuid' => (string) Str::uuid(),
                'apartment_id' => $apartmentId,
                'token' => Str::random(64),
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('apartment_qr_access_tokens');
    }
};