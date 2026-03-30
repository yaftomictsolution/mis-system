<?php

namespace App\Http\Requests;

use App\Models\CompanyAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCompanyAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $routeUuid = trim((string) ($this->route('uuid') ?? ''));
        $assetId = null;

        if ($routeUuid !== '') {
            $assetId = CompanyAsset::withTrashed()->where('uuid', $routeUuid)->value('id');
        }

        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'asset_code' => ['required', 'string', 'max:100', Rule::unique('company_assets', 'asset_code')->ignore($assetId)],
            'asset_name' => ['required', 'string', 'max:255'],
            'asset_type' => ['required', Rule::in(['vehicle', 'machine', 'tool', 'IT'])],
            'quantity' => ['required', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'integer', 'min:1', Rule::exists('vendors', 'id')],
            'serial_no' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['available', 'allocated', 'maintenance', 'damaged', 'retired'])],
            'current_employee_id' => ['nullable', 'integer', 'min:1', Rule::exists('employees', 'id')],
            'current_project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
            'current_warehouse_id' => ['nullable', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
            'notes' => ['nullable', 'string'],
        ];
    }
}
