<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RentalPaymentReceipt extends Model
{
    protected $table = 'rental_payment_receipts';

    protected $fillable = [
        'uuid',
        'rental_payment_id',
        'rental_id',
        'tenant_id',
        'receipt_no',
        'payment_date',
        'amount',
        'payment_method',
        'reference_no',
        'received_by',
        'account_id',
        'account_transaction_id',
        'payment_currency_code',
        'exchange_rate_snapshot',
        'account_amount',
        'notes',
    ];

    protected $casts = [
        'payment_date' => 'datetime',
        'amount' => 'decimal:2',
        'received_by' => 'integer',
        'account_id' => 'integer',
        'account_transaction_id' => 'integer',
        'exchange_rate_snapshot' => 'decimal:6',
        'account_amount' => 'decimal:2',
    ];

    public function rental(): BelongsTo
    {
        return $this->belongsTo(ApartmentRental::class, 'rental_id');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(RentalPayment::class, 'rental_payment_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'tenant_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id')->withTrashed();
    }

    public function accountTransaction(): BelongsTo
    {
        return $this->belongsTo(AccountTransaction::class, 'account_transaction_id');
    }
}
