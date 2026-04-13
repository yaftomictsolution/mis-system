<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Account extends Model
{
    use SoftDeletes;

    protected $table = 'accounts';

    protected $fillable = [
        'uuid',
        'name',
        'account_type',
        'bank_name',
        'account_number',
        'currency',
        'opening_balance',
        'current_balance',
        'status',
        'notes',
    ];

    protected $casts = [
        'opening_balance' => 'decimal:2',
        'current_balance' => 'decimal:2',
    ];

    public function transactions(): HasMany
    {
        return $this->hasMany(AccountTransaction::class, 'account_id');
    }

    public function salaryPayments(): HasMany
    {
        return $this->hasMany(SalaryPayment::class, 'account_id');
    }

    public function installmentPayments(): HasMany
    {
        return $this->hasMany(InstallmentPayment::class, 'account_id');
    }

    public function rentalPaymentReceipts(): HasMany
    {
        return $this->hasMany(RentalPaymentReceipt::class, 'account_id');
    }

    public function municipalityReceipts(): HasMany
    {
        return $this->hasMany(MunicipalityReceipt::class, 'account_id');
    }
}
