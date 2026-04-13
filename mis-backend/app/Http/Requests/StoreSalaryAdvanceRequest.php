<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSalaryAdvanceRequest extends FormRequest
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
            'amount' => ['required', 'numeric', 'min:0.01'],
            'currency_code' => ['nullable', Rule::in(['USD', 'AFN'])],
            'user_id' => ['nullable', 'integer', 'min:1', Rule::exists('users', 'id')],
            'reason' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'partial_deducted', 'deducted', 'rejected'])],
        ];
    }
}
