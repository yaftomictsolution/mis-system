<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WarehouseMaterialStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseMaterialStockController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 12;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'material_id' => ['nullable', 'integer', 'min:1'],
            'warehouse_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = WarehouseMaterialStock::query()
            ->with([
                'warehouse:id,uuid,name',
                'material:id,uuid,name,unit,min_stock_level,status',
            ])
            ->orderByDesc('updated_at');

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->whereHas('warehouse', fn ($warehouseQuery) => $warehouseQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('material', function ($materialQuery) use ($search): void {
                        $materialQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('material_type', 'like', "%{$search}%")
                            ->orWhere('unit', 'like', "%{$search}%");
                    });
            });
        }

        if (! empty($validated['material_id'])) {
            $query->where('material_id', (int) $validated['material_id']);
        }
        if (! empty($validated['warehouse_id'])) {
            $query->where('warehouse_id', (int) $validated['warehouse_id']);
        }
        if (! empty($validated['since'])) {
            $query->where('updated_at', '>', $validated['since']);
        }
        if ($request->boolean('offline')) {
            $query->where('updated_at', '>=', now()->subMonths(self::OFFLINE_WINDOW_MONTHS));
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (WarehouseMaterialStock $row) => $this->payload($row))->values()->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    private function payload(WarehouseMaterialStock $row): array
    {
        return [
            'id' => $row->id,
            'uuid' => $row->uuid,
            'warehouse_id' => $row->warehouse_id,
            'warehouse_uuid' => $row->warehouse?->uuid,
            'warehouse_name' => $row->warehouse?->name,
            'material_id' => $row->material_id,
            'material_uuid' => $row->material?->uuid,
            'material_name' => $row->material?->name,
            'material_unit' => $row->material?->unit,
            'material_status' => $row->material?->status,
            'min_stock_level' => (float) ($row->material?->min_stock_level ?? 0),
            'qty_on_hand' => (float) $row->qty_on_hand,
            'qty_reserved' => (float) $row->qty_reserved,
            'qty_available' => (float) $row->qty_available,
            'created_at' => optional($row->created_at)->toISOString(),
            'updated_at' => optional($row->updated_at)->toISOString(),
        ];
    }
}
