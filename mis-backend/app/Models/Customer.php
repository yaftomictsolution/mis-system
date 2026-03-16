<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $table ='customers';
    protected $fillable = ['uuid','name','fname','gname','phone','phone1','email','address','status'];
    
    public function aparmtmentSale(){
        return $this->hasMany('App\Models\aparmtmentSale','customer_id');
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
