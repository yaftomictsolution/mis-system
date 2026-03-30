<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaterialRequestItem extends Model
{
    protected $fillable = [
        'uuid',
        'material_request_id',
        'material_id',
        'quantity_requested',
        'quantity_approved',
        'quantity_issued',
        'unit',
        'notes',
    ];

    protected $casts = [
        'material_request_id' => 'integer',
        'material_id' => 'integer',
        'quantity_requested' => 'decimal:2',
        'quantity_approved' => 'decimal:2',
        'quantity_issued' => 'decimal:2',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(MaterialRequest::class, 'material_request_id');
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)->withTrashed();
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'material_request_item_id');
    }
}
