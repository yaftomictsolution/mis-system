<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAssignment extends Model
{
    protected $fillable = [
        'uuid',
        'asset_id',
        'asset_request_id',
        'project_id',
        'employee_id',
        'quantity_assigned',
        'assigned_date',
        'return_date',
        'status',
        'condition_on_issue',
        'condition_on_return',
        'notes',
    ];

    protected $casts = [
        'asset_id' => 'integer',
        'asset_request_id' => 'integer',
        'project_id' => 'integer',
        'employee_id' => 'integer',
        'quantity_assigned' => 'decimal:2',
        'assigned_date' => 'date',
        'return_date' => 'date',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(CompanyAsset::class, 'asset_id')->withTrashed();
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(AssetRequest::class, 'asset_request_id')->withTrashed();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id')->withTrashed();
    }
}
