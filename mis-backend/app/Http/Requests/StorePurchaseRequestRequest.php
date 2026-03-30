<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'request_type' => ['nullable', Rule::in(['material', 'asset'])],
            'source_material_request_id' => ['nullable', 'integer', 'min:1', Rule::exists('material_requests', 'id')],
            'project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
            'warehouse_id' => ['required', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
            'vendor_id' => ['nullable', 'integer', 'min:1', Rule::exists('vendors', 'id')],
            'requested_by_employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.uuid' => ['nullable', 'string', 'size:36'],
            'items.*.item_kind' => ['nullable', Rule::in(['material', 'asset'])],
            'items.*.material_id' => ['nullable', 'integer', 'min:1', Rule::exists('materials', 'id')],
            'items.*.company_asset_id' => ['nullable', 'integer', 'min:1', Rule::exists('company_assets', 'id')],
            'items.*.asset_name' => ['nullable', 'string', 'max:255'],
            'items.*.asset_type' => ['nullable', Rule::in(['vehicle', 'machine', 'tool', 'IT'])],
            'items.*.asset_code_prefix' => ['nullable', 'string', 'max:50'],
            'items.*.quantity_requested' => ['required', 'numeric', 'min:0.01'],
            'items.*.estimated_unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit' => ['required', 'string', 'max:100'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $requestType = $this->input('request_type', 'material');
            $items = $this->input('items', []);

            if (!is_array($items)) {
                return;
            }

            foreach ($items as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }

                $itemKind = ($item['item_kind'] ?? $requestType) === 'asset' ? 'asset' : 'material';
                if ($itemKind === 'material') {
                    if (empty($item['material_id'])) {
                        $validator->errors()->add("items.$index.material_id", 'Material is required for material purchase items.');
                    }
                    continue;
                }

                $companyAssetId = (int) ($item['company_asset_id'] ?? 0);
                $assetName = trim((string) ($item['asset_name'] ?? ''));
                $assetType = trim((string) ($item['asset_type'] ?? ''));

                if ($companyAssetId <= 0 && $assetName === '') {
                    $validator->errors()->add("items.$index.asset_name", 'Select an existing company asset or enter a new asset name.');
                }

                if ($companyAssetId <= 0 && $assetType === '') {
                    $validator->errors()->add("items.$index.asset_type", 'Asset type is required when creating a new company asset stock line.');
                }
            }
        });
    }
}
