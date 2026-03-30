<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Material extends Model
{
    use SoftDeletes;

    protected $table = 'materials';

    protected $fillable = [
        'uuid',
        'name',
        'material_type',
        'unit',
        'quantity',
        'reference_unit_price',
        'supplier_id',
        'batch_no',
        'serial_no',
        'expiry_date',
        'min_stock_level',
        'status',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'reference_unit_price' => 'decimal:2',
        'supplier_id' => 'integer',
        'expiry_date' => 'date',
        'min_stock_level' => 'decimal:2',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'supplier_id')->withTrashed();
    }

    public function warehouseMaterialStocks(): HasMany
    {
        return $this->hasMany(WarehouseMaterialStock::class);
    }

    public function projectMaterialStocks(): HasMany
    {
        return $this->hasMany(ProjectMaterialStock::class);
    }
}
