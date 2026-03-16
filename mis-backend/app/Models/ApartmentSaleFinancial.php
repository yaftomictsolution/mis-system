<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApartmentSaleFinancial extends Model
{
    protected $fillable = [
        'uuid',
        'apartment_sale_id',
        'accounts_status',
        'municipality_share_15',
        'delivered_to_municipality',
        'remaining_municipality',
        'company_share_85',
        'delivered_to_company',
        'rahnama_fee_1',
        'customer_debt',
        'discount_or_contractor_deduction',
    ];

    protected $casts = [
        'apartment_sale_id' => 'integer',
        'municipality_share_15' => 'decimal:2',
        'delivered_to_municipality' => 'decimal:2',
        'remaining_municipality' => 'decimal:2',
        'company_share_85' => 'decimal:2',
        'delivered_to_company' => 'decimal:2',
        'rahnama_fee_1' => 'decimal:2',
        'customer_debt' => 'decimal:2',
        'discount_or_contractor_deduction' => 'decimal:2',
        'updated_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ApartmentSale::class, 'apartment_sale_id');
    }
}

