<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vendor extends Model
{
    use SoftDeletes;

    protected $table = 'vendors';

    protected $fillable = [
        'uuid',
        'name',
        'phone',
        'email',
        'address',
        'status',
    ];

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class, 'supplier_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(CompanyAsset::class, 'supplier_id');
    }
}
