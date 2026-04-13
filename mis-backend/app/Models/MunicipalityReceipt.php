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
        'account_id',
        'account_transaction_id',
        'payment_currency_code',
        'exchange_rate_snapshot',
        'account_amount',
    ];

    protected $casts = [
        'apartment_sale_id' => 'integer',
        'payment_date' => 'date',
        'amount' => 'decimal:2',
        'received_by' => 'integer',
        'account_id' => 'integer',
        'account_transaction_id' => 'integer',
        'exchange_rate_snapshot' => 'decimal:6',
        'account_amount' => 'decimal:2',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
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
