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
            ])
            ->orderByDesc('updated_at');

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
            $query->where('updated_at', '>', $validated['since']);
        }

        if (! empty($validated['offline'])) {
            $query->where('updated_at', '>=', now()->subMonths(6));
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => $paginator->items(),
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
  
        $data['uuid'] = $data['uuid'] ?? (string) Str::uuid();

        $customer = Customer::updateOrCreate(
            ['uuid' => $data['uuid']],
            $data
        );

        return response()->json([
            'data' => $this->customerPayload($customer),
        ], 201);
    }

    public function update(StoreCustomerRequest $request, string $uuid): JsonResponse
    {
        $customer = Customer::query()->where('uuid', $uuid)->firstOrFail();
        $data = $request->validated();

        $customer->update($data);

        return response()->json([
            'data' => $this->customerPayload($customer->fresh()),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        Customer::query()->where('uuid', $uuid)->delete();

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
        ]);
    }
}
