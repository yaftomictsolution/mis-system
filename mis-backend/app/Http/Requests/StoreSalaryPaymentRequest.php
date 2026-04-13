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
            'salary_currency_code' => ['nullable', Rule::in(['USD', 'AFN'])],
            'advance_deducted' => ['nullable', 'numeric', 'min:0', 'lte:gross_salary'],
            'tax_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'tax_deducted' => ['nullable', 'numeric', 'min:0', 'lte:gross_salary'],
            'other_deductions' => ['nullable', 'numeric', 'min:0', 'lte:gross_salary'],
            'net_salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['draft', 'paid', 'cancelled'])],
            'account_id' => ['nullable', 'integer', 'min:1', Rule::exists('accounts', 'id')],
            'user_id' => ['nullable', 'integer', 'min:1', Rule::exists('users', 'id')],
            'paid_at' => ['nullable', 'date'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $status = strtolower(trim((string) $this->input('status', 'draft')));
            $gross = round((float) $this->input('gross_salary', 0), 2);
            $advance = round((float) $this->input('advance_deducted', 0), 2);
            $taxPercent = min(100, max(0, round((float) $this->input('tax_percentage', 0), 2)));
            $tax = round((float) $this->input('tax_deducted', round($gross * ($taxPercent / 100), 2)), 2);
            $other = round((float) $this->input('other_deductions', 0), 2);

            if ($advance + $tax + $other > $gross) {
                $validator->errors()->add(
                    'other_deductions',
                    'Total deductions cannot be greater than gross salary.'
                );
            }

            if ($status === 'paid' && ! $this->filled('account_id')) {
                $validator->errors()->add('account_id', 'Account is required when salary is marked paid.');
            }
        });
    }
}
