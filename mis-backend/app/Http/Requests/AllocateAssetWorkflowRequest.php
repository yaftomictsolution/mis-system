<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AllocateAssetWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'min:1', Rule::exists('company_assets', 'id')],
            'quantity_allocated' => ['required', 'numeric', 'min:0.01'],
            'assigned_date' => ['required', 'date'],
            'condition_on_issue' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
