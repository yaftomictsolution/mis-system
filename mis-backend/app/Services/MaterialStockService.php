<?php

namespace App\Services;

use App\Models\Material;
use App\Models\ProjectMaterialStock;
use App\Models\WarehouseMaterialStock;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MaterialStockService
{
    public function getLegacyQuantity(Material $material): float
    {
        $warehouseOnHand = round(
            (float) WarehouseMaterialStock::query()
                ->where('material_id', $material->id)
                ->sum('qty_on_hand'),
            2
        );

        return max(0, round((float) $material->quantity - $warehouseOnHand, 2));
    }

    public function assignLegacyStock(int $materialId, int $warehouseId): WarehouseMaterialStock
    {
        $material = Material::query()->findOrFail($materialId);
        $legacyQuantity = $this->getLegacyQuantity($material);
        if ($legacyQuantity <= 0) {
            throw ValidationException::withMessages([
                'warehouse_id' => 'This material does not have any legacy stock left to assign.',
            ]);
        }

        return $this->receiveIntoWarehouse($materialId, $warehouseId, $legacyQuantity);
    }

    public function receiveIntoWarehouse(int $materialId, int $warehouseId, float $quantity): WarehouseMaterialStock
    {
        $normalized = $this->normalizeQuantity($quantity);
        $stock = $this->warehouseStock($materialId, $warehouseId);
        $stock->qty_on_hand = round((float) $stock->qty_on_hand + $normalized, 2);
        $this->persistWarehouseStock($stock);
        $this->refreshMaterialQuantity($materialId);

        return $stock;
    }

    public function reserveForRequest(int $materialId, int $warehouseId, float $quantity): WarehouseMaterialStock
    {
        $normalized = $this->normalizeQuantity($quantity);
        $stock = $this->warehouseStock($materialId, $warehouseId);
        if ((float) $stock->qty_available < $normalized) {
            throw ValidationException::withMessages([
                'warehouse_id' => 'Insufficient available warehouse stock for this material request.',
            ]);
        }

        $stock->qty_reserved = round((float) $stock->qty_reserved + $normalized, 2);
        $this->persistWarehouseStock($stock);

        return $stock;
    }

    public function releaseReservation(int $materialId, int $warehouseId, float $quantity): WarehouseMaterialStock
    {
        $normalized = $this->normalizeQuantity($quantity);
        $stock = $this->warehouseStock($materialId, $warehouseId);
        $stock->qty_reserved = max(0, round((float) $stock->qty_reserved - $normalized, 2));
        $this->persistWarehouseStock($stock);

        return $stock;
    }

    public function issueToProject(int $materialId, int $warehouseId, ?int $projectId, float $quantity): void
    {
        $normalized = $this->normalizeQuantity($quantity);
        $stock = $this->warehouseStock($materialId, $warehouseId);
        if ((float) $stock->qty_on_hand < $normalized) {
            throw ValidationException::withMessages([
                'warehouse_id' => 'Insufficient warehouse stock for this issue.',
            ]);
        }

        $stock->qty_on_hand = round((float) $stock->qty_on_hand - $normalized, 2);
        $stock->qty_reserved = max(0, round((float) $stock->qty_reserved - $normalized, 2));
        $this->persistWarehouseStock($stock);
        $this->refreshMaterialQuantity($materialId);

        if ($projectId && $projectId > 0) {
            $projectStock = $this->projectStock($materialId, $projectId);
            $projectStock->qty_issued = round((float) $projectStock->qty_issued + $normalized, 2);
            $this->persistProjectStock($projectStock);
        }
    }

    public function returnFromProject(int $materialId, int $warehouseId, ?int $projectId, float $quantity): void
    {
        $normalized = $this->normalizeQuantity($quantity);
        $this->receiveIntoWarehouse($materialId, $warehouseId, $normalized);

        if ($projectId && $projectId > 0) {
            $projectStock = $this->projectStock($materialId, $projectId);
            $projectStock->qty_returned = round((float) $projectStock->qty_returned + $normalized, 2);
            $this->persistProjectStock($projectStock);
        }
    }

    public function refreshMaterialQuantity(int $materialId): float
    {
        $totalOnHand = round(
            (float) WarehouseMaterialStock::query()
                ->where('material_id', $materialId)
                ->sum('qty_on_hand'),
            2
        );

        Material::query()->whereKey($materialId)->update(['quantity' => $totalOnHand]);

        return $totalOnHand;
    }

    private function warehouseStock(int $materialId, int $warehouseId): WarehouseMaterialStock
    {
        return WarehouseMaterialStock::query()->firstOrCreate(
            ['material_id' => $materialId, 'warehouse_id' => $warehouseId],
            [
                'uuid' => (string) Str::uuid(),
                'qty_on_hand' => 0,
                'qty_reserved' => 0,
                'qty_available' => 0,
            ]
        );
    }

    private function projectStock(int $materialId, int $projectId): ProjectMaterialStock
    {
        return ProjectMaterialStock::query()->firstOrCreate(
            ['material_id' => $materialId, 'project_id' => $projectId],
            [
                'uuid' => (string) Str::uuid(),
                'qty_issued' => 0,
                'qty_consumed' => 0,
                'qty_returned' => 0,
                'qty_on_site' => 0,
            ]
        );
    }

    private function persistWarehouseStock(WarehouseMaterialStock $stock): void
    {
        $stock->qty_on_hand = max(0, round((float) $stock->qty_on_hand, 2));
        $stock->qty_reserved = max(0, round((float) $stock->qty_reserved, 2));
        $stock->qty_available = max(0, round((float) $stock->qty_on_hand - (float) $stock->qty_reserved, 2));
        $stock->save();
    }

    private function persistProjectStock(ProjectMaterialStock $stock): void
    {
        $stock->qty_issued = max(0, round((float) $stock->qty_issued, 2));
        $stock->qty_consumed = max(0, round((float) $stock->qty_consumed, 2));
        $stock->qty_returned = max(0, round((float) $stock->qty_returned, 2));
        $stock->qty_on_site = max(
            0,
            round((float) $stock->qty_issued - (float) $stock->qty_consumed - (float) $stock->qty_returned, 2)
        );
        $stock->save();
    }

    private function normalizeQuantity(float $quantity): float
    {
        $normalized = round($quantity, 2);
        if ($normalized <= 0) {
            throw ValidationException::withMessages([
                'quantity' => 'Quantity must be greater than 0.',
            ]);
        }

        return $normalized;
    }
}
