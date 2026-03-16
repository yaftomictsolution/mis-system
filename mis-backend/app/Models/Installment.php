<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Installment extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_sale_id',
        'installment_no',
        'amount',
        'due_date',
        'paid_amount',
        'paid_date',
        'status',
    ];

    protected $casts = [
        'installment_no' => 'integer',
        'amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_date' => 'date',
        'paid_date' => 'date',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InstallmentPayment::class, 'installment_id');
    }
}
