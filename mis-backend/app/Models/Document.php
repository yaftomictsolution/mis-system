<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    protected $table = 'documents';

    public $timestamps = false;
    const UPDATED_AT = null;

    protected $fillable = [
        'module',
        'document_type',
        'reference_id',
        'file_path',
        'expiry_date',
        'created_at',
    ];

    protected $casts = [
        'reference_id' => 'integer',
        'expiry_date' => 'date',
        'created_at' => 'datetime',
    ];
}