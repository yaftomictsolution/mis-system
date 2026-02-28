<?php

namespace App\Http\Requests;

use App\Models\Roles;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoleValidation extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        
      return true;

    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $uuid = $this->route('uuid') ?: $this->input('uuid');
        $guardName = (string) ($this->input('guard_name') ?: 'web');
        $name = trim((string) $this->input('name', ''));

        $existing = $uuid ? Roles::withTrashed()->where('uuid', $uuid)->first() : null;
        if (! $existing && $name !== '') {
            $existing = Roles::withTrashed()
                ->where('name', $name)
                ->where('guard_name', $guardName)
                ->first();
        }

        return [
            'uuid' => ['nullable', 'uuid'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('roles', 'name')
                    ->where(fn ($query) => $query->where('guard_name', $guardName)->whereNull('deleted_at'))
                    ->ignore($existing?->id),
            ],
            'guard_name' => ['nullable', 'string', 'max:255'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => [
                'distinct:ignore_case',
                'string',
                'max:255',
                Rule::exists('permissions', 'name')
                    ->where(fn ($query) => $query->where('guard_name', $guardName)),
            ],
        ];
    }
}
