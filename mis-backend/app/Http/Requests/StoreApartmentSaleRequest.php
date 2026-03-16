<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreApartmentSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'uuid'],
            'sale_id' => ['nullable', 'string', 'max:30'],
            'apartment_id' => ['required', 'integer', 'min:1', Rule::exists('apartments', 'id')],
            'customer_id' => ['required', 'integer', 'min:1', Rule::exists('customers', 'id')],
            'sale_date' => ['required', 'date'],
            'total_price' => ['required', 'numeric', 'min:0.01'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_type' => ['required', Rule::in(['full', 'installment'])],
            'status' => ['nullable', Rule::in(['active', 'pending', 'approved', 'completed', 'cancelled', 'defaulted', 'terminated'])],

            'frequency_type' => ['nullable', Rule::in(['weekly', 'monthly', 'quarterly', 'custom_dates'])],
            'interval_count' => ['nullable', 'integer', 'min:1'],
            'installment_count' => ['nullable', 'integer', 'min:1'],
            'first_due_date' => ['nullable', 'date'],
            'custom_dates' => ['nullable', 'array'],
            'custom_dates.*.installment_no' => ['nullable', 'integer', 'min:1'],
            'custom_dates.*.due_date' => ['required_with:custom_dates', 'date'],
            'custom_dates.*.amount' => ['required_with:custom_dates', 'numeric', 'min:0.01'],

            'schedule_locked' => ['nullable', 'boolean'],
            'schedule_locked_at' => ['nullable', 'date'],
            'approved_at' => ['nullable', 'date'],
            'net_price' => ['nullable', 'numeric', 'min:0'],
            'key_handover_status' => ['nullable', Rule::in(['not_handed_over', 'handed_over', 'returned'])],
            'key_handover_at' => ['nullable', 'date'],
            'key_handover_by' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'possession_start_date' => ['nullable', 'date'],
            'vacated_at' => ['nullable', 'date'],
            'key_returned_at' => ['nullable', 'date'],
            'key_returned_by' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'termination_reason' => ['nullable', 'string'],
            'termination_charge' => ['nullable', 'numeric', 'min:0'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'remaining_debt_after_termination' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $paymentType = (string) $this->input('payment_type', '');
            $frequency = (string) $this->input('frequency_type', 'monthly');
            $total = (float) $this->input('total_price', 0);
            $discount = (float) $this->input('discount', 0);

            if ($discount > $total) {
                $validator->errors()->add('discount', 'Discount cannot exceed total price.');
            }

            if ($paymentType !== 'installment') {
                return;
            }

            if ($frequency === 'custom_dates') {
                $customDates = $this->input('custom_dates');
                if (!is_array($customDates) || count($customDates) === 0) {
                    $validator->errors()->add('custom_dates', 'At least one custom installment row is required.');
                }
                return;
            }

            if ((int) $this->input('installment_count', 0) <= 0) {
                $validator->errors()->add('installment_count', 'Installment count is required for installment plans.');
            }
            if (!$this->filled('first_due_date')) {
                $validator->errors()->add('first_due_date', 'First due date is required for installment plans.');
            }
        });
    }
}
