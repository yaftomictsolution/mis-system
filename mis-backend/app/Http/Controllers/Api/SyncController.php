<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\SyncInbox;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SyncController extends Controller
{
    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['required', 'string'],
            'entity' => ['required', 'string'],
            'uuid' => ['required', 'string'],
            'action' => ['required', 'in:create,update,delete'],
            'payload' => ['nullable', 'array'],
        ]);
        
        if (
            $validated['entity'] === 'customers'
            && in_array($validated['action'], ['create', 'update'], true)
        ) {
            $existing = Customer::query()->where('uuid', $validated['uuid'])->first();

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.phone' => [
                    'required',
                ],
                'payload.name' => ['nullable', 'string', 'max:255'],
                'payload.fname' => ['nullable', 'string', 'max:255'],
                'payload.gname' => ['nullable', 'string', 'max:255'],
                'payload.phone' => ['nullable', 'string', 'max:50'],
                'payload.status' => ['nullable', 'string', 'max:50'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('customers', 'email')->ignore($existing?->id),
                ],
                'payload.address' => ['nullable', 'string'],
            ]);
        }

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
                'user_id' => $request->user()->id,
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

    private function applyEntityOperation(string $entity, string $uuid, string $action, array $payload): void
    {
        if ($entity !== 'customers') {
            return;
        }

        if ($action === 'delete') {
            Customer::query()->where('uuid', $uuid)->delete();

            return;
        }

        Customer::query()->updateOrCreate(
            ['uuid' => $uuid],
            [
                'name' => $payload['name'] ?? null,
                'fname' => $payload['name'] ?? null,
                'gname' => $payload['gname'] ?? null,
                'phone' => $payload['phone'],
                'phone1' => $payload['phone1'] ?? null,
                'email' => $payload['email'] ?? null,
                'address' => $payload['address'] ?? null,
                'status' => $payload['status'] ?? null,
            ],
        );
    }
}

