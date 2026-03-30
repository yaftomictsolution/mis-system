<?php

namespace App\Http\Requests;

use App\Models\Vendor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVendorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $routeUuid = trim((string) ($this->route('uuid') ?? ''));
        $vendorId = null;

        if ($routeUuid !== '') {
            $vendorId = Vendor::withTrashed()->where('uuid', $routeUuid)->value('id');
        }

        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('vendors', 'email')->ignore($vendorId)],
            'address' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }
}
