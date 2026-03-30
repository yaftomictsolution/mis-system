<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetWorkflowRequest extends FormRequest
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
            'requested_by_employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
            'requested_asset_id' => ['nullable', 'integer', 'min:1', Rule::exists('company_assets', 'id')],
            'asset_type' => ['nullable', Rule::in(['vehicle', 'machine', 'tool', 'IT'])],
            'quantity_requested' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
