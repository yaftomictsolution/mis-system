<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmployeeRequest;
use Illuminate\Http\Request;
use App\Models\Employee;
class EmployeeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse{
        
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
            ])->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
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

        if (!empty($validated['offline'])) {
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

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $data = $request->validated();

        $incomingUuid = (string) ($data['uuid'] ?? '');
        // $apartmentCode = trim((string) ($data['apartment_code'] ?? ''));
        $matches = collect();

        if ($incomingUuid !== '') {
            $matchByUuid = Employee::withTrashed()->where('uuid', $incomingUuid)->first();
            if ($matchByUuid) {
                $matches->push($matchByUuid);
            }
        }

        $uniqueMatches = $matches->unique('id')->values();
        if ($uniqueMatches->count() > 1) {
            return response()->json([
                'message' => 'Conflicting identifiers for apartment create request.',
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
        } else {
            return response()->json([
                'message' => 'Apartment already exists.',
                'data' => $this->apartmentPayload($employee),
            ], 409);
        }

        $updateData = $data;
        unset($updateData['uuid']);
        $employee->fill($updateData);
        $employee->save();

        return response()->json([
            'data' => $this->EmployeePayload($employee->fresh()),
            'restored' => $restored,
        ], $created ? 201 : 200);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }

    private function employeePayload(Employee $employee): array
    {
        $data = $employee->only([
            'id',
            'uuid',
            'first_name',
            'last_name',
            'job_title',
            'salary_type',
            'base_salary',
            'adress',
            'email',
            'phone',
            'status',
            'hire_date',
            'updated_at',
            'created_at',
        ]);
        return $data;
    }

}
