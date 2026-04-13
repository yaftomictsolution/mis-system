<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExchangeRate extends Model
{
    use SoftDeletes;

    protected $table = 'exchange_rates';

    protected $fillable = [
        'uuid',
        'base_currency',
        'quote_currency',
        'rate',
        'source',
        'effective_date',
        'approved_by_user_id',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'rate' => 'decimal:6',
        'effective_date' => 'date',
        'approved_by_user_id' => 'integer',
        'is_active' => 'boolean',
    ];

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }
}
