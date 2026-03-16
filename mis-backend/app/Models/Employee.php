<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
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
        'address',
        'email',
        'phone',
        'status',
        'hire_date',
    ];

}
