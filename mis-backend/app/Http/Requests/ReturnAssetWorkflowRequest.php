<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReturnAssetWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'return_date' => ['required', 'date'],
            'return_status' => ['required', Rule::in(['returned', 'damaged', 'lost'])],
            'quantity_returned' => ['nullable', 'numeric', 'min:0.01'],
            'warehouse_id' => ['nullable', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
            'condition_on_return' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
