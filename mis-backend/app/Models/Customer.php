<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $table = 'customers';

    protected $fillable = [
        'uuid',
        'name',
        'fname',
        'gname',
        'job_title',
        'tazkira_number',
        'phone',
        'phone1',
        'email',
        'address',
        'current_area',
        'current_district',
        'current_province',
        'original_area',
        'original_district',
        'original_province',
        'representative_name',
        'representative_fname',
        'representative_gname',
        'representative_job_title',
        'representative_relationship',
        'representative_phone',
        'representative_tazkira_number',
        'representative_current_area',
        'representative_current_district',
        'representative_current_province',
        'representative_original_area',
        'representative_original_district',
        'representative_original_province',
        'status',
    ];

    public function aparmtmentSale()
    {
        return $this->hasMany('App\Models\aparmtmentSale', 'customer_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'reference_id')
            ->where('module', 'customer');
    }

    public function crmMessages(): HasMany
    {
        return $this->hasMany(CrmMessage::class, 'customer_id');
    }

    public function rentals(): HasMany
    {
        return $this->hasMany(ApartmentRental::class, 'tenant_id');
    }
}
