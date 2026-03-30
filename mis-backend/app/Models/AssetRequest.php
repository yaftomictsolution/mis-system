<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'request_no',
        'project_id',
        'requested_by_employee_id',
        'requested_asset_id',
        'asset_type',
        'quantity_requested',
        'quantity_allocated',
        'status',
        'reason',
        'approved_by_user_id',
        'approved_at',
        'allocated_by_user_id',
        'allocated_at',
        'allocation_receipt_no',
        'requested_at',
        'notes',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'requested_by_employee_id' => 'integer',
        'requested_asset_id' => 'integer',
        'quantity_requested' => 'decimal:2',
        'quantity_allocated' => 'decimal:2',
        'approved_by_user_id' => 'integer',
        'allocated_by_user_id' => 'integer',
        'approved_at' => 'datetime',
        'allocated_at' => 'datetime',
        'requested_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function requestedByEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'requested_by_employee_id')->withTrashed();
    }

    public function requestedAsset(): BelongsTo
    {
        return $this->belongsTo(CompanyAsset::class, 'requested_asset_id')->withTrashed();
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id')->withTrashed();
    }

    public function allocatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'allocated_by_user_id')->withTrashed();
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(AssetAssignment::class)->orderByDesc('id');
    }
}
