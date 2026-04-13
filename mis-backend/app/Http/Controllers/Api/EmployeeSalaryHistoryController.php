<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeSalaryHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeSalaryHistoryController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 24;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'employee_id' => ['nullable', 'integer', 'min:1'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = EmployeeSalaryHistory::query()
            ->with([
                'employee:id,uuid,first_name,last_name',
                'changedBy:id,name',
            ])
            ->orderByDesc('effective_from')
            ->orderByDesc('id');

        if (!empty($validated['employee_id'])) {
            $query->where('employee_id', (int) $validated['employee_id']);
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('reason', 'like', "%{$search}%")
                    ->orWhere('source', 'like', "%{$search}%")
                    ->orWhere('previous_salary', 'like', "%{$search}%")
                    ->orWhere('new_salary', 'like', "%{$search}%")
                    ->orWhereHas('employee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        if (!empty($validated['since'])) {
            $query->where('updated_at', '>', $validated['since']);
        }

        if ($request->boolean('offline')) {
            $windowStart = now()->subMonths(self::OFFLINE_WINDOW_MONTHS);
            $query->where('updated_at', '>=', $windowStart);
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (EmployeeSalaryHistory $history): array => $this->payload($history))
                ->values()
                ->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    private function payload(EmployeeSalaryHistory $history): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $history->employee?->first_name,
            $history->employee?->last_name,
        ])));

        return [
            'id' => $history->id,
            'uuid' => $history->uuid,
            'employee_id' => $history->employee_id,
            'employee_uuid' => $history->employee?->uuid,
            'employee_name' => $employeeName !== '' ? $employeeName : null,
            'previous_salary' => $history->previous_salary !== null ? (float) $history->previous_salary : null,
            'previous_salary_currency_code' => $history->previous_salary_currency_code,
            'new_salary' => $history->new_salary !== null ? (float) $history->new_salary : null,
            'new_salary_currency_code' => $history->new_salary_currency_code,
            'effective_from' => optional($history->effective_from)->toDateString(),
            'reason' => $history->reason,
            'changed_by' => $history->changed_by,
            'changed_by_name' => $history->changedBy?->name,
            'source' => $history->source,
            'created_at' => optional($history->created_at)->toISOString(),
            'updated_at' => optional($history->updated_at)->toISOString(),
        ];
    }
}
