<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApartmentSaleTermination extends Model
{
    protected $fillable = [
        'apartment_sale_id',
        'reason',
        'termination_charge',
        'refund_amount',
        'remaining_debt_after_termination',
    ];

    protected $casts = [
        'apartment_sale_id' => 'integer',
        'termination_charge' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'remaining_debt_after_termination' => 'decimal:2',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
    }
}

