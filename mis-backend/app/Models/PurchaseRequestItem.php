<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseRequestItem extends Model
{
    protected $fillable = [
        'uuid',
        'purchase_request_id',
        'item_kind',
        'material_id',
        'company_asset_id',
        'asset_name',
        'asset_type',
        'asset_code_prefix',
        'quantity_requested',
        'quantity_approved',
        'quantity_received',
        'estimated_unit_price',
        'estimated_line_total',
        'actual_unit_price',
        'actual_line_total',
        'unit',
        'notes',
    ];

    protected $casts = [
        'purchase_request_id' => 'integer',
        'material_id' => 'integer',
        'company_asset_id' => 'integer',
        'item_kind' => 'string',
        'asset_name' => 'string',
        'asset_type' => 'string',
        'asset_code_prefix' => 'string',
        'quantity_requested' => 'decimal:2',
        'quantity_approved' => 'decimal:2',
        'quantity_received' => 'decimal:2',
        'estimated_unit_price' => 'decimal:2',
        'estimated_line_total' => 'decimal:2',
        'actual_unit_price' => 'decimal:2',
        'actual_line_total' => 'decimal:2',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequest::class, 'purchase_request_id');
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)->withTrashed();
    }

    public function companyAsset(): BelongsTo
    {
        return $this->belongsTo(CompanyAsset::class, 'company_asset_id')->withTrashed();
    }
}
