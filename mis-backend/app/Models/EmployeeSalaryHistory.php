<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeSalaryHistory extends Model
{
    protected $table = 'employee_salary_histories';

    protected $fillable = [
        'uuid',
        'employee_id',
        'previous_salary',
        'previous_salary_currency_code',
        'new_salary',
        'new_salary_currency_code',
        'effective_from',
        'reason',
        'changed_by',
        'source',
    ];

    protected $casts = [
        'employee_id' => 'integer',
        'previous_salary' => 'decimal:2',
        'new_salary' => 'decimal:2',
        'effective_from' => 'date',
        'changed_by' => 'integer',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id')->withTrashed();
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
