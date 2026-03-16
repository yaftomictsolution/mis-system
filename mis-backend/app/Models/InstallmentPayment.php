<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstallmentPayment extends Model
{
    protected $fillable = [
        'uuid',
        'installment_id',
        'amount',
        'payment_date',
        'payment_method',
        'reference_no',
        'notes',
        'received_by',
    ];

    protected $casts = [
        'installment_id' => 'integer',
        'amount' => 'decimal:2',
        'payment_date' => 'datetime',
        'received_by' => 'integer',
    ];

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installment_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}

