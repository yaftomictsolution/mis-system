<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CompanyAsset extends Model
{
    use SoftDeletes;

    protected $table = 'company_assets';

    protected $fillable = [
        'uuid',
        'asset_code',
        'asset_name',
        'asset_type',
        'quantity',
        'allocated_quantity',
        'maintenance_quantity',
        'damaged_quantity',
        'retired_quantity',
        'supplier_id',
        'serial_no',
        'status',
        'current_employee_id',
        'current_project_id',
        'current_warehouse_id',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'allocated_quantity' => 'decimal:2',
        'maintenance_quantity' => 'decimal:2',
        'damaged_quantity' => 'decimal:2',
        'retired_quantity' => 'decimal:2',
        'supplier_id' => 'integer',
        'current_employee_id' => 'integer',
        'current_project_id' => 'integer',
        'current_warehouse_id' => 'integer',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'supplier_id')->withTrashed();
    }

    public function currentEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'current_employee_id')->withTrashed();
    }

    public function currentProject(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'current_project_id')->withTrashed();
    }

    public function currentWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'current_warehouse_id')->withTrashed();
    }
}
