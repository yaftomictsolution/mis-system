<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    protected $fillable = [
        'uuid',
        'material_id',
        'warehouse_id',
        'project_id',
        'employee_id',
        'material_request_item_id',
        'quantity',
        'movement_type',
        'reference_type',
        'reference_no',
        'approved_by_user_id',
        'issued_by_user_id',
        'movement_date',
        'notes',
    ];

    protected $casts = [
        'material_id' => 'integer',
        'warehouse_id' => 'integer',
        'project_id' => 'integer',
        'employee_id' => 'integer',
        'material_request_item_id' => 'integer',
        'approved_by_user_id' => 'integer',
        'issued_by_user_id' => 'integer',
        'quantity' => 'decimal:2',
        'movement_date' => 'datetime',
    ];

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)->withTrashed();
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class)->withTrashed();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class)->withTrashed();
    }

    public function materialRequestItem(): BelongsTo
    {
        return $this->belongsTo(MaterialRequestItem::class, 'material_request_item_id');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id')->withTrashed();
    }

    public function issuedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by_user_id')->withTrashed();
    }
}
