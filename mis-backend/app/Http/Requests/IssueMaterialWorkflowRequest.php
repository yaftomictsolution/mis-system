<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class IssueMaterialWorkflowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.uuid' => ['required', 'string', 'size:36'],
            'items.*.quantity_issued' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'issue_date' => ['nullable', 'date'],
        ];
    }
}
