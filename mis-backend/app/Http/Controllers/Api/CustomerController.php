<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Http\Requests\StoreCustomerRequest;

class CustomerController extends Controller
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

        $offline = $request->boolean('offline');   // ✅ real boolean
        $since   = $validated['since'] ?? null;

        $includeDeleted = $offline || !is_null($since);

        // $includeDeleted = ! empty($validated['offline']) || ! empty($validated['since']);

        $query = Customer::query()
            ->select([
                'uuid',
                'name',
                'fname',
                'gname',
                'phone',
                'phone1',
                'email',
                'status',
                'address',
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
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('fname', 'like', "%{$search}%")
                    ->orWhere('gname', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('phone1', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
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
            ->map(fn (Customer $customer) => $this->customerPayload($customer))
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

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $data = $request->validated();

        $incomingUuid = (string) ($data['uuid'] ?? '');
        $phone = trim((string) ($data['phone'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));

        $matches = collect();

        // if ($incomingUuid !== '') {
        //     $matchByUuid = Customer::withTrashed()->where('uuid', $incomingUuid)->first();
        //     if ($matchByUuid) {
        //         $matches->push($matchByUuid);
        //     }
        // }

        // if ($phone !== '') {
        //     $matchByPhone = Customer::withTrashed()->where('phone', $phone)->first();
        //     if ($matchByPhone) {
        //         $matches->push($matchByPhone);
        //     }
        // }

        if ($email !== '') {
            $matchByEmail = Customer::withTrashed()->where('email', $email)->first();
            if ($matchByEmail) {
                $matches->push($matchByEmail);
            }
        }

        $uniqueMatches = $matches->unique('id')->values();
        if ($uniqueMatches->count() > 1) {
            return response()->json([
                'message' => 'Conflicting identifiers for customer create request.',
            ], 409);
        }

        $customer = $uniqueMatches->first();
        $created = false;
        $restored = false;

        if (! $customer) {
            $customer = new Customer();
            $customer->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($customer->trashed()) {
            $customer->restore();
            $restored = true;
        } elseif ($incomingUuid !== '' && $customer->uuid === $incomingUuid) {
            // Idempotent create retry with the same UUID.
        } else {
            return response()->json([
                'message' => 'Customer already exists.',
                'data' => $this->customerPayload($customer),
            ], 409);
        }

        $updateData = $data;
        unset($updateData['uuid']);
        $customer->fill($updateData);
        $customer->save();

        return response()->json([
            'data' => $this->customerPayload($customer->fresh()),
            'restored' => $restored,
        ], $created ? 201 : 200);
    }

    public function update(StoreCustomerRequest $request, string $uuid): JsonResponse
    {
        $customer = Customer::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($customer->trashed()) {
            $customer->restore();
        }
        $data = $request->validated();

        $customer->update($data);

        return response()->json([
            'data' => $this->customerPayload($customer->fresh()),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $customer = Customer::withTrashed()->where('uuid', $uuid)->first();
        if ($customer && ! $customer->trashed()) {
            $customer->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    private function customerPayload(Customer $customer): array
    {
        return $customer->only([
            'uuid',
            'name',
            'fname',
            'gname',
            'phone',
            'phone1',
            'email',
            'status',
            'address',
            'updated_at',
            'deleted_at',
        ]);
    }
}
