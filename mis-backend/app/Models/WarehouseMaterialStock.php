<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseMaterialStock extends Model
{
    protected $fillable = [
        'uuid',
        'warehouse_id',
        'material_id',
        'qty_on_hand',
        'qty_reserved',
        'qty_available',
    ];

    protected $casts = [
        'warehouse_id' => 'integer',
        'material_id' => 'integer',
        'qty_on_hand' => 'decimal:2',
        'qty_reserved' => 'decimal:2',
        'qty_available' => 'decimal:2',
    ];

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class)->withTrashed();
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)->withTrashed();
    }
}
