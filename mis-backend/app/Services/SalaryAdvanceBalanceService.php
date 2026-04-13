<?php

namespace App\Services;

use App\Models\SalaryAdvance;
use App\Models\SalaryAdvanceDeduction;
use App\Models\SalaryPayment;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalaryAdvanceBalanceService
{
    public function __construct(
        private readonly ExchangeRateService $exchangeRateService,
    ) {
    }

    public function syncAdvanceSnapshot(SalaryAdvance $advance, ?string $requestedStatus = null): void
    {
        $amount = round((float) ($advance->amount ?? 0), 2);
        $deducted = round((float) ($advance->deducted_amount ?? 0), 2);

        if ($deducted > $amount) {
            throw ValidationException::withMessages([
                'amount' => 'Advance amount cannot be less than the amount already deducted.',
            ]);
        }

        $remaining = max(0, round($amount - $deducted, 2));
        $status = strtolower(trim((string) ($requestedStatus ?? $advance->status ?? 'pending')));

        if ($amount > 0 && $remaining <= 0) {
            $status = 'deducted';
        } elseif ($deducted > 0) {
            $status = 'partial_deducted';
        } elseif ($status === 'rejected') {
            $status = 'rejected';
        } elseif ($status === 'approved') {
            $status = 'approved';
        } else {
            $status = 'pending';
        }

        $advance->deducted_amount = $deducted;
        $advance->remaining_amount = $remaining;
        $advance->status = $status;
    }

    public function syncSalaryPaymentDeductions(SalaryPayment $payment): void
    {
        DB::transaction(function () use ($payment): void {
            $payment = SalaryPayment::query()->lockForUpdate()->findOrFail($payment->id);

            $this->reverseSalaryPaymentDeductions($payment);

            $requestedDeduction = round((float) ($payment->advance_deducted ?? 0), 2);
            if ($requestedDeduction <= 0 || $payment->employee_id <= 0) {
                return;
            }

            $paymentCurrency = $this->exchangeRateService->normalizeCurrency($payment->salary_currency_code);

            $eligibleAdvances = SalaryAdvance::query()
                ->where('employee_id', $payment->employee_id)
                ->whereIn('status', ['approved', 'partial_deducted'])
                ->where('remaining_amount', '>', 0)
                ->orderBy('created_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $requiresConversion = $eligibleAdvances->contains(function (SalaryAdvance $advance) use ($paymentCurrency): bool {
                return $this->exchangeRateService->normalizeCurrency($advance->currency_code) !== $paymentCurrency;
            });
            $rateSnapshot = $requiresConversion
                ? round((float) $this->exchangeRateService->getRequiredUsdToAfnRate()->rate, 6)
                : null;

            $available = round((float) $eligibleAdvances->sum(function (SalaryAdvance $advance) use ($paymentCurrency, $rateSnapshot): float {
                return $this->exchangeRateService->convertAmountBetweenCurrencies(
                    round((float) ($advance->remaining_amount ?? 0), 2),
                    $this->exchangeRateService->normalizeCurrency($advance->currency_code),
                    $paymentCurrency,
                    $rateSnapshot
                );
            }), 2);
            if ($requestedDeduction > $available) {
                throw ValidationException::withMessages([
                    'advance_deducted' => 'Advance deducted cannot exceed the employee approved advance balance.',
                ]);
            }

            $remainingToAllocate = $requestedDeduction;
            foreach ($eligibleAdvances as $advance) {
                if ($remainingToAllocate <= 0) {
                    break;
                }

                $advanceCurrency = $this->exchangeRateService->normalizeCurrency($advance->currency_code);
                $availableOnAdvance = $this->exchangeRateService->convertAmountBetweenCurrencies(
                    round((float) ($advance->remaining_amount ?? 0), 2),
                    $advanceCurrency,
                    $paymentCurrency,
                    $rateSnapshot
                );
                if ($availableOnAdvance <= 0) {
                    continue;
                }

                $allocation = min($remainingToAllocate, $availableOnAdvance);
                if ($allocation <= 0) {
                    continue;
                }

                $allocationInAdvanceCurrency = $this->exchangeRateService->convertAmountBetweenCurrencies(
                    $allocation,
                    $paymentCurrency,
                    $advanceCurrency,
                    $rateSnapshot
                );

                SalaryAdvanceDeduction::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'salary_payment_id' => $payment->id,
                    'salary_advance_id' => $advance->id,
                    'amount' => $allocationInAdvanceCurrency,
                ]);

                $advance->deducted_amount = round((float) $advance->deducted_amount + $allocationInAdvanceCurrency, 2);
                $this->syncAdvanceSnapshot($advance, $advance->status);
                $advance->save();

                $remainingToAllocate = round($remainingToAllocate - $allocation, 2);
            }
        });
    }

    public function reverseSalaryPaymentDeductions(SalaryPayment $payment): void
    {
        $deductions = SalaryAdvanceDeduction::query()
            ->where('salary_payment_id', $payment->id)
            ->whereNull('deleted_at')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->get();

        /** @var SalaryAdvanceDeduction $deduction */
        foreach ($deductions as $deduction) {
            $advance = SalaryAdvance::query()->lockForUpdate()->find($deduction->salary_advance_id);
            if ($advance) {
                $advance->deducted_amount = max(0, round((float) $advance->deducted_amount - (float) $deduction->amount, 2));
                $this->syncAdvanceSnapshot($advance, 'approved');
                $advance->save();
            }

            $deduction->delete();
        }
    }

    public function approvedBalanceForEmployee(int $employeeId, ?Collection $advances = null): float
    {
        $items = $advances ?? SalaryAdvance::query()
            ->where('employee_id', $employeeId)
            ->whereIn('status', ['approved', 'partial_deducted'])
            ->get();

        return round((float) $items->sum(function (SalaryAdvance $advance): float {
            return max(0, round((float) ($advance->remaining_amount ?? 0), 2));
        }), 2);
    }
}
