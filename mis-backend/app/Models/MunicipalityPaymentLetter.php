<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MunicipalityPaymentLetter extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_sale_id',
        'letter_no',
        'issued_at',
        'municipality_share_amount',
        'remaining_municipality',
        'notes',
    ];

    protected $casts = [
        'apartment_sale_id' => 'integer',
        'issued_at' => 'datetime',
        'municipality_share_amount' => 'decimal:2',
        'remaining_municipality' => 'decimal:2',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
    }
}

