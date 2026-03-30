"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
  CompanyAssetRow,
  MaterialRow,
  ProjectMaterialStockRow,
  WarehouseMaterialStockRow,
  WarehouseRow,
} from "@/db/localDB";
import { notifyError } from "@/lib/notify";
import {
  companyAssetsListLocal,
  companyAssetsPullToLocal,
  materialAssignLegacyStock,
  materialsListLocal,
  materialsPullToLocal,
  warehousesListLocal,
  warehousesPullToLocal,
} from "@/modules/inventories/inventories.repo";
import {
  projectMaterialStocksListLocal,
  projectMaterialStocksPullToLocal,
  warehouseMaterialStocksListLocal,
  warehouseMaterialStocksPullToLocal,
} from "@/modules/material-stocks/material-stocks.repo";

type WarehouseStockSyncEntity =
  | "materials"
  | "company_assets"
  | "warehouses"
  | "warehouse_material_stocks"
  | "project_material_stocks";

type SyncCompleteDetail = { syncedAny?: boolean; cleaned?: boolean; entities?: string[] };

type AssetWarehouseRow = {
  key: string;
  warehouse_name: string;
  asset_name: string;
  asset_type: string;
  available: number;
  maintenance: number;
  damaged: number;
  retired: number;
  total: number;
};

type AllocatedAssetRow = {
  key: string;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  warehouse_name: string;
  allocated_quantity: number;
};

type LegacyMaterialRow = {
  key: string;
  uuid: string;
  material_name: string;
  unit: string;
  legacy_quantity: number;
};

type AssignState = {
  uuid: string;
  material_name: string;
  legacy_quantity: number;
};

const LOCAL_PAGE_SIZE = 5000;
const TABLE_PAGE_SIZE = 12;
const SYNC_ENTITIES = new Set<WarehouseStockSyncEntity>([
  "materials",
  "company_assets",
  "warehouses",
  "warehouse_material_stocks",
  "project_material_stocks",
]);

function qty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function stockBadge(onHand: number, available: number, minStockLevel: number) {
  if (onHand <= 0) {
    return <Badge color="slate">empty</Badge>;
  }
  if (minStockLevel > 0 && available <= minStockLevel) {
    return <Badge color="amber">low stock</Badge>;
  }
  return <Badge color="emerald">in warehouse</Badge>;
}

function projectStockBadge(onSite: number) {
  if (onSite <= 0) return <Badge color="slate">cleared</Badge>;
  return <Badge color="blue">on site</Badge>;
}

export default function WarehouseStockPage() {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [assets, setAssets] = useState<CompanyAssetRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseMaterialStockRow[]>([]);
  const [projectStocks, setProjectStocks] = useState<ProjectMaterialStockRow[]>([]);
  const [assignTarget, setAssignTarget] = useState<AssignState | null>(null);
  const [assignWarehouseId, setAssignWarehouseId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const loadLocal = useCallback(async () => {
    const [materialPage, assetPage, warehousePage, warehouseStockPage, projectStockPage] = await Promise.all([
      materialsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      companyAssetsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehousesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehouseMaterialStocksListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      projectMaterialStocksListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
    ]);

    setMaterials(materialPage.items);
    setAssets(assetPage.items);
    setWarehouses(warehousePage.items);
    setWarehouseStocks(warehouseStockPage.items);
    setProjectStocks(projectStockPage.items);
  }, []);

  const refresh = useCallback(
    async (options?: { showLoader?: boolean; entitiesToPull?: WarehouseStockSyncEntity[] }) => {
      const showLoader = options?.showLoader ?? true;
      const entitiesToPull =
        options?.entitiesToPull ?? ["materials", "company_assets", "warehouses", "warehouse_material_stocks", "project_material_stocks"];

      if (showLoader) setLoading(true);
      try {
        await loadLocal();
        if (!entitiesToPull.length) return;

        let pullFailed = false;
        try {
          const tasks: Promise<unknown>[] = [];
          if (entitiesToPull.includes("materials")) tasks.push(materialsPullToLocal());
          if (entitiesToPull.includes("company_assets")) tasks.push(companyAssetsPullToLocal());
          if (entitiesToPull.includes("warehouses")) tasks.push(warehousesPullToLocal());
          if (entitiesToPull.includes("warehouse_material_stocks")) tasks.push(warehouseMaterialStocksPullToLocal());
          if (entitiesToPull.includes("project_material_stocks")) tasks.push(projectMaterialStocksPullToLocal());
          await Promise.all(tasks);
        } catch {
          pullFailed = true;
        }

        await loadLocal();
        if (pullFailed && materials.length === 0 && assets.length === 0 && warehouseStocks.length === 0 && projectStocks.length === 0) {
          notifyError("Unable to refresh warehouse stock from server. Using local data only.");
        }
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [assets.length, loadLocal, materials.length, projectStocks.length, warehouseStocks.length]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<SyncCompleteDetail>).detail;
      if (detail?.cleaned) {
        void refresh({ showLoader: false, entitiesToPull: [] });
        return;
      }

      const entities = Array.isArray(detail?.entities) ? detail.entities : [];
      const touched = entities.filter((entity): entity is WarehouseStockSyncEntity => SYNC_ENTITIES.has(entity as WarehouseStockSyncEntity));
      if (!touched.length) return;
      void refresh({ showLoader: false, entitiesToPull: touched });
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  const assetWarehouseRows = useMemo<AssetWarehouseRow[]>(() => {
    const grouped = new Map<string, AssetWarehouseRow>();

    for (const asset of assets) {
      if (!asset.current_warehouse_id) continue;
      const key = `${asset.current_warehouse_id}:${asset.asset_code}`;
      const current = grouped.get(key) ?? {
        key,
        warehouse_name: asset.current_warehouse_name || "Unknown warehouse",
        asset_name: `${asset.asset_name}${asset.asset_code ? ` (${asset.asset_code})` : ""}`,
        asset_type: asset.asset_type,
        available: 0,
        maintenance: 0,
        damaged: 0,
        retired: 0,
        total: 0,
      };

      current.available += Number(asset.quantity ?? 0);
      current.maintenance += Number(asset.maintenance_quantity ?? 0);
      current.damaged += Number(asset.damaged_quantity ?? 0);
      current.retired += Number(asset.retired_quantity ?? 0);
      current.total +=
        Number(asset.quantity ?? 0) +
        Number(asset.maintenance_quantity ?? 0) +
        Number(asset.damaged_quantity ?? 0) +
        Number(asset.retired_quantity ?? 0);

      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((left, right) => right.total - left.total);
  }, [assets]);

  const allocatedAssets = useMemo<AllocatedAssetRow[]>(
    () =>
      assets
        .filter((asset) => Number(asset.allocated_quantity ?? 0) > 0)
        .map((asset) => ({
          key: asset.uuid,
          asset_code: asset.asset_code,
          asset_name: asset.asset_name,
          asset_type: asset.asset_type,
          warehouse_name: asset.current_warehouse_name || "-",
          allocated_quantity: Number(asset.allocated_quantity ?? 0),
        }))
        .sort((left, right) => right.allocated_quantity - left.allocated_quantity),
    [assets]
  );

  const legacyMaterialRows = useMemo<LegacyMaterialRow[]>(
    () =>
      materials
        .filter((material) => Number(material.legacy_quantity ?? 0) > 0.0001)
        .map((material) => ({
          key: material.uuid,
          uuid: material.uuid,
          material_name: material.name,
          unit: material.unit,
          legacy_quantity: Number(material.legacy_quantity ?? 0),
        }))
        .sort((left, right) => right.legacy_quantity - left.legacy_quantity),
    [materials]
  );

  const summary = useMemo(
    () => ({
      warehousesWithMaterialStock: new Set(warehouseStocks.map((row) => row.warehouse_name || row.warehouse_id)).size,
      materialLines: warehouseStocks.length,
      projectMaterialLines: projectStocks.filter((row) => Number(row.qty_on_site) > 0.0001).length,
      storedAssets: assetWarehouseRows.reduce((sum, row) => sum + row.total, 0),
      allocatedAssets: allocatedAssets.reduce((sum, row) => sum + row.allocated_quantity, 0),
    }),
    [allocatedAssets, assetWarehouseRows, projectStocks, warehouseStocks]
  );

  const materialColumns = useMemo<Column<WarehouseMaterialStockRow>[]>(
    () => [
      { key: "warehouse_name", label: "Warehouse", render: (item) => <span className="font-semibold">{item.warehouse_name || "-"}</span> },
      { key: "material_name", label: "Material", render: (item) => item.material_name || "-" },
      { key: "material_unit", label: "Unit", render: (item) => item.material_unit || "-" },
      { key: "qty_on_hand", label: "On Hand", render: (item) => qty(item.qty_on_hand) },
      { key: "qty_reserved", label: "Reserved", render: (item) => qty(item.qty_reserved) },
      { key: "qty_available", label: "Available", render: (item) => qty(item.qty_available) },
      { key: "min_stock_level", label: "Min Level", render: (item) => qty(item.min_stock_level) },
      { key: "status", label: "Status", render: (item) => stockBadge(item.qty_on_hand, item.qty_available, item.min_stock_level) },
    ],
    []
  );

  const projectMaterialColumns = useMemo<Column<ProjectMaterialStockRow>[]>(
    () => [
      { key: "project_name", label: "Project", render: (item) => <span className="font-semibold">{item.project_name || "-"}</span> },
      { key: "material_name", label: "Material", render: (item) => item.material_name || "-" },
      { key: "material_unit", label: "Unit", render: (item) => item.material_unit || "-" },
      { key: "qty_issued", label: "Issued", render: (item) => qty(item.qty_issued) },
      { key: "qty_returned", label: "Returned", render: (item) => qty(item.qty_returned) },
      { key: "qty_on_site", label: "On Site", render: (item) => qty(item.qty_on_site) },
      { key: "status", label: "Status", render: (item) => projectStockBadge(item.qty_on_site) },
    ],
    []
  );

  const assetColumns = useMemo<Column<AssetWarehouseRow>[]>(
    () => [
      { key: "warehouse_name", label: "Warehouse", render: (item) => <span className="font-semibold">{item.warehouse_name}</span> },
      { key: "asset_name", label: "Asset", render: (item) => item.asset_name },
      { key: "asset_type", label: "Type", render: (item) => item.asset_type },
      { key: "available", label: "Available", render: (item) => String(item.available) },
      { key: "maintenance", label: "Maintenance", render: (item) => String(item.maintenance) },
      { key: "damaged", label: "Damaged", render: (item) => String(item.damaged) },
      { key: "retired", label: "Retired", render: (item) => String(item.retired) },
      { key: "total", label: "Total Stored", render: (item) => String(item.total) },
    ],
    []
  );

  const allocatedColumns = useMemo<Column<AllocatedAssetRow>[]>(
    () => [
      { key: "asset_code", label: "Code", render: (item) => <span className="font-semibold">{item.asset_code}</span> },
      { key: "asset_name", label: "Asset", render: (item) => item.asset_name },
      { key: "asset_type", label: "Type", render: (item) => item.asset_type },
      { key: "warehouse_name", label: "Warehouse", render: (item) => item.warehouse_name },
      { key: "allocated_quantity", label: "Allocated Qty", render: (item) => qty(item.allocated_quantity) },
    ],
    []
  );

  const legacyColumns = useMemo<Column<LegacyMaterialRow>[]>(
    () => [
      { key: "material_name", label: "Material", render: (item) => <span className="font-semibold">{item.material_name}</span> },
      { key: "unit", label: "Unit", render: (item) => item.unit || "-" },
      { key: "legacy_quantity", label: "Legacy Quantity", render: (item) => qty(item.legacy_quantity) },
      {
        key: "action",
        label: "Action",
        render: (item) => (
          <button
            type="button"
            onClick={() => {
              setAssignTarget({
                uuid: item.uuid,
                material_name: item.material_name,
                legacy_quantity: item.legacy_quantity,
              });
              setAssignWarehouseId("");
              setAssignNote("");
              setAssignError(null);
            }}
            className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
          >
            Assign To Warehouse
          </button>
        ),
      },
    ],
    []
  );

  const submitAssignLegacyStock = useCallback(async () => {
    if (!assignTarget || assigning) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await materialAssignLegacyStock(assignTarget.uuid, Number(assignWarehouseId), assignNote);
      setAssignTarget(null);
      setAssignWarehouseId("");
      setAssignNote("");
      await refresh({
        showLoader: false,
        entitiesToPull: ["materials", "warehouse_material_stocks", "project_material_stocks"],
      });
    } catch (error: unknown) {
      setAssignError(error instanceof Error ? error.message : "Unable to assign legacy stock.");
    } finally {
      setAssigning(false);
    }
  }, [assignNote, assignTarget, assignWarehouseId, assigning, refresh]);

  return (
    <RequirePermission permission={["warehouse_stock.view", "inventory.request"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Warehouse Stock"
          subtitle="Materials and company assets are now both warehouse-based stock views. Materials are consumable balances, while company assets are reusable stock quantities with allocation history."
        >
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
          >
            Sync Warehouse Stock
          </button>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Warehouses With Material Stock", value: summary.warehousesWithMaterialStock },
            { label: "Warehouse Material Lines", value: summary.materialLines },
            { label: "Project Material Lines", value: summary.projectMaterialLines },
            { label: "Stored Company Assets", value: summary.storedAssets },
            { label: "Allocated / Out of Warehouse", value: summary.allocatedAssets },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="text-sm font-medium text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>

        {legacyMaterialRows.length > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Legacy Material Stock Waiting For Warehouse Assignment</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                These quantities came from the old flat stock model. Assign each material to the warehouse where it is actually stored to bring the warehouse stock workflow fully in line with company assets.
              </p>
            </div>
            <DataTable
              columns={legacyColumns}
              data={legacyMaterialRows}
              loading={loading}
              searchKeys={["material_name", "unit"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Consumable Materials By Warehouse</h3>
              <p className="text-sm text-slate-500">
                Warehouse-managed material stock with on-hand, reserved, and available quantities. This now mirrors the clarity of company asset storage.
              </p>
            </div>
            <DataTable
              columns={materialColumns}
              data={warehouseStocks}
              loading={loading}
              searchKeys={["warehouse_name", "material_name", "material_unit", "material_status"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Reusable Company Assets In Warehouses</h3>
              <p className="text-sm text-slate-500">Reusable company asset stock by warehouse. Available, maintenance, damaged, and retired quantities are all tracked on the same stock line.</p>
            </div>
            <DataTable
              columns={assetColumns}
              data={assetWarehouseRows}
              loading={loading}
              searchKeys={["warehouse_name", "asset_name", "asset_type"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Materials Currently On Project Sites</h3>
              <p className="text-sm text-slate-500">These rows track quantities that have already left the warehouse and are now assigned to projects.</p>
            </div>
            <DataTable
              columns={projectMaterialColumns}
              data={projectStocks.filter((row) => Number(row.qty_on_site) > 0.0001)}
              loading={loading}
              searchKeys={["project_name", "material_name", "material_unit"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Allocated Company Asset Quantities</h3>
              <p className="text-sm text-slate-500">These quantities are currently allocated out of available warehouse stock through the asset request workflow.</p>
            </div>
            <DataTable
              columns={allocatedColumns}
              data={allocatedAssets}
              loading={loading}
              searchKeys={["asset_code", "asset_name", "asset_type", "warehouse_name"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(assignTarget)}
        onClose={() => {
          setAssignTarget(null);
          setAssignWarehouseId("");
          setAssignNote("");
          setAssignError(null);
        }}
        title="Assign Legacy Stock To Warehouse"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="font-semibold text-slate-900 dark:text-white">{assignTarget?.material_name}</div>
            <div className="mt-1 text-slate-500">Legacy quantity: {qty(assignTarget?.legacy_quantity ?? 0)}</div>
          </div>

          <FormField
            label="Warehouse"
            type="select"
            value={assignWarehouseId}
            onChange={(value) => setAssignWarehouseId(String(value))}
            options={warehouses.map((warehouse) => ({ value: String(warehouse.id ?? ""), label: warehouse.name }))}
            placeholder="Select warehouse"
            required
          />
          <FormField
            label="Note"
            type="textarea"
            value={assignNote}
            onChange={(value) => setAssignNote(String(value))}
            rows={3}
            placeholder="Optional note for the opening balance movement"
          />
          {assignError ? <p className="text-sm text-red-600">{assignError}</p> : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setAssignTarget(null);
                setAssignWarehouseId("");
                setAssignNote("");
                setAssignError(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={assigning}
              onClick={() => {
                void submitAssignLegacyStock();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assigning ? "Assigning..." : "Assign Stock"}
            </button>
          </div>
        </div>
      </Modal>
    </RequirePermission>
  );
}
