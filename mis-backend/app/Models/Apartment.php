<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Apartment extends Model
{
    use SoftDeletes;

    protected $table = 'apartments';

    protected $fillable = [
        'uuid',
        'apartment_code',
        'total_price',
        'usage_type',
        'block_number',
        'unit_number',
        'floor_number',
        'bedrooms',
        'halls',
        'bathrooms',
        'kitchens',
        'balcony',
        'area_sqm',
        'apartment_shape',
        'corridor',
        'status',
        'qr_code',
        'additional_info',
    ];

    protected $casts = [
        'total_price' => 'float',
        'bedrooms' => 'integer',
        'halls' => 'integer',
        'bathrooms' => 'integer',
        'kitchens' => 'integer',
        'balcony' => 'boolean',
        'area_sqm' => 'float',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function rentals(): HasMany
    {
        return $this->hasMany(ApartmentRental::class, 'apartment_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'reference_id')
            ->where('module', 'apartment');
    }
}
