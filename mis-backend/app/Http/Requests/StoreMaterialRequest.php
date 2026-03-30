<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'name' => ['required', 'string', 'max:255'],
            'material_type' => ['nullable', 'string', 'max:100'],
            'unit' => ['required', 'string', 'max:50'],
            'quantity' => ['nullable', 'numeric', 'min:0'],
            'reference_unit_price' => ['nullable', 'numeric', 'min:0'],
            'opening_warehouse_id' => ['nullable', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
            'supplier_id' => ['nullable', 'integer', 'min:1', Rule::exists('vendors', 'id')],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'serial_no' => ['nullable', 'string', 'max:100'],
            'expiry_date' => ['nullable', 'date'],
            'min_stock_level' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ];
    }
}
