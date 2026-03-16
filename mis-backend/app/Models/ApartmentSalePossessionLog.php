<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApartmentSalePossessionLog extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_sale_id',
        'action',
        'action_date',
        'user_id',
        'note',
    ];

    protected $casts = [
        'apartment_sale_id' => 'integer',
        'action_date' => 'datetime',
        'user_id' => 'integer',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

