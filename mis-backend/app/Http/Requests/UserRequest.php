<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $uuid = (string) ($this->route('uuid') ?: $this->input('uuid') ?: '');

        $existing = null;
        if ($uuid !== '') {
            $existing = User::withTrashed()->where('uuid', $uuid)->first();
        }

        return [
            'uuid' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email')
                    ->whereNull('deleted_at')
                    ->ignore($existing?->id),
            ],
            'password' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:255'],
            'customer_id' => [
                'nullable',
                'integer',
                'min:1',
                Rule::exists('customers', 'id'),
                Rule::unique('users', 'customer_id')
                    ->whereNull('deleted_at')
                    ->ignore($existing?->id),
            ],
        ];
    }
}