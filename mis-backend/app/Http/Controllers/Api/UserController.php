<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\UserRequest;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class UserController extends Controller
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
        $includeDeleted = $offline || ! is_null($since);

        $query = User::query()
            ->select([
                'id',
                'uuid',
                'name',
                'full_name',
                'email',
                'customer_id',
                'updated_at',
                'deleted_at',
            ])
            ->with([
                'roles:id,name',
                'customer:id,uuid,name',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($customerQuery) use ($search): void {
                        $customerQuery->where('name', 'like', "%{$search}%");
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
            $windowStart = now()->subMonths(6);
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
            ->map(fn (User $user) => $this->userPayload($user))
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

    public function store(Request $request): JsonResponse
    {
        $incomingUuid = (string) ($request->input('uuid') ?? '');
        $existingForValidation = $incomingUuid !== ''
            ? User::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $data = $request->validate([
            'uuid' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email')
                    ->whereNull('deleted_at')
                    ->ignore($existingForValidation?->id),
            ],
            'password' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:255'],
            'customer_id' => [
                'nullable',
                'integer',
                'min:1',
                Rule::exists('customers', 'id'),
                Rule::unique('users', 'customer_id')
                    ->whereNull('deleted_at')
                    ->ignore($existingForValidation?->id),
            ],
        ]);

        $role = trim((string) ($data['role'] ?? ''));
        $customerId = (int) ($data['customer_id'] ?? 0);
        $this->validateCustomerPortalLink($role, $customerId);

        $incomingUuid = (string) ($data['uuid'] ?? '');
        $email = trim((string) ($data['email'] ?? ''));

        $user = null;
        if ($incomingUuid !== '') {
            $user = User::withTrashed()->where('uuid', $incomingUuid)->first();
        }
        if (! $user && $email !== '') {
            $user = User::withTrashed()->where('email', $email)->first();
        }

        $created = false;
        $restored = false;

        if (! $user) {
            $user = new User();
            $user->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($user->trashed()) {
            $user->restore();
            $restored = true;
        } elseif ($incomingUuid !== '' && $user->uuid === $incomingUuid) {
            // Idempotent create retry with the same UUID.
        } else {
            return response()->json([
                'message' => 'User already exists.',
                'data' => $this->userPayload($user->loadMissing(['roles', 'customer'])),
            ], 409);
        }

        $user->name = trim((string) $data['name']);
        $user->full_name = trim((string) $data['name']);
        $user->email = $data['email'] ?? null;
        $user->password = Hash::make((string) $data['password']);
        $user->customer_id = $role === 'Customer' && $customerId > 0 ? $customerId : null;
        $user->save();

        if ($role !== '') {
            $user->syncRoles([$role]);
        } else {
            $user->syncRoles([]);
        }

        return response()->json([
            'data' => $this->userPayload($user->fresh()->loadMissing(['roles', 'customer'])),
            'restored' => $restored,
        ], $created ? 201 : 200);
    }

    public function update(UserRequest $request, string $uuid): JsonResponse
    {
        $user = User::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($user->trashed()) {
            $user->restore();
        }

        $data = $request->validated();
        $role = trim((string) ($data['role'] ?? ''));
        $customerId = (int) ($data['customer_id'] ?? 0);
        $this->validateCustomerPortalLink($role, $customerId);

        $updateData = [
            'name' => trim((string) $data['name']),
            'full_name' => trim((string) $data['name']),
            'email' => $data['email'] ?? null,
            'customer_id' => $role === 'Customer' && $customerId > 0 ? $customerId : null,
        ];

        if (! empty($data['password'])) {
            $updateData['password'] = Hash::make((string) $data['password']);
        }

        $user->fill($updateData);
        $user->save();

        if ($request->has('role')) {
            if ($role !== '') {
                $user->syncRoles([$role]);
            } else {
                $user->syncRoles([]);
            }
        }

        return response()->json([
            'data' => $this->userPayload($user->fresh()->loadMissing(['roles', 'customer'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $user = User::withTrashed()->where('uuid', $uuid)->first();
        if ($user && ! $user->trashed()) {
            $user->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $user = User::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $user->trashed()) {
            return response()->json([
                'message' => 'User must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $user->syncRoles([]);
            $user->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('User', $user),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    public function roleOptions(): JsonResponse
    {
        $roles = Role::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
            ])
            ->values();

        return response()->json([
            'data' => $roles,
        ]);
    }

    private function validateCustomerPortalLink(string $role, int $customerId): void
    {
        if ($role === 'Customer' && $customerId <= 0) {
            throw ValidationException::withMessages([
                'customer_id' => ['Linked customer is required for Customer portal accounts.'],
            ]);
        }

        if ($role !== '' && $role !== 'Customer' && $customerId > 0) {
            throw ValidationException::withMessages([
                'customer_id' => ['Only the Customer role can be linked to a customer account.'],
            ]);
        }
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing(['roles', 'customer']);

        $roles = $user->relationLoaded('roles')
            ? $user->roles->pluck('name')->filter()->values()->all()
            : $user->roles()->pluck('name')->filter()->values()->all();

        return [
            'uuid' => $user->uuid,
            'name' => $user->full_name ?? $user->name,
            'email' => $user->email,
            'roles' => $roles,
            'customer_id' => $user->customer_id,
            'customer_uuid' => $user->customer?->uuid,
            'customer_name' => $user->customer?->name,
            'updated_at' => $user->updated_at?->toISOString(),
            'deleted_at' => $user->deleted_at?->toISOString(),
        ];
    }
}
