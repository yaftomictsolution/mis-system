<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalaryAdvance extends Model
{
    use SoftDeletes;

    protected $table = 'salary_advances';

    protected $fillable = [
        'uuid',
        'employee_id',
        'amount',
        'user_id',
        'reason',
        'status',
    ];

    protected $casts = [
        'employee_id' => 'integer',
        'amount' => 'decimal:2',
        'user_id' => 'integer',
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
