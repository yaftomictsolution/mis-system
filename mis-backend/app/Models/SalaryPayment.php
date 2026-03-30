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
        'advance_deducted',
        'net_salary',
        'status',
        'user_id',
        'paid_at',
    ];

    protected $casts = [
        'employee_id' => 'integer',
        'gross_salary' => 'decimal:2',
        'advance_deducted' => 'decimal:2',
        'net_salary' => 'decimal:2',
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
}
