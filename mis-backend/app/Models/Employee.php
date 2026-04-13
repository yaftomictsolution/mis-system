<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use SoftDeletes;

    protected $table = 'employees';

    protected $fillable = [
        'uuid',
        'first_name',
        'last_name',
        'job_title',
        'salary_type',
        'base_salary',
        'salary_currency_code',
        'address',
        'email',
        'phone',
        'status',
        'hire_date',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'hire_date' => 'date',
    ];

    public function salaryAdvances(): HasMany
    {
        return $this->hasMany(SalaryAdvance::class, 'employee_id');
    }

    public function salaryPayments(): HasMany
    {
        return $this->hasMany(SalaryPayment::class, 'employee_id');
    }

    public function salaryHistories(): HasMany
    {
        return $this->hasMany(EmployeeSalaryHistory::class, 'employee_id');
    }
}
