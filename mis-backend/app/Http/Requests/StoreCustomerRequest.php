<?php

namespace App\Http\Requests;

use App\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'job_title' => ['nullable', 'string', 'max:255'],
            'tazkira_number' => ['nullable', 'string', 'max:255'],
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
            'current_area' => ['nullable', 'string', 'max:255'],
            'current_district' => ['nullable', 'string', 'max:255'],
            'current_province' => ['nullable', 'string', 'max:255'],
            'original_area' => ['nullable', 'string', 'max:255'],
            'original_district' => ['nullable', 'string', 'max:255'],
            'original_province' => ['nullable', 'string', 'max:255'],
            'representative_name' => ['nullable', 'string', 'max:255'],
            'representative_fname' => ['nullable', 'string', 'max:255'],
            'representative_gname' => ['nullable', 'string', 'max:255'],
            'representative_job_title' => ['nullable', 'string', 'max:255'],
            'representative_relationship' => ['nullable', 'string', 'max:255'],
            'representative_phone' => ['nullable', 'string', 'max:50'],
            'representative_tazkira_number' => ['nullable', 'string', 'max:255'],
            'representative_current_area' => ['nullable', 'string', 'max:255'],
            'representative_current_district' => ['nullable', 'string', 'max:255'],
            'representative_current_province' => ['nullable', 'string', 'max:255'],
            'representative_original_area' => ['nullable', 'string', 'max:255'],
            'representative_original_district' => ['nullable', 'string', 'max:255'],
            'representative_original_province' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ];
    }
}
