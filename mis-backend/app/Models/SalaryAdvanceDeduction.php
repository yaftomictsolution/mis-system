<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalaryAdvanceDeduction extends Model
{
    use SoftDeletes;

    protected $table = 'salary_advance_deductions';

    protected $fillable = [
        'uuid',
        'salary_payment_id',
        'salary_advance_id',
        'amount',
    ];

    protected $casts = [
        'salary_payment_id' => 'integer',
        'salary_advance_id' => 'integer',
        'amount' => 'decimal:2',
    ];

    public function salaryPayment(): BelongsTo
    {
        return $this->belongsTo(SalaryPayment::class, 'salary_payment_id');
    }

    public function salaryAdvance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvance::class, 'salary_advance_id')->withTrashed();
    }
}
