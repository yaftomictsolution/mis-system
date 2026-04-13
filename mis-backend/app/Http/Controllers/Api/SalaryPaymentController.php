<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSalaryPaymentRequest;
use App\Models\Employee;
use App\Models\SalaryPayment;
use App\Services\AccountLedgerService;
use App\Services\SalaryAdvanceBalanceService;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalaryPaymentController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 6;

    public function __construct(
        private readonly AccountLedgerService $accountLedgerService,
        private readonly SalaryAdvanceBalanceService $salaryAdvanceBalanceService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $offline = $request->boolean('offline');
        $since = $validated['since'] ?? null;
        $includeDeleted = $offline || !is_null($since);

        $query = SalaryPayment::query()
            ->with([
                'employee:id,uuid,first_name,last_name',
                'user:id,name',
                'account:id,uuid,name,currency',
                'accountTransaction:id,uuid',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('period', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('gross_salary', 'like', "%{$search}%")
                    ->orWhere('net_salary', 'like', "%{$search}%")
                    ->orWhere('tax_deducted', 'like', "%{$search}%")
                    ->orWhere('other_deductions', 'like', "%{$search}%")
                    ->orWhereHas('account', function ($accountQuery) use ($search): void {
                        $accountQuery->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('employee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        if ($since) {
            $query->where(function ($builder) use ($since): void {
                $builder
                    ->where('updated_at', '>', $since)
                    ->orWhere('deleted_at', '>', $since);
            });
        }

        if ($offline) {
            $windowStart = now()->subMonths(self::OFFLINE_WINDOW_MONTHS);
            $query->where(function ($builder) use ($windowStart): void {
                $builder
                    ->where('updated_at', '>=', $windowStart)
                    ->orWhere(function ($deleted) use ($windowStart): void {
                        $deleted
                            ->whereNotNull('deleted_at')
                            ->where('deleted_at', '>=', $windowStart);
                    });
            });
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginator->items())
            ->map(fn (SalaryPayment $payment): array => $this->payload($payment))
            ->values()
            ->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    public function store(StoreSalaryPaymentRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $created = false;
        $payment = DB::transaction(function () use ($incomingUuid, $data, $request, &$created) {
            $payment = $incomingUuid !== ''
                ? SalaryPayment::withTrashed()->where('uuid', $incomingUuid)->lockForUpdate()->first()
                : null;

            if (! $payment) {
                $payment = new SalaryPayment();
                $payment->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
                $created = true;
            } elseif ($payment->trashed()) {
                $payment->restore();
            }

            $this->fillPayment($payment, $data, (int) ($request->user()?->id ?? 0));
            $payment->save();
            $this->salaryAdvanceBalanceService->syncSalaryPaymentDeductions($payment);
            $this->accountLedgerService->syncSalaryPaymentPosting($payment, (int) ($request->user()?->id ?? 0));

            return $payment->fresh(['employee', 'user', 'account', 'accountTransaction']);
        });

        return response()->json([
            'data' => $this->payload($payment),
        ], $created ? 201 : 200);
    }

    public function update(StoreSalaryPaymentRequest $request, string $uuid): JsonResponse
    {
        $payment = SalaryPayment::withTrashed()->where('uuid', $uuid)->firstOrFail();
        $payment = DB::transaction(function () use ($payment, $request) {
            $payment = SalaryPayment::withTrashed()->where('id', $payment->id)->lockForUpdate()->firstOrFail();
            if ($payment->trashed()) {
                $payment->restore();
            }

            $this->fillPayment($payment, $request->validated(), (int) ($request->user()?->id ?? 0));
            $payment->save();
            $this->salaryAdvanceBalanceService->syncSalaryPaymentDeductions($payment);
            $this->accountLedgerService->syncSalaryPaymentPosting($payment, (int) ($request->user()?->id ?? 0));

            return $payment->fresh(['employee', 'user', 'account', 'accountTransaction']);
        });

        return response()->json([
            'data' => $this->payload($payment),
        ]);
    }

    public function destroy(Request $request, string $uuid): JsonResponse
    {
        DB::transaction(function () use ($uuid, $request): void {
            $payment = SalaryPayment::withTrashed()->where('uuid', $uuid)->lockForUpdate()->first();
            if ($payment && ! $payment->trashed()) {
                $this->salaryAdvanceBalanceService->reverseSalaryPaymentDeductions($payment);
                $this->accountLedgerService->reverseLinkedSalaryPaymentPosting(
                    $payment,
                    (int) ($request->user()?->id ?? 0)
                );
                $payment->delete();
            }
        });

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $payment = SalaryPayment::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $payment->trashed()) {
            return response()->json([
                'message' => 'Salary payment must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $payment->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Salary Payment', $payment),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function fillPayment(SalaryPayment $payment, array $data, int $actorId): void
    {
        $gross = round((float) ($data['gross_salary'] ?? 0), 2);
        $advanceDeducted = round((float) ($data['advance_deducted'] ?? 0), 2);
        if ($advanceDeducted > $gross) {
            $advanceDeducted = $gross;
        }
        $taxPercentage = min(100, max(0, round((float) ($data['tax_percentage'] ?? $payment->tax_percentage ?? 0), 2)));
        $taxDeducted = array_key_exists('tax_percentage', $data)
            ? min($gross, round($gross * ($taxPercentage / 100), 2))
            : min($gross, max(0, round((float) ($data['tax_deducted'] ?? $payment->tax_deducted ?? 0), 2)));
        $otherDeductions = min($gross, max(0, round((float) ($data['other_deductions'] ?? 0), 2)));
        $net = max(0, round($gross - $advanceDeducted - $taxDeducted - $otherDeductions, 2));
        $status = $this->normalizeStatus((string) ($data['status'] ?? 'draft'));
        $employeeId = (int) $data['employee_id'];
        $employeeCurrency = Employee::query()->where('id', $employeeId)->value('salary_currency_code');
        $salaryCurrency = $this->normalizeCurrency((string) ($data['salary_currency_code'] ?? $employeeCurrency ?? $payment->salary_currency_code ?? 'USD'));
        $salaryRateSnapshot = $this->accountLedgerService->getRateSnapshotForSalaryCurrency($salaryCurrency);
        $grossUsd = $this->accountLedgerService->convertSalaryAmountToUsd($gross, $salaryCurrency, $salaryRateSnapshot);
        $advanceDeductedUsd = $this->accountLedgerService->convertSalaryAmountToUsd($advanceDeducted, $salaryCurrency, $salaryRateSnapshot);
        $taxDeductedUsd = $this->accountLedgerService->convertSalaryAmountToUsd($taxDeducted, $salaryCurrency, $salaryRateSnapshot);
        $otherDeductionsUsd = $this->accountLedgerService->convertSalaryAmountToUsd($otherDeductions, $salaryCurrency, $salaryRateSnapshot);
        $netUsd = $this->accountLedgerService->convertSalaryAmountToUsd($net, $salaryCurrency, $salaryRateSnapshot);

        $payment->fill([
            'employee_id' => $employeeId,
            'period' => trim((string) $data['period']),
            'gross_salary' => $gross,
            'gross_salary_usd' => $grossUsd,
            'salary_currency_code' => $salaryCurrency,
            'salary_exchange_rate_snapshot' => $salaryRateSnapshot,
            'advance_deducted' => $advanceDeducted,
            'advance_deducted_usd' => $advanceDeductedUsd,
            'tax_percentage' => $taxPercentage,
            'tax_deducted' => $taxDeducted,
            'tax_deducted_usd' => $taxDeductedUsd,
            'other_deductions' => $otherDeductions,
            'other_deductions_usd' => $otherDeductionsUsd,
            'net_salary' => $net,
            'net_salary_usd' => $netUsd,
            'status' => $status,
            'account_id' => array_key_exists('account_id', $data)
                ? ($data['account_id'] !== null ? (int) $data['account_id'] : null)
                : $payment->account_id,
            'user_id' => isset($data['user_id']) ? (int) $data['user_id'] : ($payment->user_id ?: ($actorId > 0 ? $actorId : null)),
            'paid_at' => !empty($data['paid_at'])
                ? $data['paid_at']
                : ($status === 'paid' ? ($payment->paid_at ?: now()) : null),
        ]);
    }

    private function payload(SalaryPayment $payment): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $payment->employee?->first_name,
            $payment->employee?->last_name,
        ])));

        return [
            'id' => $payment->id,
            'uuid' => $payment->uuid,
            'employee_id' => $payment->employee_id,
            'employee_uuid' => $payment->employee?->uuid,
            'employee_name' => $employeeName !== '' ? $employeeName : null,
            'period' => $payment->period,
            'gross_salary' => (float) $payment->gross_salary,
            'gross_salary_usd' => $payment->gross_salary_usd !== null ? (float) $payment->gross_salary_usd : null,
            'salary_currency_code' => $payment->salary_currency_code,
            'salary_exchange_rate_snapshot' => $payment->salary_exchange_rate_snapshot !== null ? (float) $payment->salary_exchange_rate_snapshot : null,
            'advance_deducted' => (float) $payment->advance_deducted,
            'advance_deducted_usd' => $payment->advance_deducted_usd !== null ? (float) $payment->advance_deducted_usd : null,
            'tax_percentage' => (float) $payment->tax_percentage,
            'tax_deducted' => (float) $payment->tax_deducted,
            'tax_deducted_usd' => $payment->tax_deducted_usd !== null ? (float) $payment->tax_deducted_usd : null,
            'other_deductions' => (float) $payment->other_deductions,
            'other_deductions_usd' => $payment->other_deductions_usd !== null ? (float) $payment->other_deductions_usd : null,
            'net_salary' => (float) $payment->net_salary,
            'net_salary_usd' => $payment->net_salary_usd !== null ? (float) $payment->net_salary_usd : null,
            'status' => $payment->status,
            'account_id' => $payment->account_id,
            'account_uuid' => $payment->account?->uuid,
            'account_name' => $payment->account?->name,
            'account_currency' => $payment->account?->currency,
            'account_transaction_uuid' => $payment->accountTransaction?->uuid,
            'payment_currency_code' => $payment->payment_currency_code,
            'exchange_rate_snapshot' => $payment->exchange_rate_snapshot !== null ? (float) $payment->exchange_rate_snapshot : null,
            'net_salary_account_amount' => $payment->net_salary_account_amount !== null ? (float) $payment->net_salary_account_amount : null,
            'user_id' => $payment->user_id,
            'user_name' => $payment->user?->name,
            'paid_at' => optional($payment->paid_at)->toISOString(),
            'created_at' => optional($payment->created_at)->toISOString(),
            'updated_at' => optional($payment->updated_at)->toISOString(),
            'deleted_at' => optional($payment->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        $status = strtolower(trim($value));
        return in_array($status, ['paid', 'cancelled'], true) ? $status : 'draft';
    }

    private function normalizeCurrency(string $value): string
    {
        $normalized = strtoupper(trim($value));
        return in_array($normalized, ['USD', 'AFN'], true) ? $normalized : 'USD';
    }
}
