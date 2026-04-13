<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeSalaryHistory;
use Illuminate\Support\Str;

class EmployeeSalaryHistoryService
{
    public function recordInitialSalary(Employee $employee, ?int $actorId = null): ?EmployeeSalaryHistory
    {
        $salary = $this->normalizeSalary($employee->base_salary);
        if ($salary === null) {
            return null;
        }

        $salaryCurrency = $this->normalizeCurrency($employee->salary_currency_code);

        $existing = EmployeeSalaryHistory::query()
            ->where('employee_id', $employee->id)
            ->where('source', 'initial')
            ->first();

        if ($existing) {
            return $existing;
        }

        return EmployeeSalaryHistory::query()->create([
            'uuid' => (string) Str::uuid(),
            'employee_id' => $employee->id,
            'previous_salary' => null,
            'previous_salary_currency_code' => null,
            'new_salary' => $salary,
            'new_salary_currency_code' => $salaryCurrency,
            'effective_from' => $employee->hire_date ?: now()->toDateString(),
            'reason' => 'Initial salary recorded',
            'changed_by' => $actorId,
            'source' => 'initial',
        ]);
    }

    public function recordSalaryChange(
        Employee $employee,
        mixed $previousSalaryValue,
        mixed $newSalaryValue,
        ?string $previousSalaryCurrency,
        ?string $newSalaryCurrency,
        ?string $effectiveFrom = null,
        ?string $reason = null,
        ?string $historyUuid = null,
        ?int $actorId = null,
    ): ?EmployeeSalaryHistory {
        $previousSalary = $this->normalizeSalary($previousSalaryValue);
        $newSalary = $this->normalizeSalary($newSalaryValue);
        $previousCurrency = $this->normalizeCurrency($previousSalaryCurrency);
        $newCurrency = $this->normalizeCurrency($newSalaryCurrency);

        if ($previousSalary === $newSalary && $previousCurrency === $newCurrency) {
            return null;
        }

        $history = $historyUuid
            ? EmployeeSalaryHistory::query()->firstOrNew(['uuid' => $historyUuid])
            : new EmployeeSalaryHistory(['uuid' => (string) Str::uuid()]);

        $history->fill([
            'employee_id' => $employee->id,
            'previous_salary' => $previousSalary,
            'previous_salary_currency_code' => $previousSalary === null ? null : $previousCurrency,
            'new_salary' => $newSalary,
            'new_salary_currency_code' => $newSalary === null ? null : $newCurrency,
            'effective_from' => $effectiveFrom ?: ($employee->hire_date ?: now()->toDateString()),
            'reason' => trim((string) $reason) !== '' ? trim((string) $reason) : 'Salary updated',
            'changed_by' => $actorId,
            'source' => 'manual',
        ]);
        $history->save();

        return $history;
    }

    private function normalizeSalary(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $number = round((float) $value, 2);
        return $number >= 0 ? $number : 0.0;
    }

    private function normalizeCurrency(?string $value): string
    {
        $normalized = strtoupper(trim((string) $value));
        return in_array($normalized, ['USD', 'AFN'], true) ? $normalized : 'USD';
    }
}
