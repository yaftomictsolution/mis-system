<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSalaryPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
            'period' => ['required', 'string', 'max:100'],
            'gross_salary' => ['required', 'numeric', 'min:0'],
            'advance_deducted' => ['nullable', 'numeric', 'min:0', 'lte:gross_salary'],
            'net_salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['draft', 'paid', 'cancelled'])],
            'user_id' => ['nullable', 'integer', 'min:1', Rule::exists('users', 'id')],
            'paid_at' => ['nullable', 'date'],
        ];
    }
}
