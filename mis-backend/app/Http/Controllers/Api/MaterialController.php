<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignLegacyMaterialStockRequest;
use App\Http\Requests\StoreMaterialRequest;
use App\Models\Material;
use App\Models\StockMovement;
use App\Services\MaterialStockService;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaterialController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 6;

    public function __construct(
        private readonly MaterialStockService $materialStocks
    ) {
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

        $offline = $request->boolean('offline');
        $since = $validated['since'] ?? null;
        $includeDeleted = $offline || !is_null($since);

        $query = Material::query()
            ->with(['supplier:id,uuid,name'])
            ->withSum('warehouseMaterialStocks as warehouse_stock_total', 'qty_on_hand')
            ->withCount('warehouseMaterialStocks as warehouse_stock_records_count')
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('material_type', 'like', "%{$search}%")
                    ->orWhere('unit', 'like', "%{$search}%")
                    ->orWhere('batch_no', 'like', "%{$search}%")
                    ->orWhere('serial_no', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($supplierQuery) use ($search): void {
                        $supplierQuery->where('name', 'like', "%{$search}%");
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
            ->map(fn (Material $material): array => $this->payload($material))
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

    public function store(StoreMaterialRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $openingQuantity = round((float) ($data['quantity'] ?? 0), 2);
        $openingWarehouseId = isset($data['opening_warehouse_id']) ? (int) $data['opening_warehouse_id'] : null;

        if ($openingQuantity > 0 && ! $openingWarehouseId) {
            return response()->json([
                'message' => 'Select a warehouse for the opening stock quantity.',
                'errors' => ['opening_warehouse_id' => ['Opening warehouse is required when quantity is greater than 0.']],
            ], 422);
        }

        $material = $incomingUuid !== ''
            ? Material::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $created = false;
        if (! $material) {
            $material = new Material();
            $material->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($material->trashed()) {
            $material->restore();
        }

        DB::transaction(function () use ($material, $data, $openingQuantity, $openingWarehouseId): void {
            $hasStructuredStock = $material->warehouseMaterialStocks()->exists();

            $material->fill([
                'name' => trim((string) $data['name']),
                'material_type' => isset($data['material_type']) ? trim((string) $data['material_type']) ?: null : null,
                'unit' => trim((string) $data['unit']),
                'quantity' => $hasStructuredStock ? (float) $material->quantity : $openingQuantity,
                'reference_unit_price' => array_key_exists('reference_unit_price', $data) && $data['reference_unit_price'] !== null
                    ? round((float) $data['reference_unit_price'], 2)
                    : null,
                'supplier_id' => isset($data['supplier_id']) ? (int) $data['supplier_id'] : null,
                'batch_no' => isset($data['batch_no']) ? trim((string) $data['batch_no']) ?: null : null,
                'serial_no' => isset($data['serial_no']) ? trim((string) $data['serial_no']) ?: null : null,
                'expiry_date' => $data['expiry_date'] ?? null,
                'min_stock_level' => round((float) ($data['min_stock_level'] ?? 0), 2),
                'status' => $this->normalizeStatus((string) ($data['status'] ?? 'active')),
                'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
            ]);
            $material->save();

            $this->applyOpeningWarehouseStock(
                $material,
                $openingQuantity,
                $openingWarehouseId,
                isset($data['notes']) ? trim((string) $data['notes']) ?: null : null
            );
        });

        return response()->json([
            'data' => $this->payload($this->materialForPayload($material->id)),
        ], $created ? 201 : 200);
    }

    public function update(StoreMaterialRequest $request, string $uuid): JsonResponse
    {
        $material = Material::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($material->trashed()) {
            $material->restore();
        }

        $data = $request->validated();
        $openingQuantity = round((float) ($data['quantity'] ?? $material->quantity), 2);
        $openingWarehouseId = isset($data['opening_warehouse_id']) ? (int) $data['opening_warehouse_id'] : null;
        $hasStructuredStock = $material->warehouseMaterialStocks()->exists();

        if (! $hasStructuredStock && $openingQuantity > 0 && ! $openingWarehouseId) {
            return response()->json([
                'message' => 'Select a warehouse before saving legacy stock quantities.',
                'errors' => ['opening_warehouse_id' => ['Opening warehouse is required while this material still has unassigned stock.']],
            ], 422);
        }

        DB::transaction(function () use ($material, $data, $hasStructuredStock, $openingQuantity, $openingWarehouseId): void {
            $material->fill([
                'name' => trim((string) $data['name']),
                'material_type' => isset($data['material_type']) ? trim((string) $data['material_type']) ?: null : null,
                'unit' => trim((string) $data['unit']),
                'quantity' => $hasStructuredStock ? (float) $material->quantity : $openingQuantity,
                'reference_unit_price' => array_key_exists('reference_unit_price', $data)
                    ? ($data['reference_unit_price'] !== null ? round((float) $data['reference_unit_price'], 2) : null)
                    : $material->reference_unit_price,
                'supplier_id' => isset($data['supplier_id']) ? (int) $data['supplier_id'] : null,
                'batch_no' => isset($data['batch_no']) ? trim((string) $data['batch_no']) ?: null : null,
                'serial_no' => isset($data['serial_no']) ? trim((string) $data['serial_no']) ?: null : null,
                'expiry_date' => $data['expiry_date'] ?? null,
                'min_stock_level' => round((float) ($data['min_stock_level'] ?? 0), 2),
                'status' => $this->normalizeStatus((string) ($data['status'] ?? $material->status)),
                'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
            ]);
            $material->save();

            if (! $hasStructuredStock) {
                $this->applyOpeningWarehouseStock(
                    $material,
                    $openingQuantity,
                    $openingWarehouseId,
                    isset($data['notes']) ? trim((string) $data['notes']) ?: null : null
                );
            }
        });

        return response()->json([
            'data' => $this->payload($this->materialForPayload($material->id)),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $material = Material::withTrashed()->where('uuid', $uuid)->first();
        if ($material && ! $material->trashed()) {
            $material->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $material = Material::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $material->trashed()) {
            return response()->json([
                'message' => 'Material must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $material->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Material', $material),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    public function assignLegacyStock(AssignLegacyMaterialStockRequest $request, string $uuid): JsonResponse
    {
        $material = Material::query()->where('uuid', $uuid)->firstOrFail();
        $warehouseId = (int) $request->validated('warehouse_id');
        $notes = trim((string) ($request->validated('notes') ?? '')) ?: null;
        $legacyQuantity = $this->materialStocks->getLegacyQuantity($material);

        if ($legacyQuantity <= 0) {
            return response()->json(['message' => 'This material has no legacy stock left to assign.'], 409);
        }

        DB::transaction(function () use ($material, $warehouseId, $legacyQuantity, $notes): void {
            $this->materialStocks->assignLegacyStock($material->id, $warehouseId);
            $this->createOpeningBalanceMovement($material, $warehouseId, $legacyQuantity, $notes);
        });

        return response()->json([
            'data' => $this->payload($this->materialForPayload($material->id)),
        ]);
    }

    private function payload(Material $material): array
    {
        $warehouseStockTotal = round((float) ($material->warehouse_stock_total ?? $material->warehouseMaterialStocks()->sum('qty_on_hand')), 2);
        $legacyQuantity = max(0, round((float) $material->quantity - $warehouseStockTotal, 2));
        $hasWarehouseStock = ((int) ($material->warehouse_stock_records_count ?? $material->warehouseMaterialStocks()->count())) > 0;

        return [
            'id' => $material->id,
            'uuid' => $material->uuid,
            'name' => $material->name,
            'material_type' => $material->material_type,
            'unit' => $material->unit,
            'quantity' => (float) $material->quantity,
            'reference_unit_price' => $material->reference_unit_price !== null ? (float) $material->reference_unit_price : null,
            'has_warehouse_stock' => $hasWarehouseStock,
            'legacy_quantity' => $legacyQuantity,
            'supplier_id' => $material->supplier_id,
            'supplier_uuid' => $material->supplier?->uuid,
            'supplier_name' => $material->supplier?->name,
            'batch_no' => $material->batch_no,
            'serial_no' => $material->serial_no,
            'expiry_date' => optional($material->expiry_date)->toDateString(),
            'min_stock_level' => (float) $material->min_stock_level,
            'status' => $material->status,
            'notes' => $material->notes,
            'created_at' => optional($material->created_at)->toISOString(),
            'updated_at' => optional($material->updated_at)->toISOString(),
            'deleted_at' => optional($material->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        return strtolower(trim($value)) === 'inactive' ? 'inactive' : 'active';
    }

    private function applyOpeningWarehouseStock(Material $material, float $requestedQuantity, ?int $warehouseId, ?string $notes): void
    {
        if (! $warehouseId || $warehouseId <= 0) {
            return;
        }

        $legacyQuantity = $this->materialStocks->getLegacyQuantity($material);
        if ($legacyQuantity > 0) {
            $this->materialStocks->assignLegacyStock($material->id, $warehouseId);
            $this->createOpeningBalanceMovement($material, $warehouseId, $legacyQuantity, $notes);
            return;
        }

        if ($requestedQuantity <= 0) {
            return;
        }

        $this->materialStocks->receiveIntoWarehouse($material->id, $warehouseId, $requestedQuantity);
        $this->createOpeningBalanceMovement($material, $warehouseId, $requestedQuantity, $notes);
    }

    private function createOpeningBalanceMovement(Material $material, int $warehouseId, float $quantity, ?string $notes): void
    {
        StockMovement::query()->create([
            'uuid' => (string) Str::uuid(),
            'material_id' => $material->id,
            'warehouse_id' => $warehouseId,
            'project_id' => null,
            'employee_id' => null,
            'material_request_item_id' => null,
            'quantity' => round($quantity, 2),
            'movement_type' => 'IN',
            'reference_type' => 'opening_balance',
            'reference_no' => 'MOB-' . str_pad((string) $material->id, 6, '0', STR_PAD_LEFT),
            'approved_by_user_id' => null,
            'issued_by_user_id' => null,
            'movement_date' => now(),
            'notes' => $notes,
        ]);
    }

    private function materialForPayload(int $materialId): Material
    {
        return Material::query()
            ->with(['supplier:id,uuid,name'])
            ->withSum('warehouseMaterialStocks as warehouse_stock_total', 'qty_on_hand')
            ->withCount('warehouseMaterialStocks as warehouse_stock_records_count')
            ->findOrFail($materialId);
    }
}
