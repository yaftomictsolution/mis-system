<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RentalPayment extends Model
{
    protected $table = 'rental_payments';

    protected $fillable = [
        'uuid',
        'bill_no',
        'bill_generated_at',
        'rental_id',
        'period_month',
        'due_date',
        'payment_type',
        'amount_due',
        'amount_paid',
        'remaining_amount',
        'paid_date',
        'status',
        'notes',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'bill_generated_at' => 'datetime',
        'due_date' => 'date',
        'amount_due' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'paid_date' => 'datetime',
        'approved_by' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function rental(): BelongsTo
    {
        return $this->belongsTo(ApartmentRental::class, 'rental_id');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(RentalPaymentReceipt::class, 'rental_payment_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
