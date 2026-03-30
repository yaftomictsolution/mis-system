<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWarehouseRequest;
use App\Models\Warehouse;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WarehouseController extends Controller
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

        $query = Warehouse::query()->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
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
            ->map(fn (Warehouse $warehouse): array => $this->payload($warehouse))
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

    public function store(StoreWarehouseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $name = trim((string) ($data['name'] ?? ''));

        $warehouse = $incomingUuid !== ''
            ? Warehouse::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        if (! $warehouse && $name !== '') {
            $warehouse = Warehouse::withTrashed()->where('name', $name)->first();
        }

        $created = false;
        if (! $warehouse) {
            $warehouse = new Warehouse();
            $warehouse->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($warehouse->trashed()) {
            $warehouse->restore();
        }

        $warehouse->fill([
            'name' => $name,
            'location' => isset($data['location']) ? trim((string) $data['location']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? 'active')),
        ]);
        $warehouse->save();

        return response()->json([
            'data' => $this->payload($warehouse->fresh()),
        ], $created ? 201 : 200);
    }

    public function update(StoreWarehouseRequest $request, string $uuid): JsonResponse
    {
        $warehouse = Warehouse::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($warehouse->trashed()) {
            $warehouse->restore();
        }

        $data = $request->validated();
        $warehouse->fill([
            'name' => trim((string) $data['name']),
            'location' => isset($data['location']) ? trim((string) $data['location']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? $warehouse->status)),
        ]);
        $warehouse->save();

        return response()->json([
            'data' => $this->payload($warehouse->fresh()),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $warehouse = Warehouse::withTrashed()->where('uuid', $uuid)->first();
        if ($warehouse && ! $warehouse->trashed()) {
            $warehouse->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $warehouse = Warehouse::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $warehouse->trashed()) {
            return response()->json([
                'message' => 'Warehouse must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $warehouse->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Warehouse', $warehouse),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function payload(Warehouse $warehouse): array
    {
        return [
            'id' => $warehouse->id,
            'uuid' => $warehouse->uuid,
            'name' => $warehouse->name,
            'location' => $warehouse->location,
            'status' => $warehouse->status,
            'created_at' => optional($warehouse->created_at)->toISOString(),
            'updated_at' => optional($warehouse->updated_at)->toISOString(),
            'deleted_at' => optional($warehouse->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        return strtolower(trim($value)) === 'inactive' ? 'inactive' : 'active';
    }
}
