<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCompanyAssetRequest;
use App\Models\CompanyAsset;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CompanyAssetController extends Controller
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

        $query = CompanyAsset::query()
            ->with([
                'supplier:id,uuid,name',
                'currentEmployee:id,uuid,first_name,last_name',
                'currentProject:id,uuid,name',
                'currentWarehouse:id,uuid,name',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('asset_code', 'like', "%{$search}%")
                    ->orWhere('asset_name', 'like', "%{$search}%")
                    ->orWhere('asset_type', 'like', "%{$search}%")
                    ->orWhere('serial_no', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($supplierQuery) use ($search): void {
                        $supplierQuery->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('currentEmployee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('currentProject', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('currentWarehouse', fn ($warehouseQuery) => $warehouseQuery->where('name', 'like', "%{$search}%"));
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
            ->map(fn (CompanyAsset $asset): array => $this->payload($asset))
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

    public function store(StoreCompanyAssetRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $assetCode = trim((string) ($data['asset_code'] ?? ''));

        $asset = $incomingUuid !== ''
            ? CompanyAsset::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        if (! $asset && $assetCode !== '') {
            $asset = CompanyAsset::withTrashed()->where('asset_code', $assetCode)->first();
        }

        $created = false;
        if (! $asset) {
            $asset = new CompanyAsset();
            $asset->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($asset->trashed()) {
            $asset->restore();
        }

        $asset->fill([
            'asset_code' => $assetCode,
            'asset_name' => trim((string) $data['asset_name']),
            'asset_type' => trim((string) $data['asset_type']),
            'quantity' => max(0, round((float) ($data['quantity'] ?? 0), 2)),
            'supplier_id' => isset($data['supplier_id']) ? (int) $data['supplier_id'] : null,
            'serial_no' => isset($data['serial_no']) ? trim((string) $data['serial_no']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? 'available')),
            'current_employee_id' => isset($data['current_employee_id']) ? (int) $data['current_employee_id'] : null,
            'current_project_id' => isset($data['current_project_id']) ? (int) $data['current_project_id'] : null,
            'current_warehouse_id' => isset($data['current_warehouse_id']) ? (int) $data['current_warehouse_id'] : null,
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        if ($created) {
            $asset->allocated_quantity = 0;
            $asset->maintenance_quantity = 0;
            $asset->damaged_quantity = 0;
            $asset->retired_quantity = 0;
        }
        $this->syncStatusFromQuantities($asset, (string) ($data['status'] ?? 'available'));
        $asset->save();

        return response()->json([
            'data' => $this->payload($asset->fresh(['supplier', 'currentEmployee', 'currentProject', 'currentWarehouse'])),
        ], $created ? 201 : 200);
    }

    public function update(StoreCompanyAssetRequest $request, string $uuid): JsonResponse
    {
        $asset = CompanyAsset::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($asset->trashed()) {
            $asset->restore();
        }

        $data = $request->validated();
        $asset->fill([
            'asset_code' => trim((string) $data['asset_code']),
            'asset_name' => trim((string) $data['asset_name']),
            'asset_type' => trim((string) $data['asset_type']),
            'quantity' => max(0, round((float) ($data['quantity'] ?? $asset->quantity), 2)),
            'supplier_id' => isset($data['supplier_id']) ? (int) $data['supplier_id'] : null,
            'serial_no' => isset($data['serial_no']) ? trim((string) $data['serial_no']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? $asset->status)),
            'current_employee_id' => isset($data['current_employee_id']) ? (int) $data['current_employee_id'] : null,
            'current_project_id' => isset($data['current_project_id']) ? (int) $data['current_project_id'] : null,
            'current_warehouse_id' => isset($data['current_warehouse_id']) ? (int) $data['current_warehouse_id'] : null,
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $this->syncStatusFromQuantities($asset, (string) ($data['status'] ?? $asset->status));
        $asset->save();

        return response()->json([
            'data' => $this->payload($asset->fresh(['supplier', 'currentEmployee', 'currentProject', 'currentWarehouse'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $asset = CompanyAsset::withTrashed()->where('uuid', $uuid)->first();
        if ($asset && ! $asset->trashed()) {
            $asset->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $asset = CompanyAsset::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $asset->trashed()) {
            return response()->json([
                'message' => 'Company asset must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $asset->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Company Asset', $asset),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function payload(CompanyAsset $asset): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $asset->currentEmployee?->first_name,
            $asset->currentEmployee?->last_name,
        ])));

        return [
            'id' => $asset->id,
            'uuid' => $asset->uuid,
            'asset_code' => $asset->asset_code,
            'asset_name' => $asset->asset_name,
            'asset_type' => $asset->asset_type,
            'quantity' => (float) $asset->quantity,
            'allocated_quantity' => (float) $asset->allocated_quantity,
            'maintenance_quantity' => (float) $asset->maintenance_quantity,
            'damaged_quantity' => (float) $asset->damaged_quantity,
            'retired_quantity' => (float) $asset->retired_quantity,
            'supplier_id' => $asset->supplier_id,
            'supplier_uuid' => $asset->supplier?->uuid,
            'supplier_name' => $asset->supplier?->name,
            'serial_no' => $asset->serial_no,
            'status' => $asset->status,
            'current_employee_id' => $asset->current_employee_id,
            'current_employee_uuid' => $asset->currentEmployee?->uuid,
            'current_employee_name' => $employeeName !== '' ? $employeeName : null,
            'current_project_id' => $asset->current_project_id,
            'current_project_uuid' => $asset->currentProject?->uuid,
            'current_project_name' => $asset->currentProject?->name,
            'current_warehouse_id' => $asset->current_warehouse_id,
            'current_warehouse_uuid' => $asset->currentWarehouse?->uuid,
            'current_warehouse_name' => $asset->currentWarehouse?->name,
            'notes' => $asset->notes,
            'created_at' => optional($asset->created_at)->toISOString(),
            'updated_at' => optional($asset->updated_at)->toISOString(),
            'deleted_at' => optional($asset->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        $status = strtolower(trim($value));
        return in_array($status, ['allocated', 'maintenance', 'damaged', 'retired'], true)
            ? $status
            : 'available';
    }

    private function syncStatusFromQuantities(CompanyAsset $asset, string $preferredStatus = 'available'): void
    {
        $preferred = $this->normalizeStatus($preferredStatus);
        $available = max(0, round((float) ($asset->quantity ?? 0), 2));
        $allocated = max(0, round((float) ($asset->allocated_quantity ?? 0), 2));
        $maintenance = max(0, round((float) ($asset->maintenance_quantity ?? 0), 2));
        $damaged = max(0, round((float) ($asset->damaged_quantity ?? 0), 2));
        $retired = max(0, round((float) ($asset->retired_quantity ?? 0), 2));

        if ($available > 0) {
            $asset->status = 'available';
            return;
        }

        if ($allocated > 0) {
            $asset->status = 'allocated';
            return;
        }

        if ($maintenance > 0) {
            $asset->status = 'maintenance';
            return;
        }

        if ($damaged > 0) {
            $asset->status = 'damaged';
            return;
        }

        if ($retired > 0) {
            $asset->status = 'retired';
            return;
        }

        $asset->status = $preferred;
    }
}
