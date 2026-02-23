<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Approval extends Model
{
    protected $fillable = [
        'module', 'reference_id', 'requested_by', 'status', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function logs()
    {
        return $this->hasMany(ApprovalLog::class);
    }
}
