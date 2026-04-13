<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApartmentQrScanLog extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_qr_access_token_id',
        'apartment_id',
        'apartment_sale_id',
        'user_id',
        'scan_result',
        'access_scope',
        'ip_address',
        'user_agent',
        'scanned_at',
    ];

    protected $casts = [
        'apartment_qr_access_token_id' => 'integer',
        'apartment_id' => 'integer',
        'apartment_sale_id' => 'integer',
        'user_id' => 'integer',
        'scanned_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function qrToken(): BelongsTo
    {
        return $this->belongsTo(ApartmentQrAccessToken::class, 'apartment_qr_access_token_id');
    }
}