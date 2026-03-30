<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockMovementController extends Controller
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
            'movement_type' => ['nullable', 'string', 'max:50'],
            'material_id' => ['nullable', 'integer', 'min:1'],
            'warehouse_id' => ['nullable', 'integer', 'min:1'],
            'project_id' => ['nullable', 'integer', 'min:1'],
        ]);

        $offline = $request->boolean('offline');
        $since = $validated['since'] ?? null;

        $query = StockMovement::query()
            ->with([
                'material:id,uuid,name,unit',
                'warehouse:id,uuid,name',
                'project:id,uuid,name',
                'employee:id,uuid,first_name,last_name,email',
                'approvedByUser:id,name',
                'issuedByUser:id,name',
                'materialRequestItem:id,uuid',
            ])
            ->orderByDesc('movement_date')
            ->orderByDesc('id');

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('movement_type', 'like', "%{$search}%")
                    ->orWhere('reference_type', 'like', "%{$search}%")
                    ->orWhere('reference_no', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('material', fn ($materialQuery) => $materialQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('warehouse', fn ($warehouseQuery) => $warehouseQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('employee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        if (! empty($validated['movement_type'])) {
            $query->where('movement_type', trim((string) $validated['movement_type']));
        }
        if (! empty($validated['material_id'])) {
            $query->where('material_id', (int) $validated['material_id']);
        }
        if (! empty($validated['warehouse_id'])) {
            $query->where('warehouse_id', (int) $validated['warehouse_id']);
        }
        if (! empty($validated['project_id'])) {
            $query->where('project_id', (int) $validated['project_id']);
        }

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        if ($offline) {
            $windowStart = now()->subMonths(self::OFFLINE_WINDOW_MONTHS);
            $query->where('updated_at', '>=', $windowStart);
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginator->items())
            ->map(fn (StockMovement $movement): array => $this->payload($movement))
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

    private function payload(StockMovement $movement): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $movement->employee?->first_name,
            $movement->employee?->last_name,
        ])));

        return [
            'id' => $movement->id,
            'uuid' => $movement->uuid,
            'material_id' => $movement->material_id,
            'material_uuid' => $movement->material?->uuid,
            'material_name' => $movement->material?->name,
            'material_unit' => $movement->material?->unit,
            'warehouse_id' => $movement->warehouse_id,
            'warehouse_uuid' => $movement->warehouse?->uuid,
            'warehouse_name' => $movement->warehouse?->name,
            'project_id' => $movement->project_id,
            'project_uuid' => $movement->project?->uuid,
            'project_name' => $movement->project?->name,
            'employee_id' => $movement->employee_id,
            'employee_uuid' => $movement->employee?->uuid,
            'employee_name' => $employeeName !== '' ? $employeeName : null,
            'material_request_item_id' => $movement->material_request_item_id,
            'material_request_item_uuid' => $movement->materialRequestItem?->uuid,
            'quantity' => (float) $movement->quantity,
            'movement_type' => $movement->movement_type,
            'reference_type' => $movement->reference_type,
            'reference_no' => $movement->reference_no,
            'approved_by_user_id' => $movement->approved_by_user_id,
            'approved_by_user_name' => $movement->approvedByUser?->name,
            'issued_by_user_id' => $movement->issued_by_user_id,
            'issued_by_user_name' => $movement->issuedByUser?->name,
            'movement_date' => optional($movement->movement_date)->toISOString(),
            'notes' => $movement->notes,
            'created_at' => optional($movement->created_at)->toISOString(),
            'updated_at' => optional($movement->updated_at)->toISOString(),
        ];
    }
}
