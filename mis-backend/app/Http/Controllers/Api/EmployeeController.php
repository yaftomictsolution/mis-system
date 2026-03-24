<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmployeeRequest;
use App\Models\Employee;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EmployeeController extends Controller
{
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

        $query = Employee::query()
            ->select([
                'id',
                'uuid',
                'first_name',
                'last_name',
                'job_title',
                'salary_type',
                'base_salary',
                'address',
                'email',
                'phone',
                'status',
                'hire_date',
                'updated_at',
                'deleted_at',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('job_title', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('base_salary', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['since'])) {
            $query->where(function ($builder) use ($validated) {
                $builder
                    ->where('updated_at', '>', $validated['since'])
                    ->orWhere('deleted_at', '>', $validated['since']);
            });
        }

        if ($offline) {
            $windowStart = now()->subMonths(6);
            $query->where(function ($builder) use ($windowStart) {
                $builder
                    ->where('updated_at', '>=', $windowStart)
                    ->orWhere(function ($deleted) use ($windowStart) {
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
            ->map(fn (Employee $employee) => $this->employeePayload($employee))
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

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $data = $request->validated();

        $incomingUuid = (string) ($data['uuid'] ?? '');
        $email = trim((string) ($data['email'] ?? ''));
        $matches = collect();

        if ($incomingUuid !== '') {
            $matchByUuid = Employee::withTrashed()->where('uuid', $incomingUuid)->first();
            if ($matchByUuid) {
                $matches->push($matchByUuid);
            }
        }

        if ($email !== '') {
            $matchByEmail = Employee::withTrashed()->where('email', $email)->first();
            if ($matchByEmail) {
                $matches->push($matchByEmail);
            }
        }

        $uniqueMatches = $matches->unique('id')->values();
        if ($uniqueMatches->count() > 1) {
            return response()->json([
                'message' => 'Conflicting identifiers for employee create request.',
            ], 409);
        }

        $employee = $uniqueMatches->first();
        $created = false;
        $restored = false;

        if (!$employee) {
            $employee = new Employee();
            $employee->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($employee->trashed()) {
            $employee->restore();
            $restored = true;
        } elseif ($incomingUuid !== '' && $employee->uuid === $incomingUuid) {
            // Idempotent create retry.
        } else {
            return response()->json([
                'message' => 'Employee already exists.',
                'data' => $this->employeePayload($employee),
            ], 409);
        }

        $updateData = $data;
        unset($updateData['uuid']);
        $employee->fill($updateData);
        $employee->save();

        return response()->json([
            'data' => $this->employeePayload($employee->fresh()),
            'restored' => $restored,
        ], $created ? 201 : 200);
    }

    public function update(StoreEmployeeRequest $request, string $uuid): JsonResponse
    {
        $employee = Employee::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($employee->trashed()) {
            $employee->restore();
        }

        $data = $request->validated();
        unset($data['uuid']);
        $employee->fill($data);
        $employee->save();

        return response()->json([
            'data' => $this->employeePayload($employee->fresh(['documents'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $employee = Employee::withTrashed()->where('uuid', $uuid)->first();
        if ($employee && !$employee->trashed()) {
            $employee->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $employee = Employee::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (!$employee->trashed()) {
            return response()->json([
                'message' => 'Employee must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $employee->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Employee', $employee),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function employeePayload(Employee $employee): array
    {
        return $employee->only([
            'id',
            'uuid',
            'first_name',
            'last_name',
            'job_title',
            'salary_type',
            'base_salary',
            'address',
            'email',
            'phone',
            'status',
            'hire_date',
            'updated_at',
            'created_at',
            'deleted_at',
        ]);
    }
}


