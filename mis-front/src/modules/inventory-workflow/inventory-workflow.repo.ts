import type { Table } from "dexie";
import {
  db,
  type AssetRequestRow,
  type CompanyAssetRow,
  type EmployeeRow,
  type MaterialRequestItemRow,
  type MaterialRequestRow,
  type MaterialRow,
  type ProjectRow,
  type WarehouseRow,
} from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { companyAssetsPullToLocal, materialsPullToLocal } from "@/modules/inventories/inventories.repo";
import {
  projectMaterialStocksPullToLocal,
  warehouseMaterialStocksPullToLocal,
} from "@/modules/material-stocks/material-stocks.repo";
import { stockMovementsPullToLocal } from "@/modules/stock-movements/stock-movements.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const MATERIAL_REQUESTS_CURSOR_KEY = "material_requests_sync_cursor";
const ASSET_REQUESTS_CURSOR_KEY = "asset_requests_sync_cursor";
const MATERIAL_REQUESTS_CLEANUP_KEY = "material_requests_last_cleanup_ms";
const ASSET_REQUESTS_CLEANUP_KEY = "asset_requests_last_cleanup_ms";
const isValidationError = (status?: number) => status === 409 || status === 422;

type Obj = Record<string, unknown>;

type LocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type LocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type WorkflowModuleKey = "material_requests" | "asset_requests";

type LocalListConfig<Row extends { uuid: string; updated_at: number }> = {
  table: Table<Row, string>;
  matchesSearch: (row: Row, query: string) => boolean;
};

type PullConfig<Row extends { uuid: string; updated_at: number }> = LocalListConfig<Row> & {
  entity: WorkflowModuleKey;
  endpoint: string;
  cursorKey: string;
  cleanupKey: string;
  sanitize: (input: unknown) => Row;
  isValid: (row: Row) => boolean;
  decorate?: (row: Row) => Promise<Row>;
};

export type MaterialRequestItemInput = {
  uuid?: string;
  material_id: number;
  quantity_requested: number;
  unit: string;
  notes?: string | null;
};

export type MaterialRequestInput = {
  project_id?: number | null;
  warehouse_id: number;
  requested_by_employee_id: number;
  notes?: string | null;
  items: MaterialRequestItemInput[];
};

export type AssetRequestInput = {
  project_id?: number | null;
  requested_by_employee_id: number;
  requested_asset_id?: number | null;
  asset_type?: string | null;
  quantity_requested: number;
  reason?: string | null;
  notes?: string | null;
};

export type MaterialIssueInput = {
  items: Array<{ uuid: string; quantity_issued: number }>;
  notes?: string | null;
  issue_date?: string | null;
};

export type AssetAllocationInput = {
  asset_id: number;
  quantity_allocated: number;
  assigned_date: string;
  condition_on_issue?: string | null;
  notes?: string | null;
};

export type AssetReturnInput = {
  return_date: string;
  return_status: "returned" | "damaged" | "lost";
  quantity_returned?: number | null;
  warehouse_id?: number | null;
  condition_on_return?: string | null;
  notes?: string | null;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const obj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});
const nowIso = () => new Date().toISOString();

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function lsSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function lsRemove(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function lsNum(key: string): number | null {
  const raw = lsGet(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimText(value: unknown, max = 255): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function trimOrNull(value: unknown, max = 1000): string | null {
  const trimmed = trimText(value, max);
  return trimmed || null;
}

function toTs(value: unknown, fallback = Date.now()): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableTs(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return toTs(value);
}

function toId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
}

function toNullableId(value: unknown): number | null {
  const parsed = toId(value);
  return parsed > 0 ? parsed : null;
}

function toMoney(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(2));
}

function deriveIdFromUuid(uuid: string): number {
  let hash = 0;
  for (let index = 0; index < uuid.length; index += 1) {
    hash = (hash * 31 + uuid.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
}

function toRowId(value: unknown, uuid: string): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return deriveIdFromUuid(uuid);
}

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function getApiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data?.errors && typeof data.errors === "object") {
    for (const key of Object.keys(data.errors)) {
      const value = (data.errors as Obj)[key];
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }

  return "Validation failed on server.";
}

function parsePayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
  if (Array.isArray(payload)) {
    return { list: payload.map(obj), hasMore: false, serverTime: nowIso() };
  }

  const root = obj(payload);
  const meta = obj(root.meta);
  const topData = root.data;

  if (Array.isArray(topData)) {
    return { list: topData.map(obj), hasMore: Boolean(meta.has_more), serverTime: String(meta.server_time ?? nowIso()) };
  }

  const paged = obj(topData);
  if (Array.isArray(paged.data)) {
    const currentPage = Number(paged.current_page ?? 1);
    const lastPage = Number(paged.last_page ?? 1);
    return { list: paged.data.map(obj), hasMore: currentPage < lastPage, serverTime: String(meta.server_time ?? nowIso()) };
  }

  return { list: [], hasMore: false, serverTime: nowIso() };
}

function isDeletedRecord(input: unknown): boolean {
  const record = obj(input);
  return record.deleted_at !== null && record.deleted_at !== undefined && String(record.deleted_at).trim() !== "";
}

async function removeQueuedOpsForEntityUuids(entity: string, uuids: string[]): Promise<void> {
  const unique = [...new Set(uuids.filter(Boolean))];
  if (!unique.length) return;

  const ids: number[] = [];
  for (const uuid of unique) {
    const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
    for (const item of items) {
      if (item.entity === entity && item.id !== undefined) ids.push(item.id);
    }
  }

  if (ids.length) await db.sync_queue.bulkDelete(ids);
}

async function removeLatestQueueItem(entity: string, uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items.filter((item) => item.entity === entity && item.action === action).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
  if (target?.id !== undefined) await db.sync_queue.delete(target.id);
}
async function getWarehouseSnapshot(warehouseId: number): Promise<WarehouseRow | undefined> {
  const direct = await db.warehouses.filter((item) => Number(item.id) === warehouseId).first();
  if (direct) return direct;
  return db.warehouses.where("updated_at").above(0).filter((item) => Number(item.id) === warehouseId).first();
}

async function getEmployeeSnapshot(employeeId: number): Promise<EmployeeRow | undefined> {
  const direct = await db.employees.filter((item) => Number(item.id) === employeeId).first();
  if (direct) return direct;
  return db.employees.where("updated_at").above(0).filter((item) => Number(item.id) === employeeId).first();
}

async function getMaterialSnapshot(materialId: number): Promise<MaterialRow | undefined> {
  const direct = await db.materials.filter((item) => Number(item.id) === materialId).first();
  if (direct) return direct;
  return db.materials.where("updated_at").above(0).filter((item) => Number(item.id) === materialId).first();
}

async function getAssetSnapshot(assetId: number): Promise<CompanyAssetRow | undefined> {
  const direct = await db.company_assets.filter((item) => Number(item.id) === assetId).first();
  if (direct) return direct;
  return db.company_assets.where("updated_at").above(0).filter((item) => Number(item.id) === assetId).first();
}

async function getProjectSnapshot(projectId: number): Promise<ProjectRow | undefined> {
  const direct = await db.projects.filter((item) => Number(item.id) === projectId).first();
  if (direct) return direct;
  return db.projects.where("updated_at").above(0).filter((item) => Number(item.id) === projectId).first();
}

function buildEmployeeName(employee?: EmployeeRow): string | null {
  if (!employee) return null;
  const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim();
  return fullName || employee.email || null;
}

async function decorateMaterialRequestItems(items: MaterialRequestItemRow[]): Promise<MaterialRequestItemRow[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.material_name && item.material_uuid) return item;
      const material = await getMaterialSnapshot(item.material_id);
      return {
        ...item,
        material_uuid: item.material_uuid ?? material?.uuid ?? null,
        material_name: item.material_name ?? material?.name ?? null,
      };
    })
  );
}

async function decorateMaterialRequest(row: MaterialRequestRow): Promise<MaterialRequestRow> {
  const [warehouse, employee, project, items] = await Promise.all([
    !row.warehouse_name && row.warehouse_id > 0 ? getWarehouseSnapshot(row.warehouse_id) : Promise.resolve(undefined),
    !row.requested_by_employee_name && row.requested_by_employee_id > 0 ? getEmployeeSnapshot(row.requested_by_employee_id) : Promise.resolve(undefined),
    !row.project_name && (row.project_id ?? 0) > 0 ? getProjectSnapshot(Number(row.project_id)) : Promise.resolve(undefined),
    decorateMaterialRequestItems(row.items ?? []),
  ]);

  return {
    ...row,
    project_uuid: row.project_uuid ?? project?.uuid ?? null,
    project_name: row.project_name ?? project?.name ?? null,
    warehouse_uuid: row.warehouse_uuid ?? warehouse?.uuid ?? null,
    warehouse_name: row.warehouse_name ?? warehouse?.name ?? null,
    requested_by_employee_uuid: row.requested_by_employee_uuid ?? employee?.uuid ?? null,
    requested_by_employee_name: row.requested_by_employee_name ?? buildEmployeeName(employee),
    items,
  };
}

async function decorateAssetRequest(row: AssetRequestRow): Promise<AssetRequestRow> {
  const [employee, project, requestedAsset, assignedAsset] = await Promise.all([
    !row.requested_by_employee_name && row.requested_by_employee_id > 0 ? getEmployeeSnapshot(row.requested_by_employee_id) : Promise.resolve(undefined),
    !row.project_name && (row.project_id ?? 0) > 0 ? getProjectSnapshot(Number(row.project_id)) : Promise.resolve(undefined),
    !row.requested_asset_name && (row.requested_asset_id ?? 0) > 0 ? getAssetSnapshot(Number(row.requested_asset_id)) : Promise.resolve(undefined),
    !row.assigned_asset_name && (row.assigned_asset_id ?? 0) > 0 ? getAssetSnapshot(Number(row.assigned_asset_id)) : Promise.resolve(undefined),
  ]);

  return {
    ...row,
    project_uuid: row.project_uuid ?? project?.uuid ?? null,
    project_name: row.project_name ?? project?.name ?? null,
    requested_by_employee_uuid: row.requested_by_employee_uuid ?? employee?.uuid ?? null,
    requested_by_employee_name: row.requested_by_employee_name ?? buildEmployeeName(employee),
    requested_asset_uuid: row.requested_asset_uuid ?? requestedAsset?.uuid ?? null,
    requested_asset_code: row.requested_asset_code ?? requestedAsset?.asset_code ?? null,
    requested_asset_name: row.requested_asset_name ?? requestedAsset?.asset_name ?? null,
    assigned_asset_uuid: row.assigned_asset_uuid ?? assignedAsset?.uuid ?? null,
    assigned_asset_code: row.assigned_asset_code ?? assignedAsset?.asset_code ?? null,
    assigned_asset_name: row.assigned_asset_name ?? assignedAsset?.asset_name ?? null,
  };
}

function sanitizeMaterialRequestItem(input: unknown): MaterialRequestItemRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    material_id: toId(record.material_id),
    material_uuid: trimOrNull(record.material_uuid, 100),
    material_name: trimOrNull(record.material_name, 255),
    unit: trimText(record.unit, 100),
    quantity_requested: Math.max(0, toMoney(record.quantity_requested)),
    quantity_approved: Math.max(0, toMoney(record.quantity_approved)),
    quantity_issued: Math.max(0, toMoney(record.quantity_issued)),
    notes: trimOrNull(record.notes, 1000),
  };
}

function sanitizeMaterialRequest(input: unknown): MaterialRequestRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  const requestNo = trimText(record.request_no, 100) || `MR-LOCAL-${uuid.slice(0, 8).toUpperCase()}`;
  const rawItems = Array.isArray(record.items) ? record.items : [];

  return {
    id: toRowId(record.id, uuid),
    uuid,
    request_no: requestNo,
    project_id: toNullableId(record.project_id),
    project_uuid: trimOrNull(record.project_uuid, 100),
    project_name: trimOrNull(record.project_name, 255),
    warehouse_id: toId(record.warehouse_id),
    warehouse_uuid: trimOrNull(record.warehouse_uuid, 100),
    warehouse_name: trimOrNull(record.warehouse_name, 255),
    requested_by_employee_id: toId(record.requested_by_employee_id),
    requested_by_employee_uuid: trimOrNull(record.requested_by_employee_uuid, 100),
    requested_by_employee_name: trimOrNull(record.requested_by_employee_name, 255),
    status: trimText(record.status, 50) || "pending",
    approved_by_user_id: toNullableId(record.approved_by_user_id),
    approved_by_user_name: trimOrNull(record.approved_by_user_name, 255),
    approved_at: toNullableTs(record.approved_at),
    issued_by_user_id: toNullableId(record.issued_by_user_id),
    issued_by_user_name: trimOrNull(record.issued_by_user_name, 255),
    issued_at: toNullableTs(record.issued_at),
    issue_receipt_no: trimOrNull(record.issue_receipt_no, 100),
    requested_at: toNullableTs(record.requested_at) ?? Date.now(),
    notes: trimOrNull(record.notes, 5000),
    items: rawItems.map(sanitizeMaterialRequestItem).filter((item) => item.uuid && item.material_id > 0 && item.unit),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeAssetRequest(input: unknown): AssetRequestRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  const requestNo = trimText(record.request_no, 100) || `AR-LOCAL-${uuid.slice(0, 8).toUpperCase()}`;

  return {
    id: toRowId(record.id, uuid),
    uuid,
    request_no: requestNo,
    project_id: toNullableId(record.project_id),
    project_uuid: trimOrNull(record.project_uuid, 100),
    project_name: trimOrNull(record.project_name, 255),
    requested_by_employee_id: toId(record.requested_by_employee_id),
    requested_by_employee_uuid: trimOrNull(record.requested_by_employee_uuid, 100),
    requested_by_employee_name: trimOrNull(record.requested_by_employee_name, 255),
    requested_asset_id: toNullableId(record.requested_asset_id),
    requested_asset_uuid: trimOrNull(record.requested_asset_uuid, 100),
    requested_asset_code: trimOrNull(record.requested_asset_code, 100),
    requested_asset_name: trimOrNull(record.requested_asset_name, 255),
    asset_type: trimOrNull(record.asset_type, 50),
    quantity_requested: Math.max(0, toMoney(record.quantity_requested, 1)),
    quantity_allocated: Math.max(0, toMoney(record.quantity_allocated, 0)),
    status: trimText(record.status, 50) || "pending",
    reason: trimOrNull(record.reason, 5000),
    approved_by_user_id: toNullableId(record.approved_by_user_id),
    approved_by_user_name: trimOrNull(record.approved_by_user_name, 255),
    approved_at: toNullableTs(record.approved_at),
    allocated_by_user_id: toNullableId(record.allocated_by_user_id),
    allocated_by_user_name: trimOrNull(record.allocated_by_user_name, 255),
    allocated_at: toNullableTs(record.allocated_at),
    allocation_receipt_no: trimOrNull(record.allocation_receipt_no, 100),
    requested_at: toNullableTs(record.requested_at) ?? Date.now(),
    notes: trimOrNull(record.notes, 5000),
    assignment_uuid: trimOrNull(record.assignment_uuid, 100),
    assignment_status: trimOrNull(record.assignment_status, 50),
    assigned_date: toNullableTs(record.assigned_date),
    return_date: toNullableTs(record.return_date),
    assigned_quantity: record.assigned_quantity === null || record.assigned_quantity === undefined ? null : Math.max(0, toMoney(record.assigned_quantity)),
    assigned_asset_id: toNullableId(record.assigned_asset_id),
    assigned_asset_uuid: trimOrNull(record.assigned_asset_uuid, 100),
    assigned_asset_code: trimOrNull(record.assigned_asset_code, 100),
    assigned_asset_name: trimOrNull(record.assigned_asset_name, 255),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesMaterialRequestSearch(row: MaterialRequestRow, query: string): boolean {
  return [
    row.request_no,
    row.warehouse_name,
    row.requested_by_employee_name,
    row.status,
    row.issue_receipt_no,
    row.notes,
    ...(row.items ?? []).flatMap((item) => [item.material_name, item.unit]),
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function matchesAssetRequestSearch(row: AssetRequestRow, query: string): boolean {
  return [
    row.request_no,
    row.requested_by_employee_name,
    row.requested_asset_code,
    row.requested_asset_name,
    row.assigned_asset_code,
    row.assigned_asset_name,
    row.asset_type,
    row.status,
    row.reason,
    row.notes,
    row.allocation_receipt_no,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

async function listLocal<Row extends { uuid: string; updated_at: number }>(
  config: LocalListConfig<Row>,
  query: LocalQuery = {}
): Promise<LocalPage<Row>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await config.table.count();
    const items = (await config.table.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray()) as Row[];
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = config.table.orderBy("updated_at").reverse().filter((row) => config.matchesSearch(row as Row, search));
  const total = await collection.count();
  const items = (await collection.offset(offset).limit(pageSize).toArray()) as Row[];
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

async function retentionCleanup<Row extends { uuid: string; updated_at: number }>(config: PullConfig<Row>): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays(config.entity, RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals(config.entity).toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = (await config.table.where("updated_at").below(cutoff).toArray()) as Row[];
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await config.table.bulkDelete(removable);
  }
  return removable.length;
}

async function retentionCleanupIfDue<Row extends { uuid: string; updated_at: number }>(config: PullConfig<Row>): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(config.cleanupKey);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await retentionCleanup(config);
  lsSet(config.cleanupKey, String(now));
  return removed;
}

async function pullToLocal<Row extends { uuid: string; updated_at: number }>(config: PullConfig<Row>): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(config.cursorKey);
  const localCount = await config.table.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(config.cursorKey);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get(config.endpoint, { params });
    const parsed = parsePayload(response.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await config.table.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids(config.entity, deletedUuids);
    }

    let rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(config.sanitize)
      .filter(config.isValid);

    if (config.decorate && rows.length) {
      rows = await Promise.all(rows.map((row) => config.decorate?.(row) ?? Promise.resolve(row)));
    }

    if (rows.length) {
      await config.table.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(config.cursorKey, serverTime);
  await retentionCleanupIfDue(config);
  return { pulled };
}
function validateMaterialRequestInput(input: MaterialRequestInput): void {
  if (!Number.isFinite(input.warehouse_id) || input.warehouse_id <= 0) {
    throw new Error("Warehouse is required.");
  }
  if (!Number.isFinite(input.requested_by_employee_id) || input.requested_by_employee_id <= 0) {
    throw new Error("Requested by employee is required.");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("At least one material item is required.");
  }

  input.items.forEach((item, index) => {
    if (!Number.isFinite(item.material_id) || item.material_id <= 0) {
      throw new Error(`Material is required for item ${index + 1}.`);
    }
    if (!Number.isFinite(item.quantity_requested) || item.quantity_requested <= 0) {
      throw new Error(`Requested quantity must be greater than 0 for item ${index + 1}.`);
    }
    if (!trimText(item.unit, 100)) {
      throw new Error(`Unit is required for item ${index + 1}.`);
    }
  });
}

function validateAssetRequestInput(input: AssetRequestInput): void {
  if (!Number.isFinite(input.requested_by_employee_id) || input.requested_by_employee_id <= 0) {
    throw new Error("Requested by employee is required.");
  }
  if ((!input.requested_asset_id || input.requested_asset_id <= 0) && !trimText(input.asset_type, 50)) {
    throw new Error("Select a requested asset or provide an asset type.");
  }
  if (!Number.isFinite(input.quantity_requested) || input.quantity_requested <= 0) {
    throw new Error("Requested quantity must be greater than 0.");
  }
}

function validateMaterialIssueInput(input: MaterialIssueInput): void {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("At least one issue item is required.");
  }

  input.items.forEach((item, index) => {
    if (!trimText(item.uuid, 100)) {
      throw new Error(`Issue row ${index + 1} is missing a target item.`);
    }
    if (!Number.isFinite(item.quantity_issued) || item.quantity_issued <= 0) {
      throw new Error(`Issued quantity must be greater than 0 for row ${index + 1}.`);
    }
  });
}

function validateAssetAllocationInput(input: AssetAllocationInput): void {
  if (!Number.isFinite(input.asset_id) || input.asset_id <= 0) {
    throw new Error("Allocated asset is required.");
  }
  if (!Number.isFinite(input.quantity_allocated) || input.quantity_allocated <= 0) {
    throw new Error("Allocated quantity must be greater than 0.");
  }
  if (!trimText(input.assigned_date, 50)) {
    throw new Error("Assigned date is required.");
  }
}

function validateAssetReturnInput(input: AssetReturnInput): void {
  if (!trimText(input.return_date, 50)) {
    throw new Error("Return date is required.");
  }
  if (input.quantity_returned !== null && input.quantity_returned !== undefined) {
    if (!Number.isFinite(input.quantity_returned) || Number(input.quantity_returned) <= 0) {
      throw new Error("Returned quantity must be greater than 0.");
    }
  }
  if (input.return_status !== "lost" && (!Number.isFinite(input.warehouse_id) || Number(input.warehouse_id) <= 0)) {
    throw new Error("Return warehouse is required.");
  }
}

function toMaterialRequestPayload(input: MaterialRequestInput): Obj {
  return {
    project_id: toNullableId(input.project_id),
    warehouse_id: toId(input.warehouse_id),
    requested_by_employee_id: toId(input.requested_by_employee_id),
    notes: trimOrNull(input.notes, 5000),
    items: input.items.map((item) => ({
      uuid: trimText(item.uuid, 100) || crypto.randomUUID(),
      material_id: toId(item.material_id),
      quantity_requested: Math.max(0, toMoney(item.quantity_requested)),
      unit: trimText(item.unit, 100),
      notes: trimOrNull(item.notes, 1000),
    })),
  };
}

function toAssetRequestPayload(input: AssetRequestInput): Obj {
  return {
    project_id: toNullableId(input.project_id),
    requested_by_employee_id: toId(input.requested_by_employee_id),
    requested_asset_id: toNullableId(input.requested_asset_id),
    asset_type: trimOrNull(input.asset_type, 50),
    quantity_requested: Math.max(0, toMoney(input.quantity_requested)),
    reason: trimOrNull(input.reason, 5000),
    notes: trimOrNull(input.notes, 5000),
  };
}

function toMaterialIssuePayload(input: MaterialIssueInput): Obj {
  return {
    items: input.items.map((item) => ({
      uuid: trimText(item.uuid, 100),
      quantity_issued: Math.max(0, toMoney(item.quantity_issued)),
    })),
    notes: trimOrNull(input.notes, 5000),
    issue_date: input.issue_date ? new Date(input.issue_date).toISOString() : null,
  };
}

function toAssetAllocationPayload(input: AssetAllocationInput): Obj {
  return {
    asset_id: toId(input.asset_id),
    quantity_allocated: Math.max(0, toMoney(input.quantity_allocated)),
    assigned_date: trimText(input.assigned_date, 50),
    condition_on_issue: trimOrNull(input.condition_on_issue, 255),
    notes: trimOrNull(input.notes, 5000),
  };
}

function toAssetReturnPayload(input: AssetReturnInput): Obj {
  return {
    return_date: trimText(input.return_date, 50),
    return_status: input.return_status,
    quantity_returned:
      input.quantity_returned === null || input.quantity_returned === undefined
        ? null
        : Math.max(0, toMoney(input.quantity_returned)),
    warehouse_id: input.return_status === "lost" ? null : toNullableId(input.warehouse_id),
    condition_on_return: trimOrNull(input.condition_on_return, 255),
    notes: trimOrNull(input.notes, 5000),
  };
}

const materialRequestsConfig: PullConfig<MaterialRequestRow> = {
  entity: "material_requests",
  endpoint: "/api/material-requests",
  cursorKey: MATERIAL_REQUESTS_CURSOR_KEY,
  cleanupKey: MATERIAL_REQUESTS_CLEANUP_KEY,
  table: db.material_requests,
  sanitize: sanitizeMaterialRequest,
  decorate: decorateMaterialRequest,
  isValid: (row) => Boolean(row.uuid && row.request_no && row.warehouse_id > 0 && row.requested_by_employee_id > 0),
  matchesSearch: matchesMaterialRequestSearch,
};

const assetRequestsConfig: PullConfig<AssetRequestRow> = {
  entity: "asset_requests",
  endpoint: "/api/asset-requests",
  cursorKey: ASSET_REQUESTS_CURSOR_KEY,
  cleanupKey: ASSET_REQUESTS_CLEANUP_KEY,
  table: db.asset_requests,
  sanitize: sanitizeAssetRequest,
  decorate: decorateAssetRequest,
  isValid: (row) => Boolean(row.uuid && row.request_no && row.requested_by_employee_id > 0),
  matchesSearch: matchesAssetRequestSearch,
};

export async function materialRequestsRetentionCleanupIfDue(): Promise<number> {
  return retentionCleanupIfDue(materialRequestsConfig);
}

export async function assetRequestsRetentionCleanupIfDue(): Promise<number> {
  return retentionCleanupIfDue(assetRequestsConfig);
}

export async function materialRequestsListLocal(query: LocalQuery = {}): Promise<LocalPage<MaterialRequestRow>> {
  await materialRequestsRetentionCleanupIfDue();
  const page = await listLocal(materialRequestsConfig, query);
  return {
    ...page,
    items: await Promise.all(page.items.map((item) => decorateMaterialRequest(item))),
  };
}

export async function assetRequestsListLocal(query: LocalQuery = {}): Promise<LocalPage<AssetRequestRow>> {
  await assetRequestsRetentionCleanupIfDue();
  const page = await listLocal(assetRequestsConfig, query);
  return {
    ...page,
    items: await Promise.all(page.items.map((item) => decorateAssetRequest(item))),
  };
}

export async function materialRequestsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(materialRequestsConfig);
}

export async function assetRequestsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(assetRequestsConfig);
}
export async function materialRequestCreate(input: MaterialRequestInput): Promise<MaterialRequestRow> {
  validateMaterialRequestInput(input);

  const uuid = crypto.randomUUID();
  const payload = toMaterialRequestPayload(input);
  const row = await decorateMaterialRequest(
    sanitizeMaterialRequest({
      id: deriveIdFromUuid(uuid),
      uuid,
      request_no: `MR-LOCAL-${uuid.slice(0, 8).toUpperCase()}`,
      ...payload,
      status: "pending",
      requested_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  );

  if (!isOnline()) {
    await db.material_requests.put(row);
    await enqueueSync({
      entity: "material_requests",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Material request saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post(materialRequestsConfig.endpoint, { uuid, ...payload });
    const saved = await decorateMaterialRequest(sanitizeMaterialRequest(obj(response.data).data ?? row));
    await db.material_requests.put(saved);
    notifySuccess("Material request created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.material_requests.put(row);
    await enqueueSync({
      entity: "material_requests",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Material request saved locally. Server sync will retry later.");
    return row;
  }
}

export async function materialRequestUpdate(uuid: string, input: MaterialRequestInput): Promise<MaterialRequestRow> {
  validateMaterialRequestInput(input);

  const existing = await db.material_requests.get(uuid);
  if (!existing) throw new Error("Material request not found locally.");

  const payload = toMaterialRequestPayload(input);
  const updated = await decorateMaterialRequest(
    sanitizeMaterialRequest({
      ...existing,
      ...payload,
      updated_at: Date.now(),
      status: existing.status || "pending",
      request_no: existing.request_no,
    })
  );

  await db.material_requests.put(updated);
  await enqueueSync({
    entity: "material_requests",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Material request updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`${materialRequestsConfig.endpoint}/${uuid}`, payload);
    const saved = await decorateMaterialRequest(sanitizeMaterialRequest(obj(response.data).data ?? updated));
    await db.material_requests.put(saved);
    notifySuccess("Material request updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.material_requests.put(existing);
      await removeLatestQueueItem("material_requests", uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Material request updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function materialRequestDelete(uuid: string): Promise<void> {
  const existing = await db.material_requests.get(uuid);
  if (!existing) throw new Error("Material request not found locally.");

  await db.material_requests.delete(uuid);
  await enqueueSync({
    entity: "material_requests",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Material request deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`${materialRequestsConfig.endpoint}/${uuid}`);
    notifySuccess("Material request deleted successfully.");
  } catch {
    notifyInfo("Material request deleted locally. Server sync will retry later.");
  }
}

export async function materialRequestApprove(uuid: string): Promise<MaterialRequestRow> {
  if (!isOnline()) {
    throw new Error("Material request approval requires an online connection.");
  }

  try {
    const response = await api.post(`${materialRequestsConfig.endpoint}/${uuid}/approve`);
    const saved = await decorateMaterialRequest(sanitizeMaterialRequest(obj(response.data).data));
    await db.material_requests.put(saved);
    await warehouseMaterialStocksPullToLocal();
    notifySuccess("Material request approved.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function materialRequestReject(uuid: string): Promise<MaterialRequestRow> {
  if (!isOnline()) {
    throw new Error("Material request rejection requires an online connection.");
  }

  try {
    const response = await api.post(`${materialRequestsConfig.endpoint}/${uuid}/reject`);
    const saved = await decorateMaterialRequest(sanitizeMaterialRequest(obj(response.data).data));
    await db.material_requests.put(saved);
    notifySuccess("Material request rejected.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function materialRequestIssue(uuid: string, input: MaterialIssueInput): Promise<MaterialRequestRow> {
  validateMaterialIssueInput(input);

  if (!isOnline()) {
    throw new Error("Material issuing requires an online connection.");
  }

  try {
    const response = await api.post(`${materialRequestsConfig.endpoint}/${uuid}/issue`, toMaterialIssuePayload(input));
    const saved = await decorateMaterialRequest(sanitizeMaterialRequest(obj(response.data).data));
    await db.material_requests.put(saved);
    await Promise.all([
      materialsPullToLocal(),
      stockMovementsPullToLocal(),
      warehouseMaterialStocksPullToLocal(),
      projectMaterialStocksPullToLocal(),
    ]);
    notifySuccess("Material request issued successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}
export async function assetRequestCreate(input: AssetRequestInput): Promise<AssetRequestRow> {
  validateAssetRequestInput(input);

  const uuid = crypto.randomUUID();
  const payload = toAssetRequestPayload(input);
  const row = await decorateAssetRequest(
    sanitizeAssetRequest({
      id: deriveIdFromUuid(uuid),
      uuid,
      request_no: `AR-LOCAL-${uuid.slice(0, 8).toUpperCase()}`,
      ...payload,
      status: "pending",
      requested_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  );

  if (!isOnline()) {
    await db.asset_requests.put(row);
    await enqueueSync({
      entity: "asset_requests",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Asset request saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post(assetRequestsConfig.endpoint, { uuid, ...payload });
    const saved = await decorateAssetRequest(sanitizeAssetRequest(obj(response.data).data ?? row));
    await db.asset_requests.put(saved);
    notifySuccess("Asset request created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.asset_requests.put(row);
    await enqueueSync({
      entity: "asset_requests",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Asset request saved locally. Server sync will retry later.");
    return row;
  }
}

export async function assetRequestUpdate(uuid: string, input: AssetRequestInput): Promise<AssetRequestRow> {
  validateAssetRequestInput(input);

  const existing = await db.asset_requests.get(uuid);
  if (!existing) throw new Error("Asset request not found locally.");

  const payload = toAssetRequestPayload(input);
  const updated = await decorateAssetRequest(
    sanitizeAssetRequest({
      ...existing,
      ...payload,
      updated_at: Date.now(),
      status: existing.status || "pending",
      request_no: existing.request_no,
    })
  );

  await db.asset_requests.put(updated);
  await enqueueSync({
    entity: "asset_requests",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Asset request updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`${assetRequestsConfig.endpoint}/${uuid}`, payload);
    const saved = await decorateAssetRequest(sanitizeAssetRequest(obj(response.data).data ?? updated));
    await db.asset_requests.put(saved);
    notifySuccess("Asset request updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.asset_requests.put(existing);
      await removeLatestQueueItem("asset_requests", uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Asset request updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function assetRequestDelete(uuid: string): Promise<void> {
  const existing = await db.asset_requests.get(uuid);
  if (!existing) throw new Error("Asset request not found locally.");

  await db.asset_requests.delete(uuid);
  await enqueueSync({
    entity: "asset_requests",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Asset request deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`${assetRequestsConfig.endpoint}/${uuid}`);
    notifySuccess("Asset request deleted successfully.");
  } catch {
    notifyInfo("Asset request deleted locally. Server sync will retry later.");
  }
}

export async function assetRequestApprove(uuid: string): Promise<AssetRequestRow> {
  if (!isOnline()) {
    throw new Error("Asset request approval requires an online connection.");
  }

  try {
    const response = await api.post(`${assetRequestsConfig.endpoint}/${uuid}/approve`);
    const saved = await decorateAssetRequest(sanitizeAssetRequest(obj(response.data).data));
    await db.asset_requests.put(saved);
    notifySuccess("Asset request approved.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function assetRequestReject(uuid: string): Promise<AssetRequestRow> {
  if (!isOnline()) {
    throw new Error("Asset request rejection requires an online connection.");
  }

  try {
    const response = await api.post(`${assetRequestsConfig.endpoint}/${uuid}/reject`);
    const saved = await decorateAssetRequest(sanitizeAssetRequest(obj(response.data).data));
    await db.asset_requests.put(saved);
    notifySuccess("Asset request rejected.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function assetRequestAllocate(uuid: string, input: AssetAllocationInput): Promise<AssetRequestRow> {
  validateAssetAllocationInput(input);

  if (!isOnline()) {
    throw new Error("Asset allocation requires an online connection.");
  }

  try {
    const response = await api.post(`${assetRequestsConfig.endpoint}/${uuid}/allocate`, toAssetAllocationPayload(input));
    const saved = await decorateAssetRequest(sanitizeAssetRequest(obj(response.data).data));
    await db.asset_requests.put(saved);
    await companyAssetsPullToLocal();
    notifySuccess("Asset allocated successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function assetRequestReturn(uuid: string, input: AssetReturnInput): Promise<AssetRequestRow> {
  validateAssetReturnInput(input);

  if (!isOnline()) {
    throw new Error("Asset return requires an online connection.");
  }

  try {
    const response = await api.post(`${assetRequestsConfig.endpoint}/${uuid}/return`, toAssetReturnPayload(input));
    const saved = await decorateAssetRequest(sanitizeAssetRequest(obj(response.data).data));
    await db.asset_requests.put(saved);
    await companyAssetsPullToLocal();
    notifySuccess("Asset return saved successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}
