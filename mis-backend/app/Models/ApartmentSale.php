<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Customer;
use App\Models\Apartment;
use App\Models\User;
class ApartmentSale extends Model
{
    use SoftDeletes;

    protected $table ='apartment_sales';

    protected $fillable = [
        'uuid',
        'sale_id',
        'apartment_id',
        'customer_id',
        'user_id',
        'sale_date',
        'total_price',
        'discount',
        'payment_type',
        'frequency_type',
        'interval_count',
        'installment_count',
        'first_due_date',
        'custom_dates',
        'schedule_locked',
        'schedule_locked_at',
        'approved_at',
        'net_price',
        'status',
        'deed_status',
        'deed_issued_at',
        'deed_issued_by',
        'key_handover_status',
        'key_handover_at',
        'key_handover_by',
        'possession_start_date',
        'vacated_at',
        'key_returned_at',
        'key_returned_by',
    ];

    protected $casts = [
        'sale_date' => 'date',
        'first_due_date' => 'date',
        'custom_dates' => 'array',
        'schedule_locked' => 'boolean',
        'schedule_locked_at' => 'datetime',
        'approved_at' => 'datetime',
        'total_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'net_price' => 'decimal:2',
        'actual_net_revenue' => 'decimal:2',
        'deed_issued_at' => 'datetime',
        'deed_issued_by' => 'integer',
        'key_handover_at' => 'datetime',
        'key_handover_by' => 'integer',
        'possession_start_date' => 'date',
        'vacated_at' => 'date',
        'key_returned_at' => 'datetime',
        'key_returned_by' => 'integer',
        'user_id' => 'integer',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function installments(): HasMany
    {
        return $this->hasMany(Installment::class, 'apartment_sale_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class, 'apartment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function financial(): HasOne
    {
        return $this->hasOne(ApartmentSaleFinancial::class, 'apartment_sale_id');
    }

    public function municipalityLetter(): HasOne
    {
        return $this->hasOne(MunicipalityPaymentLetter::class, 'apartment_sale_id');
    }

    public function municipalityReceipts(): HasMany
    {
        return $this->hasMany(MunicipalityReceipt::class, 'apartment_sale_id');
    }

    public function possessionLogs(): HasMany
    {
        return $this->hasMany(ApartmentSalePossessionLog::class, 'apartment_sale_id');
    }

    public function termination(): HasOne
    {
        return $this->hasOne(ApartmentSaleTermination::class, 'apartment_sale_id');
    }
}
