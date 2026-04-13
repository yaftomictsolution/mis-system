<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalaryPayment extends Model
{
    use SoftDeletes;

    protected $table = 'salary_payments';

    protected $fillable = [
        'uuid',
        'employee_id',
        'period',
        'gross_salary',
        'gross_salary_usd',
        'salary_currency_code',
        'salary_exchange_rate_snapshot',
        'advance_deducted',
        'advance_deducted_usd',
        'tax_percentage',
        'tax_deducted',
        'tax_deducted_usd',
        'other_deductions',
        'other_deductions_usd',
        'net_salary',
        'net_salary_usd',
        'status',
        'account_id',
        'account_transaction_id',
        'payment_currency_code',
        'exchange_rate_snapshot',
        'net_salary_account_amount',
        'user_id',
        'paid_at',
    ];

    protected $casts = [
        'employee_id' => 'integer',
        'gross_salary' => 'decimal:2',
        'gross_salary_usd' => 'decimal:2',
        'advance_deducted' => 'decimal:2',
        'advance_deducted_usd' => 'decimal:2',
        'salary_exchange_rate_snapshot' => 'decimal:6',
        'tax_percentage' => 'decimal:2',
        'tax_deducted' => 'decimal:2',
        'tax_deducted_usd' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'other_deductions_usd' => 'decimal:2',
        'net_salary' => 'decimal:2',
        'net_salary_usd' => 'decimal:2',
        'account_id' => 'integer',
        'account_transaction_id' => 'integer',
        'exchange_rate_snapshot' => 'decimal:6',
        'net_salary_account_amount' => 'decimal:2',
        'user_id' => 'integer',
        'paid_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id')->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id')->withTrashed();
    }

    public function accountTransaction(): BelongsTo
    {
        return $this->belongsTo(AccountTransaction::class, 'account_transaction_id');
    }

    public function advanceDeductions()
    {
        return $this->hasMany(SalaryAdvanceDeduction::class, 'salary_payment_id');
    }
}
