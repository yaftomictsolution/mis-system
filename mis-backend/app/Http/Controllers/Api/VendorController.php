<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVendorRequest;
use App\Models\Vendor;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VendorController extends Controller
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

        $query = Vendor::query()->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%");
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
            ->map(fn (Vendor $vendor): array => $this->payload($vendor))
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

    public function store(StoreVendorRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $email = trim((string) ($data['email'] ?? ''));

        $vendor = $incomingUuid !== ''
            ? Vendor::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        if (! $vendor && $email !== '') {
            $vendor = Vendor::withTrashed()->where('email', $email)->first();
        }

        $created = false;
        if (! $vendor) {
            $vendor = new Vendor();
            $vendor->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($vendor->trashed()) {
            $vendor->restore();
        }

        $vendor->fill([
            'name' => trim((string) $data['name']),
            'phone' => isset($data['phone']) ? trim((string) $data['phone']) ?: null : null,
            'email' => isset($data['email']) ? trim((string) $data['email']) ?: null : null,
            'address' => isset($data['address']) ? trim((string) $data['address']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? 'active')),
        ]);
        $vendor->save();

        return response()->json([
            'data' => $this->payload($vendor->fresh()),
        ], $created ? 201 : 200);
    }

    public function update(StoreVendorRequest $request, string $uuid): JsonResponse
    {
        $vendor = Vendor::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($vendor->trashed()) {
            $vendor->restore();
        }

        $data = $request->validated();
        $vendor->fill([
            'name' => trim((string) $data['name']),
            'phone' => isset($data['phone']) ? trim((string) $data['phone']) ?: null : null,
            'email' => isset($data['email']) ? trim((string) $data['email']) ?: null : null,
            'address' => isset($data['address']) ? trim((string) $data['address']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? $vendor->status)),
        ]);
        $vendor->save();

        return response()->json([
            'data' => $this->payload($vendor->fresh()),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $vendor = Vendor::withTrashed()->where('uuid', $uuid)->first();
        if ($vendor && ! $vendor->trashed()) {
            $vendor->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $vendor = Vendor::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $vendor->trashed()) {
            return response()->json([
                'message' => 'Vendor must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $vendor->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Vendor', $vendor),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function payload(Vendor $vendor): array
    {
        return [
            'id' => $vendor->id,
            'uuid' => $vendor->uuid,
            'name' => $vendor->name,
            'phone' => $vendor->phone,
            'email' => $vendor->email,
            'address' => $vendor->address,
            'status' => $vendor->status,
            'created_at' => optional($vendor->created_at)->toISOString(),
            'updated_at' => optional($vendor->updated_at)->toISOString(),
            'deleted_at' => optional($vendor->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        return strtolower(trim($value)) === 'inactive' ? 'inactive' : 'active';
    }
}
