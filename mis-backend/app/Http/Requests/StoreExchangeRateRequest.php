<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExchangeRateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'base_currency' => ['nullable', Rule::in(['USD'])],
            'quote_currency' => ['nullable', Rule::in(['AFN'])],
            'rate' => ['required', 'numeric', 'gt:0'],
            'source' => ['nullable', Rule::in(['manual', 'api'])],
            'effective_date' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
