<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmMessage extends Model
{
    protected $table = 'crm_messages';

    protected $fillable = [
        'customer_id',
        'installment_id',
        'channel',
        'message_type',
        'sent_at',
        'status',
        'error_message',
        'metadata',
    ];

    protected $casts = [
        'customer_id' => 'integer',
        'installment_id' => 'integer',
        'sent_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installment_id');
    }
}
