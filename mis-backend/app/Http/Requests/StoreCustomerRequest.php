<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;
use Illuminate\Foundation\Http\FormRequest;
use App\Models\Customer;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $uuid = $this->route('uuid') ?: $this->input('uuid');

        $existing = null;
        if ($uuid) {
            $existing = Customer::withTrashed()->where('uuid', $uuid)->first();
        }

        return [
            'uuid' => ['nullable', 'uuid'],

            'name' => ['required', 'string', 'max:255'],
            'fname' => ['nullable', 'string', 'max:255'],
            'gname' => ['nullable', 'string', 'max:255'],

            'phone' => [
                'required',
                'string',
                'max:50',
                Rule::unique('customers', 'phone')
                    ->whereNull('deleted_at')
                    ->ignore($existing?->id),
            ],

            'phone1' => ['nullable', 'string', 'max:50'],

            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('customers', 'email')
                    ->whereNull('deleted_at')
                    ->ignore($existing?->id),
            ],

            'address' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ];
    }
}
