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
        'account_id',
        'account_transaction_id',
        'payment_currency_code',
        'exchange_rate_snapshot',
        'account_amount',
    ];

    protected $casts = [
        'installment_id' => 'integer',
        'amount' => 'decimal:2',
        'payment_date' => 'datetime',
        'received_by' => 'integer',
        'account_id' => 'integer',
        'account_transaction_id' => 'integer',
        'exchange_rate_snapshot' => 'decimal:6',
        'account_amount' => 'decimal:2',
    ];

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installment_id');
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
