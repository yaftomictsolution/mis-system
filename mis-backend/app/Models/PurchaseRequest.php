<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'request_no',
        'request_type',
        'source_material_request_id',
        'project_id',
        'warehouse_id',
        'vendor_id',
        'requested_by_employee_id',
        'status',
        'approved_by_user_id',
        'approved_at',
        'received_by_user_id',
        'received_at',
        'purchase_receipt_no',
        'requested_at',
        'notes',
    ];

    protected $casts = [
        'request_type' => 'string',
        'source_material_request_id' => 'integer',
        'project_id' => 'integer',
        'warehouse_id' => 'integer',
        'vendor_id' => 'integer',
        'requested_by_employee_id' => 'integer',
        'approved_by_user_id' => 'integer',
        'received_by_user_id' => 'integer',
        'approved_at' => 'datetime',
        'received_at' => 'datetime',
        'requested_at' => 'datetime',
    ];

    public function sourceMaterialRequest(): BelongsTo
    {
        return $this->belongsTo(MaterialRequest::class, 'source_material_request_id')->withTrashed();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class)->withTrashed();
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class)->withTrashed();
    }

    public function requestedByEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'requested_by_employee_id')->withTrashed();
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id')->withTrashed();
    }

    public function receivedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by_user_id')->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseRequestItem::class)->orderBy('id');
    }
}
