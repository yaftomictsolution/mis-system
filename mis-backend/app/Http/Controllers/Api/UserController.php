<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Illuminate\Http\JsonResponse;
use App\Http\Requests\UserRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $offline = $request->boolean('offline');   // ✅ real boolean
        $since   = $validated['since'] ?? null;

        $includeDeleted = $offline || !is_null($since);

        $query = User::query()
            ->select([
                'id',
                'uuid',
                'name',
                'full_name',
                'email',
                'updated_at',
                'deleted_at',
            ])->with(['roles:id,name'])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('full_name', 'like', "%{$search}%");
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
            ->map(fn (User $user) => $this->UserPayload($user))
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
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $incomingUuid = (string) ($request->input('uuid') ?? '');
        $existingForValidation = null;
        if ($incomingUuid !== '') {
            $existingForValidation = User::withTrashed()->where('uuid', $incomingUuid)->first();
        }

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
        ]);

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
                'data' => $this->UserPayload($user->loadMissing('roles')),
            ], 409);
        }

        $user->name = $data['name'];
        $user->full_name = $data['name'];
        $user->email = $data['email'] ?? null;
        $user->password = Hash::make($data['password']);
        $user->save();

        $role = trim((string) ($data['role'] ?? ''));
        if ($role !== '') {
            $user->syncRoles([$role]);
        }

        return response()->json([
            'data' => $this->UserPayload($user->fresh()),
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
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }
    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, string $uuid)
    {
        $user = User::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($user->trashed()) {
            $user->restore();
        }
        $data = $request->validated();
        $updateData = [
            'name' => $data['name'],
            'full_name' => $data['name'],
            'email' => $data['email'] ?? null,
        ];

        if (! empty($data['password'])) {
            $updateData['password'] = Hash::make($data['password']);
        }
        $user->fill($updateData);
        $user->save();
        if ($request->has('role')) {
            $role = trim((string) ($data['role'] ?? ''));
            if ($role !== '') {
                $user->syncRoles([$role]);
            } else {
                $user->syncRoles([]);
            }
        }
        return response()->json([
            'data' => $this->UserPayload($user->fresh()),
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $uuid)
    {
        $user = User::withTrashed()->where('uuid', $uuid)->first();
        if ($user && ! $user->trashed()) {
            $user->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    private function UserPayload(User $user): array
    {
        $roles = $user->relationLoaded('roles')
            ? $user->roles->pluck('name')->filter()->values()->all()
            : $user->roles()->pluck('name')->filter()->values()->all();

        return [
            'uuid' => $user->uuid,
            'name' => $user->full_name ?? $user->name,
            'email' => $user->email,
            'roles' => $roles,
            'updated_at' => $user->updated_at,
            'deleted_at' => $user->deleted_at?->toISOString(),
        ];
    }

     public function roleOptions(): JsonResponse
    {
        $roles = Role::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(function ($role) {
                return [
                    'id'   => $role->id,
                    'name' => $role->name,
                ];
            })
            ->values();
        return response()->json([
            'data' => $roles,
        ]);
    }

}
