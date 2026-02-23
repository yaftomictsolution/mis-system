<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncInbox extends Model
{
    protected $table = 'sync_inbox';

    protected $fillable = [
        'user_id', 'idempotency_key', 'entity', 'entity_uuid', 'action', 'processed_at',
    ];

    protected $casts = [
        'processed_at' => 'datetime',
    ];
}
