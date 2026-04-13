<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApartmentQrAccessToken extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_id',
        'token',
        'status',
        'expires_at',
        'last_scanned_at',
        'created_by_user_id',
    ];

    protected $casts = [
        'apartment_id' => 'integer',
        'created_by_user_id' => 'integer',
        'expires_at' => 'datetime',
        'last_scanned_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class, 'apartment_id');
    }

    public function scanLogs(): HasMany
    {
        return $this->hasMany(ApartmentQrScanLog::class, 'apartment_qr_access_token_id');
    }
}