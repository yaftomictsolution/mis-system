<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaterialRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'request_no',
        'project_id',
        'warehouse_id',
        'requested_by_employee_id',
        'status',
        'approved_by_user_id',
        'approved_at',
        'issued_by_user_id',
        'issued_at',
        'issue_receipt_no',
        'requested_at',
        'notes',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'warehouse_id' => 'integer',
        'requested_by_employee_id' => 'integer',
        'approved_by_user_id' => 'integer',
        'issued_by_user_id' => 'integer',
        'approved_at' => 'datetime',
        'issued_at' => 'datetime',
        'requested_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class)->withTrashed();
    }

    public function requestedByEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'requested_by_employee_id')->withTrashed();
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id')->withTrashed();
    }

    public function issuedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by_user_id')->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(MaterialRequestItem::class)->orderBy('id');
    }
}
