<?php

namespace App\Http\Requests;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $employee = $this->route('employee');
        $routeUuid = trim((string) ($this->route('uuid') ?? ''));

        $employeeId = null;
        if (is_object($employee) && isset($employee->id)) {
            $employeeId = $employee->id;
        } elseif (is_numeric($employee)) {
            $employeeId = (int) $employee;
        }

        if (! $employeeId && $routeUuid !== '') {
            $employeeId = Employee::withTrashed()
                ->where('uuid', $routeUuid)
                ->value('id');
        }

        return [
            'uuid' => [
                'nullable',
                'string',
                'size:36',
            ],

            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],

            'salary_type' => ['required', 'string', 'max:255'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],

            'address' => ['nullable', 'string', 'max:255'],

            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('employees', 'email')->ignore($employeeId),
            ],

            // 'phone' => [
            //     'nullable',
            //     'string',
            //     'max:255',
            //     Rule::unique('employees', 'phone')->ignore($employeeId),
            // ],

            // 'hire_date' => ['required', 'date'],
            'status' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.required' => 'First name is required.',
            'salary_type.required' => 'Salary type is required.',
            'base_salary.numeric' => 'Base salary must be a number.',
            'base_salary.min' => 'Base salary must not be less than 0.',
            'email.email' => 'Please enter a valid email address.',
            'email.unique' => 'This email already exists.',
            // 'phone.unique' => 'This phone number already exists.',
            // 'uuid.unique' => 'This uuid already exists.',
            // 'hire_date.required' => 'Hire date is required.',
            'hire_date.date' => 'Hire date must be a valid date.',
        ];
    }
}
