<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Roles;
use App\Models\User;
use App\Models\SyncInbox;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SyncController extends Controller
{
    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['required', 'string'],
            'entity' => ['required', Rule::in(['customers', 'roles','users'])],
            'uuid' => ['required', 'uuid'],
            'action' => ['required', 'in:create,update,delete'],
            'payload' => ['nullable', 'array'],
        ]);

        $this->validateEntityPayload(
            $request,
            $validated['entity'],
            $validated['action'],
            $validated['uuid'],
        );

        $exists = SyncInbox::query()
            ->where('idempotency_key', $validated['idempotency_key'])
            ->first();

        if ($exists) {
            return response()->json(['message' => 'Already processed'], 200);
        }

        $this->applyEntityOperation(
            $validated['entity'],
            $validated['uuid'],
            $validated['action'],
            $validated['payload'] ?? [],
        );

        try {
            SyncInbox::query()->create([
                'user_id' => optional($request->user())->id,
                'idempotency_key' => $validated['idempotency_key'],
                'entity' => $validated['entity'],
                'entity_uuid' => $validated['uuid'],
                'action' => $validated['action'],
                'processed_at' => now(),
            ]);
        } catch (QueryException $exception) {
            if ($exception->getCode() !== '23000') {
                throw $exception;
            }

            return response()->json(['message' => 'Already processed'], 200);
        }

        return response()->json([
            'message' => 'Accepted',
            'server_time' => now()->toISOString(),
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $request->validate([
            'since' => ['nullable', 'date'],
        ]);

        return response()->json([
            'message' => 'Pull endpoint skeleton',
            'since' => $request->since,
            'data' => [],
        ]);
    }

    private function validateEntityPayload(Request $request, string $entity, string $action, string $uuid): void
    {
        if ($action === 'delete') {
            return;
        }

        if ($entity === 'users') {
            $existing = User::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('users', 'email')
                        ->whereNull('deleted_at')
                        ->ignore($existing?->id),
                ],
                'payload.password' => [($action === 'create' ? 'required' : 'nullable'), 'string', 'max:255'],
            ]);

            return;
        }

        if ($entity === 'customers') {
            $existing = Customer::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.fname' => ['nullable', 'string', 'max:255'],
                'payload.gname' => ['nullable', 'string', 'max:255'],
                'payload.phone' => [
                    'required',
                    'string',
                    'max:50',
                ],
                'payload.phone1' => ['nullable', 'string', 'max:50'],
                'payload.status' => ['nullable', 'string', 'max:50'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('customers', 'email')
                        ->whereNull('deleted_at')
                        ->ignore($existing?->id),
                ],
                'payload.address' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'roles') {
            $guardName = (string) ($request->input('payload.guard_name') ?: 'web');
            $roleName = trim((string) ($request->input('payload.name') ?: ''));
            $existing = Roles::withTrashed()->where('uuid', $uuid)->first();
            if (! $existing && $roleName !== '') {
                $existing = Roles::withTrashed()
                    ->where('name', $roleName)
                    ->where('guard_name', $guardName)
                    ->first();
            }

            $request->validate([
                'payload.name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('roles', 'name')
                        ->where(fn ($query) => $query->where('guard_name', $guardName)->whereNull('deleted_at'))
                        ->ignore($existing?->id),
                ],
                'payload.guard_name' => ['nullable', 'string', 'max:255'],
                'payload.permissions' => ['nullable', 'array'],
                'payload.permissions.*' => [
                    'distinct:ignore_case',
                    'string',
                    'max:255',
                    Rule::exists('permissions', 'name')
                        ->where(fn ($query) => $query->where('guard_name', $guardName)),
                ],
            ]);
        }


    }

    private function applyEntityOperation(string $entity, string $uuid, string $action, array $payload): void
    {
        


        if ($entity === 'users') {
            if ($action === 'delete') {
                $user = User::withTrashed()->where('uuid', $uuid)->first();
                if ($user && ! $user->trashed()) {
                    $user->delete();
                }

                return;
            }

            $email = trim((string) ($payload['email'] ?? ''));
            $user = User::withTrashed()->where('uuid', $uuid)->first();
            if (! $user && $email !== '') {
                $user = User::withTrashed()->where('email', $email)->first();
            }

            if (! $user) {
                $user = new User();
                $user->uuid = $uuid;
            } elseif ($user->trashed()) {
                $user->restore();
            }

            if (array_key_exists('name', $payload)) {
                $user->name = $payload['name'];
                $user->full_name = $payload['name'];
            }
            if (array_key_exists('email', $payload)) {
                $user->email = $payload['email'] ?: null;
            }
            if (array_key_exists('password', $payload) && trim((string) $payload['password']) !== '') {
                $user->password = Hash::make((string) $payload['password']);
            } elseif (! $user->exists && empty($user->password)) {
                $user->password = Hash::make(Str::random(32));
            }
            $user->save();

            return;
        }



        if ($entity === 'customers') {
            if ($action === 'delete') {
                $customer = Customer::withTrashed()->where('uuid', $uuid)->first();
                if ($customer && ! $customer->trashed()) {
                    $customer->delete();
                }

                return;
            }

            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));

            $customer = Customer::withTrashed()->where('uuid', $uuid)->first();
            if (! $customer && $phone !== '') {
                $customer = Customer::withTrashed()->where('phone', $phone)->first();
            }
            if (! $customer && $email !== '') {
                $customer = Customer::withTrashed()->where('email', $email)->first();
            }

            if (! $customer) {
                $customer = new Customer();
                $customer->uuid = $uuid;
            } elseif ($customer->trashed()) {
                $customer->restore();
            }

            if (array_key_exists('name', $payload)) {
                $customer->name = $payload['name'];
            }
            if (array_key_exists('fname', $payload)) {
                $customer->fname = $payload['fname'];
            }
            if (array_key_exists('gname', $payload)) {
                $customer->gname = $payload['gname'];
            }
            if (array_key_exists('phone', $payload)) {
                $customer->phone = $payload['phone'];
            }
            if (array_key_exists('phone1', $payload)) {
                $customer->phone1 = $payload['phone1'];
            }
            if (array_key_exists('email', $payload)) {
                $customer->email = $payload['email'] ?: null;
            }
            if (array_key_exists('address', $payload)) {
                $customer->address = $payload['address'];
            }
            if (array_key_exists('status', $payload)) {
                $customer->status = $payload['status'];
            }
            $customer->save();

            return;
        }

        if ($entity === 'roles') {
            if ($action === 'delete') {
                $role = Roles::withTrashed()->where('uuid', $uuid)->first();
                if ($role && ! $role->trashed()) {
                    $role->delete();
                }
                return;
            }

            $guardName = $payload['guard_name'] ?? 'web';
            $role = Roles::withTrashed()->where('uuid', $uuid)->first();
            if (! $role) {
                $role = Roles::withTrashed()
                    ->where('name', $payload['name'] ?? null)
                    ->where('guard_name', $guardName)
                    ->first();
            }

            if (! $role) {
                $role = Roles::query()->create([
                    'uuid' => $uuid,
                    'name' => $payload['name'] ?? null,
                    'guard_name' => $guardName,
                ]);
            } else {
                $role->fill([
                    'name' => $payload['name'] ?? null,
                    'guard_name' => $guardName,
                ]);
                $role->save();
            }

            if ($role->trashed()) {
                $role->restore();
            }
            if (array_key_exists('permissions', $payload)) {
                $permissionNames = collect((array) $payload['permissions'])
                    ->filter(fn ($name) => is_string($name))
                    ->map(fn ($name) => trim($name))
                    ->filter()
                    ->unique(fn ($name) => mb_strtolower($name))
                    ->values()
                    ->all();
                $role->syncPermissions($permissionNames);
            }
        }
    }
}
