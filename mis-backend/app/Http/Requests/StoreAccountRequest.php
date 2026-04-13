<?php

namespace App\Http\Requests;

use App\Models\Account;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $routeUuid = trim((string) ($this->route('uuid') ?? ''));
        $accountId = $routeUuid !== ''
            ? Account::withTrashed()->where('uuid', $routeUuid)->value('id')
            : null;

        return [
            'uuid' => ['nullable', 'string', 'size:36'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('accounts', 'name')->ignore($accountId),
            ],
            'account_type' => [
                'required',
                'string',
                'max:80',
                Rule::exists('document_types', 'code')->where(fn ($query) => $query->where('module', 'accounts')),
            ],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'currency' => ['nullable', Rule::in(['USD', 'AFN'])],
            'opening_balance' => ['nullable', 'numeric'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string'],
        ];
    }
}

