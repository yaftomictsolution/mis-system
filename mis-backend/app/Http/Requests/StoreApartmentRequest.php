<?php

namespace App\Http\Requests;

use App\Models\Apartment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreApartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $uuid = (string) ($this->route('uuid') ?: $this->input('uuid') ?: '');
        $apartmentCode = trim((string) $this->input('apartment_code', ''));

        $existing = null;
        if ($uuid !== '') {
            $existing = Apartment::withTrashed()->where('uuid', $uuid)->first();
        }
        if (!$existing && $apartmentCode !== '') {
            $existing = Apartment::withTrashed()->where('apartment_code', $apartmentCode)->first();
        }

        return [
            'uuid' => ['nullable', 'uuid'],
            'apartment_code' => [
                'required',
                'string',
                'max:100',
                Rule::unique('apartments', 'apartment_code')
                    ->ignore($existing?->id),
            ],
            'total_price' => ['nullable', 'numeric', 'min:0'],
            'usage_type' => ['required', Rule::in(['residential', 'commercial'])],
            'block_number' => ['nullable', 'string', 'max:50'],
            'unit_number' => ['required', 'string', 'max:50'],
            'floor_number' => ['nullable', 'string', 'max:50'],
            'bedrooms' => ['nullable', 'integer', 'min:0'],
            'halls' => ['nullable', 'integer', 'min:0'],
            'bathrooms' => ['nullable', 'integer', 'min:0'],
            'kitchens' => ['nullable', 'integer', 'min:0'],
            'balcony' => ['nullable', 'boolean'],
            'area_sqm' => ['nullable', 'numeric', 'min:0'],
            'apartment_shape' => ['nullable', 'string', 'max:100'],
            'corridor' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['available', 'reserved', 'handed_over', 'sold', 'rented', 'company_use'])],
            'qr_code' => ['nullable', 'string', 'max:255'],
            'additional_info' => ['nullable', 'string'],
        ];
    }
}
