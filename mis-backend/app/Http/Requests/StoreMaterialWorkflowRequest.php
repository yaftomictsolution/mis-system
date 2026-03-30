<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaterialWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
            'warehouse_id' => ['required', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
            'requested_by_employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.uuid' => ['nullable', 'string', 'size:36'],
            'items.*.material_id' => ['required', 'integer', 'min:1', Rule::exists('materials', 'id')],
            'items.*.quantity_requested' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit' => ['required', 'string', 'max:100'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
