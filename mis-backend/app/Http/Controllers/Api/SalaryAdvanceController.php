<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSalaryAdvanceRequest;
use App\Models\SalaryAdvance;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SalaryAdvanceController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 6;

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

        $query = SalaryAdvance::query()
            ->with([
                'employee:id,uuid,first_name,last_name',
                'user:id,name',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('status', 'like', "%{$search}%")
                    ->orWhere('reason', 'like', "%{$search}%")
                    ->orWhere('amount', 'like', "%{$search}%")
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
            ->map(fn (SalaryAdvance $advance): array => $this->payload($advance))
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

    public function store(StoreSalaryAdvanceRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');

        $advance = $incomingUuid !== ''
            ? SalaryAdvance::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $created = false;
        if (! $advance) {
            $advance = new SalaryAdvance();
            $advance->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($advance->trashed()) {
            $advance->restore();
        }

        $advance->fill([
            'employee_id' => (int) $data['employee_id'],
            'amount' => round((float) $data['amount'], 2),
            'user_id' => isset($data['user_id']) ? (int) $data['user_id'] : ($advance->user_id ?: $request->user()?->id),
            'reason' => isset($data['reason']) ? trim((string) $data['reason']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? 'pending')),
        ]);
        $advance->save();

        return response()->json([
            'data' => $this->payload($advance->fresh(['employee', 'user'])),
        ], $created ? 201 : 200);
    }

    public function update(StoreSalaryAdvanceRequest $request, string $uuid): JsonResponse
    {
        $advance = SalaryAdvance::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($advance->trashed()) {
            $advance->restore();
        }

        $data = $request->validated();
        $advance->fill([
            'employee_id' => (int) $data['employee_id'],
            'amount' => round((float) $data['amount'], 2),
            'user_id' => isset($data['user_id']) ? (int) $data['user_id'] : ($advance->user_id ?: $request->user()?->id),
            'reason' => isset($data['reason']) ? trim((string) $data['reason']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? $advance->status)),
        ]);
        $advance->save();

        return response()->json([
            'data' => $this->payload($advance->fresh(['employee', 'user'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $advance = SalaryAdvance::withTrashed()->where('uuid', $uuid)->first();
        if ($advance && ! $advance->trashed()) {
            $advance->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $advance = SalaryAdvance::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $advance->trashed()) {
            return response()->json([
                'message' => 'Salary advance must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $advance->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Salary Advance', $advance),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function payload(SalaryAdvance $advance): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $advance->employee?->first_name,
            $advance->employee?->last_name,
        ])));

        return [
            'id' => $advance->id,
            'uuid' => $advance->uuid,
            'employee_id' => $advance->employee_id,
            'employee_uuid' => $advance->employee?->uuid,
            'employee_name' => $employeeName !== '' ? $employeeName : null,
            'amount' => (float) $advance->amount,
            'user_id' => $advance->user_id,
            'user_name' => $advance->user?->name,
            'reason' => $advance->reason,
            'status' => $advance->status,
            'created_at' => optional($advance->created_at)->toISOString(),
            'updated_at' => optional($advance->updated_at)->toISOString(),
            'deleted_at' => optional($advance->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        $status = strtolower(trim($value));
        return in_array($status, ['approved', 'deducted', 'rejected'], true) ? $status : 'pending';
    }
}
