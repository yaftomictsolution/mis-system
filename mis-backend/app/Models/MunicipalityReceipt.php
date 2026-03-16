<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MunicipalityReceipt extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_sale_id',
        'receipt_no',
        'payment_date',
        'amount',
        'payment_method',
        'notes',
        'received_by',
    ];

    protected $casts = [
        'apartment_sale_id' => 'integer',
        'payment_date' => 'date',
        'amount' => 'decimal:2',
        'received_by' => 'integer',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
    }
}

