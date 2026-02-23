<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprovalLog extends Model
{
    protected $fillable = [
        'approval_id', 'approved_by', 'action', 'remarks', 'action_date',
    ];

    protected $casts = [
        'action_date' => 'datetime',
    ];
}
