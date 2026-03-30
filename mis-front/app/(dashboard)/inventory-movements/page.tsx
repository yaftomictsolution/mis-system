"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MaterialRow, ProjectRow, StockMovementRow, WarehouseRow } from "@/db/localDB";
import { notifyError } from "@/lib/notify";
import { materialsListLocal, materialsPullToLocal, warehousesListLocal, warehousesPullToLocal } from "@/modules/inventories/inventories.repo";
import { projectsListLocal, projectsPullToLocal } from "@/modules/projects/projects.repo";
import { stockMovementsListLocal, stockMovementsPullToLocal } from "@/modules/stock-movements/stock-movements.repo";

type SyncCompleteDetail = { syncedAny?: boolean; cleaned?: boolean; entities?: string[] };
type MovementSyncEntity = "stock_movements" | "materials" | "warehouses" | "projects";

type Filters = {
  movementType: string;
  materialId: string;
  warehouseId: string;
  projectId: string;
};

type WarehouseSummaryRow = {
  key: string;
  warehouse_name: string;
  materials_count: number;
  projects_count: number;
  inbound: number;
  outbound: number;
  returned: number;
  adjustments: number;
  net_qty: number;
  last_movement: number | null;
};

type ProjectSummaryRow = {
  key: string;
  project_name: string;
  materials_count: number;
  warehouses_count: number;
  issue_count: number;
  received: number;
  issued: number;
  returned: number;
  adjustments: number;
  net_allocated: number;
  last_movement: number | null;
};

type StockSummaryRow = {
  key: string;
  warehouse_name: string;
  project_name: string;
  material_name: string;
  unit: string;
  inbound: number;
  outbound: number;
  returned: number;
  adjustments: number;
  net_movement: number;
  movement_count: number;
  last_movement: number | null;
};

const LOCAL_PAGE_SIZE = 5000;
const TABLE_PAGE_SIZE = 15;
const REPORT_PAGE_SIZE = 8;
const SYNC_ENTITIES = new Set<MovementSyncEntity>(["stock_movements", "materials", "warehouses", "projects"]);

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleString();
}

function qty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function movementBadge(value: string) {
  if (value === "OUT") return <Badge color="red">OUT</Badge>;
  if (value === "IN") return <Badge color="emerald">IN</Badge>;
  if (value.startsWith("TRANSFER")) return <Badge color="blue">{value}</Badge>;
  if (value === "RETURN") return <Badge color="amber">RETURN</Badge>;
  if (value === "ADJUSTMENT") return <Badge color="slate">ADJUSTMENT</Badge>;
  return <Badge color="slate">{value || "UNKNOWN"}</Badge>;
}

function openMovementPrint(uuid: string): void {
  if (!uuid) return;
  window.open(`/print/inventory-movements/${uuid}/record`, "_blank", "noopener,noreferrer");
}

function applyWarehouseMovement(summary: WarehouseSummaryRow, row: StockMovementRow) {
  const quantity = Number(row.quantity || 0);
  switch (row.movement_type) {
    case "IN":
    case "TRANSFER_IN":
      summary.inbound += quantity;
      summary.net_qty += quantity;
      break;
    case "OUT":
    case "TRANSFER_OUT":
      summary.outbound += quantity;
      summary.net_qty -= quantity;
      break;
    case "RETURN":
      summary.returned += quantity;
      summary.net_qty += quantity;
      break;
    case "ADJUSTMENT":
      summary.adjustments += quantity;
      summary.net_qty += quantity;
      break;
    default:
      break;
  }
}

function applyProjectMovement(summary: ProjectSummaryRow, row: StockMovementRow) {
  const quantity = Number(row.quantity || 0);
  switch (row.movement_type) {
    case "IN":
    case "TRANSFER_IN":
      summary.received += quantity;
      summary.net_allocated += quantity;
      break;
    case "OUT":
      summary.issued += quantity;
      summary.issue_count += 1;
      summary.net_allocated += quantity;
      break;
    case "TRANSFER_OUT":
      summary.returned += quantity;
      summary.net_allocated -= quantity;
      break;
    case "RETURN":
      summary.returned += quantity;
      summary.net_allocated -= quantity;
      break;
    case "ADJUSTMENT":
      summary.adjustments += quantity;
      break;
    default:
      break;
  }
}

function applyStockMovement(summary: StockSummaryRow, row: StockMovementRow) {
  const quantity = Number(row.quantity || 0);
  switch (row.movement_type) {
    case "IN":
    case "TRANSFER_IN":
      summary.inbound += quantity;
      summary.net_movement += quantity;
      break;
    case "OUT":
    case "TRANSFER_OUT":
      summary.outbound += quantity;
      summary.net_movement -= quantity;
      break;
    case "RETURN":
      summary.returned += quantity;
      summary.net_movement += quantity;
      break;
    case "ADJUSTMENT":
      summary.adjustments += quantity;
      summary.net_movement += quantity;
      break;
    default:
      break;
  }
}

export default function InventoryMovementsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [filters, setFilters] = useState<Filters>({
    movementType: "",
    materialId: "",
    warehouseId: "",
    projectId: "",
  });

  const loadLocal = useCallback(async () => {
    const [movementPage, materialPage, warehousePage, projectPage] = await Promise.all([
      stockMovementsListLocal({
        page: 1,
        pageSize: LOCAL_PAGE_SIZE,
        movementType: filters.movementType || undefined,
        materialId: filters.materialId ? Number(filters.materialId) : null,
        warehouseId: filters.warehouseId ? Number(filters.warehouseId) : null,
        projectId: filters.projectId ? Number(filters.projectId) : null,
      }),
      materialsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehousesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      projectsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
    ]);

    setRows(movementPage.items);
    setMaterials(materialPage.items);
    setWarehouses(warehousePage.items);
    setProjects(projectPage.items);
  }, [filters.materialId, filters.movementType, filters.projectId, filters.warehouseId]);

  const refresh = useCallback(async (options?: { showLoader?: boolean; entitiesToPull?: MovementSyncEntity[] }) => {
    const showLoader = options?.showLoader ?? true;
    const entitiesToPull = options?.entitiesToPull ?? ["stock_movements", "materials", "warehouses", "projects"];

    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      if (!entitiesToPull.length) return;

      let pullFailed = false;
      try {
        const tasks: Promise<unknown>[] = [];
        if (entitiesToPull.includes("stock_movements")) tasks.push(stockMovementsPullToLocal());
        if (entitiesToPull.includes("materials")) tasks.push(materialsPullToLocal());
        if (entitiesToPull.includes("warehouses")) tasks.push(warehousesPullToLocal());
        if (entitiesToPull.includes("projects")) tasks.push(projectsPullToLocal());
        await Promise.all(tasks);
      } catch {
        pullFailed = true;
      }

      await loadLocal();
      if (pullFailed && rows.length === 0) {
        notifyError("Unable to refresh movement history from server. Using local data only.");
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [loadLocal, rows.length]);

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
      const touched = entities.filter((entity): entity is MovementSyncEntity => SYNC_ENTITIES.has(entity as MovementSyncEntity));
      if (!touched.length) return;
      void refresh({ showLoader: false, entitiesToPull: touched });
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  const materialOptions = useMemo(
    () => materials.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [materials],
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [warehouses],
  );

  const projectOptions = useMemo(
    () => projects.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [projects],
  );

  const lowStockCount = useMemo(
    () => materials.filter((item) => Number(item.quantity || 0) <= Number(item.min_stock_level || 0)).length,
    [materials],
  );

  const summary = useMemo(() => ({
    total: rows.length,
    outbound: rows.filter((row) => row.movement_type === "OUT").length,
    inbound: rows.filter((row) => row.movement_type === "IN").length,
    projects: new Set(rows.map((row) => row.project_name || row.project_id).filter(Boolean)).size,
  }), [rows]);

  const warehouseReport = useMemo<WarehouseSummaryRow[]>(() => {
    const map = new Map<string, WarehouseSummaryRow & { materialKeys: Set<string>; projectKeys: Set<string> }>();

    for (const row of rows) {
      const warehouseKey = String(row.warehouse_uuid || row.warehouse_id || "unassigned");
      const warehouseName = row.warehouse_name || "Unknown warehouse";
      const existing = map.get(warehouseKey) ?? {
        key: warehouseKey,
        warehouse_name: warehouseName,
        materials_count: 0,
        projects_count: 0,
        inbound: 0,
        outbound: 0,
        returned: 0,
        adjustments: 0,
        net_qty: 0,
        last_movement: null,
        materialKeys: new Set<string>(),
        projectKeys: new Set<string>(),
      };

      const materialKey = String(row.material_uuid || row.material_id || "");
      const projectKey = String(row.project_uuid || row.project_id || "");
      if (materialKey) existing.materialKeys.add(materialKey);
      if (projectKey) existing.projectKeys.add(projectKey);
      existing.last_movement = Math.max(Number(existing.last_movement ?? 0), Number(row.movement_date ?? 0)) || existing.last_movement;

      applyWarehouseMovement(existing, row);
      map.set(warehouseKey, existing);
    }

    return Array.from(map.values())
      .map((item) => ({
        key: item.key,
        warehouse_name: item.warehouse_name,
        materials_count: item.materialKeys.size,
        projects_count: item.projectKeys.size,
        inbound: item.inbound,
        outbound: item.outbound,
        returned: item.returned,
        adjustments: item.adjustments,
        net_qty: item.net_qty,
        last_movement: item.last_movement,
      }))
      .sort((left, right) => Math.abs(right.net_qty) - Math.abs(left.net_qty));
  }, [rows]);

  const projectReport = useMemo<ProjectSummaryRow[]>(() => {
    const map = new Map<string, ProjectSummaryRow & { materialKeys: Set<string>; warehouseKeys: Set<string> }>();

    for (const row of rows) {
      if (!row.project_id && !row.project_name) continue;

      const projectKey = String(row.project_uuid || row.project_id || "unassigned");
      const projectName = row.project_name || "Unknown project";
      const existing = map.get(projectKey) ?? {
        key: projectKey,
        project_name: projectName,
        materials_count: 0,
        warehouses_count: 0,
        issue_count: 0,
        received: 0,
        issued: 0,
        returned: 0,
        adjustments: 0,
        net_allocated: 0,
        last_movement: null,
        materialKeys: new Set<string>(),
        warehouseKeys: new Set<string>(),
      };

      const materialKey = String(row.material_uuid || row.material_id || "");
      const warehouseKey = String(row.warehouse_uuid || row.warehouse_id || "");
      if (materialKey) existing.materialKeys.add(materialKey);
      if (warehouseKey) existing.warehouseKeys.add(warehouseKey);
      existing.last_movement = Math.max(Number(existing.last_movement ?? 0), Number(row.movement_date ?? 0)) || existing.last_movement;

      applyProjectMovement(existing, row);
      map.set(projectKey, existing);
    }

    return Array.from(map.values())
      .map((item) => ({
        key: item.key,
        project_name: item.project_name,
        materials_count: item.materialKeys.size,
        warehouses_count: item.warehouseKeys.size,
        issue_count: item.issue_count,
        received: item.received,
        issued: item.issued,
        returned: item.returned,
        adjustments: item.adjustments,
        net_allocated: item.net_allocated,
        last_movement: item.last_movement,
      }))
      .sort((left, right) => Math.abs(right.net_allocated) - Math.abs(left.net_allocated));
  }, [rows]);

  const stockSummary = useMemo<StockSummaryRow[]>(() => {
    const map = new Map<string, StockSummaryRow>();

    for (const row of rows) {
      const key = [
        row.warehouse_uuid || row.warehouse_id || "warehouse",
        row.project_uuid || row.project_id || "no-project",
        row.material_uuid || row.material_id || "material",
      ].join(":");

      const existing = map.get(key) ?? {
        key,
        warehouse_name: row.warehouse_name || "Unknown warehouse",
        project_name: row.project_name || "No project",
        material_name: row.material_name || "Material",
        unit: row.material_unit || "",
        inbound: 0,
        outbound: 0,
        returned: 0,
        adjustments: 0,
        net_movement: 0,
        movement_count: 0,
        last_movement: null,
      };

      existing.movement_count += 1;
      existing.last_movement = Math.max(Number(existing.last_movement ?? 0), Number(row.movement_date ?? 0)) || existing.last_movement;
      applyStockMovement(existing, row);
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((left, right) => Math.abs(right.net_movement) - Math.abs(left.net_movement));
  }, [rows]);

  const movementColumns = useMemo<Column<StockMovementRow>[]>(() => [
    { key: "movement_date", label: "Date", render: (item) => toDateLabel(item.movement_date) },
    { key: "movement_type", label: "Type", render: (item) => movementBadge(item.movement_type) },
    { key: "material_name", label: "Material", render: (item) => item.material_name || "-" },
    { key: "warehouse_name", label: "Warehouse", render: (item) => item.warehouse_name || "-" },
    { key: "project_name", label: "Project", render: (item) => item.project_name || "-" },
    { key: "employee_name", label: "Employee", render: (item) => item.employee_name || "-" },
    { key: "quantity", label: "Quantity", render: (item) => `${qty(item.quantity)} ${item.material_unit || ""}`.trim() },
    { key: "reference_no", label: "Reference", render: (item) => item.reference_no || "-" },
    {
      key: "print",
      label: "Record",
      render: (item) => (
        <button
          type="button"
          onClick={() => openMovementPrint(item.uuid)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:bg-[#1a1a2e] dark:text-slate-200 dark:hover:bg-[#23233a]"
        >
          {item.reference_type === "request_issue" ? "Print Issue" : "Print Record"}
        </button>
      ),
    },
  ], []);

  const warehouseColumns = useMemo<Column<WarehouseSummaryRow>[]>(() => [
    { key: "warehouse_name", label: "Warehouse", render: (item) => <span className="font-semibold">{item.warehouse_name}</span> },
    { key: "materials_count", label: "Materials", render: (item) => String(item.materials_count) },
    { key: "projects_count", label: "Projects", render: (item) => String(item.projects_count) },
    { key: "inbound", label: "Inbound", render: (item) => qty(item.inbound) },
    { key: "outbound", label: "Outbound", render: (item) => qty(item.outbound) },
    { key: "returned", label: "Returned", render: (item) => qty(item.returned) },
    { key: "net_qty", label: "Net Stock", render: (item) => qty(item.net_qty) },
    { key: "last_movement", label: "Last Movement", render: (item) => toDateLabel(item.last_movement) },
  ], []);

  const projectColumns = useMemo<Column<ProjectSummaryRow>[]>(() => [
    { key: "project_name", label: "Project", render: (item) => <span className="font-semibold">{item.project_name}</span> },
    { key: "materials_count", label: "Materials", render: (item) => String(item.materials_count) },
    { key: "warehouses_count", label: "Warehouses", render: (item) => String(item.warehouses_count) },
    { key: "issued", label: "Issued", render: (item) => qty(item.issued) },
    { key: "received", label: "Received", render: (item) => qty(item.received) },
    { key: "returned", label: "Returned", render: (item) => qty(item.returned) },
    { key: "net_allocated", label: "Net Allocation", render: (item) => qty(item.net_allocated) },
    { key: "last_movement", label: "Last Movement", render: (item) => toDateLabel(item.last_movement) },
  ], []);

  const stockColumns = useMemo<Column<StockSummaryRow>[]>(() => [
    { key: "material_name", label: "Material", render: (item) => <span className="font-semibold">{item.material_name}</span> },
    { key: "warehouse_name", label: "Warehouse", render: (item) => item.warehouse_name },
    { key: "project_name", label: "Project", render: (item) => item.project_name },
    { key: "inbound", label: "Inbound", render: (item) => `${qty(item.inbound)} ${item.unit}`.trim() },
    { key: "outbound", label: "Outbound", render: (item) => `${qty(item.outbound)} ${item.unit}`.trim() },
    { key: "returned", label: "Returned", render: (item) => `${qty(item.returned)} ${item.unit}`.trim() },
    { key: "net_movement", label: "Net Movement", render: (item) => `${qty(item.net_movement)} ${item.unit}`.trim() },
    { key: "movement_count", label: "Entries", render: (item) => String(item.movement_count) },
  ], []);

  return (
    <RequirePermission permission={["stock_movements.view", "inventory.request"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Inventory Movements" subtitle="Project-aware movement reports, warehouse stock summary, and printable material records.">
          <button
            type="button"
            onClick={() => { void refresh(); }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
          >
            Sync Movements
          </button>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Movements", value: summary.total },
            { label: "Outbound", value: summary.outbound },
            { label: "Inbound", value: summary.inbound },
            { label: "Projects Touched", value: summary.projects },
            { label: "Low Stock Materials", value: lowStockCount },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="text-sm font-medium text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FormField
              label="Movement Type"
              type="select"
              value={filters.movementType}
              onChange={(value) => setFilters((prev) => ({ ...prev, movementType: String(value) }))}
              options={[
                { value: "IN", label: "IN" },
                { value: "OUT", label: "OUT" },
                { value: "RETURN", label: "RETURN" },
                { value: "TRANSFER_IN", label: "TRANSFER IN" },
                { value: "TRANSFER_OUT", label: "TRANSFER OUT" },
                { value: "ADJUSTMENT", label: "ADJUSTMENT" },
              ]}
              placeholder="All movement types"
            />
            <FormField
              label="Material"
              type="select"
              value={filters.materialId}
              onChange={(value) => setFilters((prev) => ({ ...prev, materialId: String(value) }))}
              options={materialOptions}
              placeholder="All materials"
            />
            <FormField
              label="Warehouse"
              type="select"
              value={filters.warehouseId}
              onChange={(value) => setFilters((prev) => ({ ...prev, warehouseId: String(value) }))}
              options={warehouseOptions}
              placeholder="All warehouses"
            />
            <FormField
              label="Project"
              type="select"
              value={filters.projectId}
              onChange={(value) => setFilters((prev) => ({ ...prev, projectId: String(value) }))}
              options={projectOptions}
              placeholder="All projects"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Warehouse and project summaries are calculated from the filtered movement ledger currently cached on this device.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Warehouse Stock Summary</h3>
              <p className="text-sm text-slate-500">Net stock movement and activity by warehouse.</p>
            </div>
            <DataTable
              columns={warehouseColumns}
              data={warehouseReport}
              loading={loading}
              searchKeys={["warehouse_name"]}
              pageSize={REPORT_PAGE_SIZE}
              compact
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Project Usage Report</h3>
              <p className="text-sm text-slate-500">Issue, return, and allocation totals per project.</p>
            </div>
            <DataTable
              columns={projectColumns}
              data={projectReport}
              loading={loading}
              searchKeys={["project_name"]}
              pageSize={REPORT_PAGE_SIZE}
              compact
            />
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Stock Summary By Warehouse / Project</h3>
            <p className="text-sm text-slate-500">Movement-based material detail grouped by warehouse, project, and item.</p>
          </div>
          <DataTable
            columns={stockColumns}
            data={stockSummary}
            loading={loading}
            searchKeys={["material_name", "warehouse_name", "project_name", "unit"]}
            pageSize={TABLE_PAGE_SIZE}
            compact
          />
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Movement Ledger</h3>
            <p className="text-sm text-slate-500">Open any row as a printable material receipt or issue record.</p>
          </div>
          <DataTable
            columns={movementColumns}
            data={rows}
            loading={loading}
            searchKeys={["material_name", "warehouse_name", "project_name", "employee_name", "movement_type", "reference_type", "reference_no", "notes", "material_request_no"]}
            pageSize={TABLE_PAGE_SIZE}
            compact
            expandableRows
            renderExpandedRow={(row) => (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div><div className="text-xs uppercase tracking-wide text-slate-500">Reference Type</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.reference_type || "-"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-slate-500">Approved By</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.approved_by_user_name || "-"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-slate-500">Issued By</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.issued_by_user_name || "-"}</div></div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Item Reference</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.material_request_item_uuid || "-"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openMovementPrint(row.uuid)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:bg-[#1a1a2e] dark:text-slate-200 dark:hover:bg-[#23233a]"
                  >
                    {row.reference_type === "request_issue" ? "Print Issue" : "Print Record"}
                  </button>
                </div>
                <div className="md:col-span-2 xl:col-span-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Notes</div>
                  <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.notes || "-"}</div>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
