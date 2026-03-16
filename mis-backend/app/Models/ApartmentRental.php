<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApartmentRental extends Model
{
    protected $table = 'apartment_rentals';

    protected $fillable = [
        'uuid',
        'rental_id',
        'apartment_id',
        'tenant_id',
        'created_by',
        'contract_start',
        'contract_end',
        'monthly_rent',
        'advance_months',
        'advance_required_amount',
        'advance_paid_amount',
        'advance_remaining_amount',
        'total_paid_amount',
        'advance_status',
        'next_due_date',
        'status',
        'key_handover_status',
        'key_handover_at',
        'key_handover_by',
        'key_returned_at',
        'key_returned_by',
        'termination_reason',
        'terminated_at',
    ];

    protected $casts = [
        'contract_start' => 'date',
        'contract_end' => 'date',
        'monthly_rent' => 'decimal:2',
        'advance_months' => 'integer',
        'advance_required_amount' => 'decimal:2',
        'advance_paid_amount' => 'decimal:2',
        'advance_remaining_amount' => 'decimal:2',
        'total_paid_amount' => 'decimal:2',
        'next_due_date' => 'date',
        'key_handover_at' => 'datetime',
        'key_handover_by' => 'integer',
        'key_returned_at' => 'datetime',
        'key_returned_by' => 'integer',
        'terminated_at' => 'datetime',
    ];

    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class, 'apartment_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'tenant_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(RentalPayment::class, 'rental_id');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(RentalPaymentReceipt::class, 'rental_id');
    }
}
