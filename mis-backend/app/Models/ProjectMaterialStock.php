<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectMaterialStock extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'material_id',
        'qty_issued',
        'qty_consumed',
        'qty_returned',
        'qty_on_site',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'material_id' => 'integer',
        'qty_issued' => 'decimal:2',
        'qty_consumed' => 'decimal:2',
        'qty_returned' => 'decimal:2',
        'qty_on_site' => 'decimal:2',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)->withTrashed();
    }
}
