<?php

namespace App\Http\Requests;

use App\Models\Warehouse;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWarehouseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $routeUuid = trim((string) ($this->route('uuid') ?? ''));
        $warehouseId = null;

        if ($routeUuid !== '') {
            $warehouseId = Warehouse::withTrashed()->where('uuid', $routeUuid)->value('id');
        }

        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'name' => ['required', 'string', 'max:255', Rule::unique('warehouses', 'name')->ignore($warehouseId)],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }
}
