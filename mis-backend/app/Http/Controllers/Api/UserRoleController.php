<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Roles;
use App\Http\Requests\RoleValidation;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;

class UserRoleController extends Controller
{
    public function permissionOptions(): JsonResponse
    {
        
        $configured = Config::get('permission.permissions');
        $fromConfig = collect();

        if (is_array($configured)) {
            $fromConfig = collect(Arr::flatten($configured))
                ->filter(fn ($value) => is_string($value))
                ->map(fn ($value) => trim($value))
                ->values();
        }

        $permissions = $fromConfig
            ->filter()
            ->unique()
            ->values();

        if ($permissions->isEmpty()) {
            $permissions = Permission::query()
                ->orderBy('name')
                ->pluck('name')
                ->filter()
                ->values();
        }

        return response()->json([
            'data' => $permissions->all(),
        ]);
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

        $includeDeleted = ! empty($validated['offline']) || ! empty($validated['since']);

        $query = Roles::query()
            ->select([
                'id',
                'uuid',
                'name',
                'guard_name',
                'updated_at',
                'deleted_at',
            ])->with(['permissions:id,name'])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['since'])) {
            $since = $validated['since'];
            $query->where(function ($builder) use ($since) {
                $builder
                    ->where('updated_at', '>', $since)
                    ->orWhere('deleted_at', '>', $since);
            });
        }

        if (! empty($validated['offline'])) {
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
            ->map(fn (Roles $role) => $this->UserRolePayload($role))
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

    
    public function store(RoleValidation $request): JsonResponse
    {

        $validated = $request->validated();
        $hasPermissionsField = array_key_exists('permissions', $validated);
        $data = $validated;
        $permissionNames = $this->normalizePermissionNames($data['permissions'] ?? []);
        unset($data['permissions']);
        $data['guard_name'] = $data['guard_name'] ?? 'web';
        $incomingUuid = $data['uuid'] ?? null;

        $role = $incomingUuid
            ? Roles::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;
        if (! $role) {
            $role = Roles::withTrashed()
                ->where('name', $data['name'])
                ->where('guard_name', $data['guard_name'])
                ->first();
        }

        if (! $role) {
            $data['uuid'] = $incomingUuid ?: (string) Str::uuid();
            $role = Roles::query()->create($data);
        } else {
            $role->fill(Arr::except($data, ['uuid']));
            $role->save();
        }

        if ($role->trashed()) {
            $role->restore();
        }
        if ($permissionNames !== []) {
            $role->syncPermissions($permissionNames);
        } elseif ($hasPermissionsField) {
            $role->syncPermissions([]);
        }

        return response()->json([
            'data' => $this->UserRolePayload($role->fresh()->loadMissing('permissions')),
        ], 201);
    }
    public function update(RoleValidation $request, string $uuid): JsonResponse
    {
        $validated = $request->validated();
        $hasPermissionsField = array_key_exists('permissions', $validated);
        $permissionNames = $this->normalizePermissionNames($validated['permissions'] ?? []);
        unset($validated['permissions']);

        $role = Roles::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($role->trashed()) {
            $role->restore();
        }
        $data = $validated;
        $data['guard_name'] = $data['guard_name'] ?? 'web';

        $role->update($data);
        if ($permissionNames !== []) {
            $role->syncPermissions($permissionNames);
        } elseif ($hasPermissionsField) {
            $role->syncPermissions([]);
        }

        return response()->json([
            'data' => $this->UserRolePayload($role->fresh()->loadMissing('permissions')),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $role = Roles::withTrashed()->where('uuid', $uuid)->first();
        if ($role && ! $role->trashed()) {
            $role->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }


    private function UserRolePayload(Roles $role): array
    {
        $permissions = $role->relationLoaded('permissions')
            ? $role->permissions->pluck('name')->filter()->values()->all()
            : $role->permissions()->pluck('name')->filter()->values()->all();

        return [
            'uuid' => $role->uuid,
            'name' => $role->name,
            'guard_name' => $role->guard_name,
            'permissions' => $permissions,
            'updated_at' => $role->updated_at?->toISOString(),
            'deleted_at' => $role->deleted_at?->toISOString(),
        ];
    }

    private function normalizePermissionNames(array $permissions): array
    {
        return collect($permissions)
            ->filter(fn ($name) => is_string($name))
            ->map(fn ($name) => trim($name))
            ->filter()
            ->unique(fn ($name) => mb_strtolower($name))
            ->values()
            ->all();
    }

}
