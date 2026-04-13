<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountTransaction extends Model
{
    protected $table = 'account_transactions';

    protected $fillable = [
        'uuid',
        'account_id',
        'direction',
        'amount',
        'currency_code',
        'exchange_rate_snapshot',
        'amount_usd',
        'module',
        'reference_type',
        'reference_uuid',
        'description',
        'payment_method',
        'transaction_date',
        'created_by_user_id',
        'status',
        'reversal_of_id',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'exchange_rate_snapshot' => 'decimal:6',
        'amount_usd' => 'decimal:2',
        'transaction_date' => 'datetime',
        'created_by_user_id' => 'integer',
        'metadata' => 'array',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id')->withTrashed();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(AccountTransaction::class, 'reversal_of_id');
    }

    public function reversals(): HasMany
    {
        return $this->hasMany(AccountTransaction::class, 'reversal_of_id');
    }
}
