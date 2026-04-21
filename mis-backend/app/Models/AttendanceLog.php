<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceLog extends Model
{
    protected $fillable = [
        'uuid',
        'employee_id',
        'employee_uuid',
        'employee_name',
        'employee_job_title',
        'biometric_user_id',
        'event_time',
        'event_type',
        'source',
        'device_label',
        'sync_batch_uuid',
        'status',
        'raw_payload',
    ];

    protected $casts = [
        'event_time' => 'datetime',
        'raw_payload' => 'array',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
