import type { Table } from "dexie";
import {
  db,
  type CompanyAssetRow,
  type EmployeeRow,
  type MaterialRow,
  type ProjectRow,
  type PurchaseRequestItemRow,
  type PurchaseRequestRow,
  type VendorRow,
  type WarehouseRow,
} from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { employeePullToLocal } from "@/modules/employees/employees.repo";
import {
  projectMaterialStocksPullToLocal,
  warehouseMaterialStocksPullToLocal,
} from "@/modules/material-stocks/material-stocks.repo";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { companyAssetsPullToLocal, materialsPullToLocal, vendorsPullToLocal, warehousesPullToLocal } from "@/modules/inventories/inventories.repo";
import { projectsPullToLocal } from "@/modules/projects/projects.repo";
import { stockMovementsPullToLocal } from "@/modules/stock-movements/stock-movements.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 500;
const PULL_PAGE_SIZE = 200;
const PURCHASE_REQUESTS_CURSOR_KEY = "purchase_requests_sync_cursor";
const PURCHASE_REQUESTS_CLEANUP_KEY = "purchase_requests_last_cleanup_ms";
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

export type PurchaseRequestItemInput = {
  uuid?: string;
  item_kind?: "material" | "asset";
  material_id?: number | null;
  company_asset_id?: number | null;
  asset_name?: string | null;
  asset_type?: string | null;
  asset_code_prefix?: string | null;
  quantity_requested: number;
  estimated_unit_price?: number | null;
  unit: string;
  notes?: string | null;
};

export type PurchaseRequestInput = {
  request_type: "material" | "asset";
  source_material_request_id?: number | null;
  project_id?: number | null;
  warehouse_id: number;
  vendor_id?: number | null;
  requested_by_employee_id: number;
  notes?: string | null;
  items: PurchaseRequestItemInput[];
};

export type PurchaseReceiveInput = {
  items: Array<{ uuid: string; quantity_received: number; actual_unit_price?: number | null }>;
  notes?: string | null;
  receive_date?: string | null;
};

type PullConfig<Row extends { uuid: string; updated_at: number }> = {
  entity: "purchase_requests";
  endpoint: string;
  cursorKey: string;
  cleanupKey: string;
  table: Table<Row, string>;
  sanitize: (input: unknown) => Row;
  decorate: (row: Row) => Promise<Row>;
  isValid: (row: Row) => boolean;
  matchesSearch: (row: Row, query: string) => boolean;
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

async function getVendorSnapshot(vendorId: number): Promise<VendorRow | undefined> {
  const direct = await db.vendors.filter((item) => Number(item.id) === vendorId).first();
  if (direct) return direct;
  return db.vendors.where("updated_at").above(0).filter((item) => Number(item.id) === vendorId).first();
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

async function getCompanyAssetSnapshot(companyAssetId: number): Promise<CompanyAssetRow | undefined> {
  const direct = await db.company_assets.filter((item) => Number(item.id) === companyAssetId).first();
  if (direct) return direct;
  return db.company_assets.where("updated_at").above(0).filter((item) => Number(item.id) === companyAssetId).first();
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

async function decoratePurchaseRequestItems(items: PurchaseRequestItemRow[]): Promise<PurchaseRequestItemRow[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.item_kind === "asset") {
        const companyAsset =
          item.company_asset_id && (!item.company_asset_code || !item.company_asset_uuid || !item.asset_name || !item.asset_type)
            ? await getCompanyAssetSnapshot(Number(item.company_asset_id))
            : undefined;
        return {
          ...item,
          material_id: item.material_id ?? null,
          company_asset_id: item.company_asset_id ?? null,
          company_asset_uuid: item.company_asset_uuid ?? companyAsset?.uuid ?? null,
          company_asset_code: item.company_asset_code ?? companyAsset?.asset_code ?? null,
          asset_name: item.asset_name ?? companyAsset?.asset_name ?? null,
          asset_type: item.asset_type ?? companyAsset?.asset_type ?? null,
        };
      }
      if (item.material_name && item.material_uuid) return item;
      const material = item.material_id ? await getMaterialSnapshot(item.material_id) : undefined;
      return {
        ...item,
        material_uuid: item.material_uuid ?? material?.uuid ?? null,
        material_name: item.material_name ?? material?.name ?? null,
      };
    })
  );
}

async function decoratePurchaseRequest(row: PurchaseRequestRow): Promise<PurchaseRequestRow> {
  const [vendor, warehouse, employee, project, items] = await Promise.all([
    !row.vendor_name && (row.vendor_id ?? 0) > 0 ? getVendorSnapshot(Number(row.vendor_id)) : Promise.resolve(undefined),
    !row.warehouse_name && row.warehouse_id > 0 ? getWarehouseSnapshot(row.warehouse_id) : Promise.resolve(undefined),
    !row.requested_by_employee_name && row.requested_by_employee_id > 0 ? getEmployeeSnapshot(row.requested_by_employee_id) : Promise.resolve(undefined),
    !row.project_name && (row.project_id ?? 0) > 0 ? getProjectSnapshot(Number(row.project_id)) : Promise.resolve(undefined),
    decoratePurchaseRequestItems(row.items ?? []),
  ]);

  return {
    ...row,
    vendor_uuid: row.vendor_uuid ?? vendor?.uuid ?? null,
    vendor_name: row.vendor_name ?? vendor?.name ?? null,
    warehouse_uuid: row.warehouse_uuid ?? warehouse?.uuid ?? null,
    warehouse_name: row.warehouse_name ?? warehouse?.name ?? null,
    requested_by_employee_uuid: row.requested_by_employee_uuid ?? employee?.uuid ?? null,
    requested_by_employee_name: row.requested_by_employee_name ?? buildEmployeeName(employee),
    project_uuid: row.project_uuid ?? project?.uuid ?? null,
    project_name: row.project_name ?? project?.name ?? null,
    items,
  };
}

function sanitizePurchaseRequestItem(input: unknown): PurchaseRequestItemRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  const itemKind = String(record.item_kind ?? "").trim().toLowerCase() === "asset" ? "asset" : "material";
  return {
    id: toRowId(record.id, uuid),
    uuid,
    item_kind: itemKind,
    material_id: itemKind === "material" ? toNullableId(record.material_id) : null,
    material_uuid: trimOrNull(record.material_uuid, 100),
    material_name: trimOrNull(record.material_name, 255),
    company_asset_id: itemKind === "asset" ? toNullableId(record.company_asset_id) : null,
    company_asset_uuid: trimOrNull(record.company_asset_uuid, 100),
    company_asset_code: trimOrNull(record.company_asset_code, 100),
    asset_name: trimOrNull(record.asset_name, 255),
    asset_type: trimOrNull(record.asset_type, 50),
    asset_code_prefix: trimOrNull(record.asset_code_prefix, 50),
    unit: trimText(record.unit, 100),
    quantity_requested: Math.max(0, toMoney(record.quantity_requested)),
    quantity_approved: Math.max(0, toMoney(record.quantity_approved)),
    quantity_received: Math.max(0, toMoney(record.quantity_received)),
    estimated_unit_price:
      record.estimated_unit_price === null || record.estimated_unit_price === undefined || String(record.estimated_unit_price).trim() === ""
        ? null
        : Math.max(0, toMoney(record.estimated_unit_price)),
    estimated_line_total:
      record.estimated_line_total === null || record.estimated_line_total === undefined || String(record.estimated_line_total).trim() === ""
        ? null
        : Math.max(0, toMoney(record.estimated_line_total)),
    actual_unit_price:
      record.actual_unit_price === null || record.actual_unit_price === undefined || String(record.actual_unit_price).trim() === ""
        ? null
        : Math.max(0, toMoney(record.actual_unit_price)),
    actual_line_total:
      record.actual_line_total === null || record.actual_line_total === undefined || String(record.actual_line_total).trim() === ""
        ? null
        : Math.max(0, toMoney(record.actual_line_total)),
    notes: trimOrNull(record.notes, 1000),
  };
}

function sanitizePurchaseRequest(input: unknown): PurchaseRequestRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  const requestNo = trimText(record.request_no, 100) || `PR-LOCAL-${uuid.slice(0, 8).toUpperCase()}`;
  const rawItems = Array.isArray(record.items) ? record.items : [];

  return {
    id: toRowId(record.id, uuid),
    uuid,
    request_no: requestNo,
    request_type: String(record.request_type ?? "").trim().toLowerCase() === "asset" ? "asset" : "material",
    source_material_request_id: toNullableId(record.source_material_request_id),
    source_material_request_uuid: trimOrNull(record.source_material_request_uuid, 100),
    source_material_request_no: trimOrNull(record.source_material_request_no, 100),
    project_id: toNullableId(record.project_id),
    project_uuid: trimOrNull(record.project_uuid, 100),
    project_name: trimOrNull(record.project_name, 255),
    warehouse_id: toId(record.warehouse_id),
    warehouse_uuid: trimOrNull(record.warehouse_uuid, 100),
    warehouse_name: trimOrNull(record.warehouse_name, 255),
    vendor_id: toNullableId(record.vendor_id),
    vendor_uuid: trimOrNull(record.vendor_uuid, 100),
    vendor_name: trimOrNull(record.vendor_name, 255),
    requested_by_employee_id: toId(record.requested_by_employee_id),
    requested_by_employee_uuid: trimOrNull(record.requested_by_employee_uuid, 100),
    requested_by_employee_name: trimOrNull(record.requested_by_employee_name, 255),
    status: trimText(record.status, 50) || "pending",
    approved_by_user_id: toNullableId(record.approved_by_user_id),
    approved_by_user_name: trimOrNull(record.approved_by_user_name, 255),
    approved_at: toNullableTs(record.approved_at),
    received_by_user_id: toNullableId(record.received_by_user_id),
    received_by_user_name: trimOrNull(record.received_by_user_name, 255),
    received_at: toNullableTs(record.received_at),
    purchase_receipt_no: trimOrNull(record.purchase_receipt_no, 100),
    requested_at: toNullableTs(record.requested_at) ?? Date.now(),
    notes: trimOrNull(record.notes, 5000),
    items: rawItems
      .map(sanitizePurchaseRequestItem)
      .filter(
        (item) =>
          item.uuid &&
          item.unit &&
          ((item.item_kind === "material" && Number(item.material_id ?? 0) > 0) ||
            (item.item_kind === "asset" &&
              ((Number(item.company_asset_id ?? 0) > 0) || (Boolean(item.asset_name) && Boolean(item.asset_type)))))
      ),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesPurchaseRequestSearch(row: PurchaseRequestRow, query: string): boolean {
  return [
    row.request_no,
    row.request_type,
    row.source_material_request_no,
    row.vendor_name,
    row.warehouse_name,
    row.project_name,
    row.requested_by_employee_name,
    row.status,
    row.purchase_receipt_no,
    row.notes,
    ...(row.items ?? []).flatMap((item) => [
      item.material_name,
      item.company_asset_code,
      item.asset_name,
      item.asset_type,
      item.asset_code_prefix,
      item.unit,
    ]),
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

async function listLocal<Row extends { uuid: string; updated_at: number }>(
  config: Pick<PullConfig<Row>, "table" | "matchesSearch">,
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

async function retentionCleanup(config: PullConfig<PurchaseRequestRow>): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays(config.entity, RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals(config.entity).toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = await config.table.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await config.table.bulkDelete(removable);
  }
  return removable.length;
}

async function retentionCleanupIfDue(config: PullConfig<PurchaseRequestRow>): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(config.cleanupKey);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await retentionCleanup(config);
  lsSet(config.cleanupKey, String(now));
  return removed;
}

async function pullToLocal(config: PullConfig<PurchaseRequestRow>): Promise<{ pulled: number }> {
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

    if (rows.length) {
      rows = await Promise.all(rows.map((row) => config.decorate(row)));
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

function validatePurchaseRequestInput(input: PurchaseRequestInput): void {
  if (!["material", "asset"].includes(input.request_type)) {
    throw new Error("Purchase request type is required.");
  }
  if (!Number.isFinite(input.warehouse_id) || input.warehouse_id <= 0) {
    throw new Error("Warehouse is required.");
  }
  if (!Number.isFinite(input.requested_by_employee_id) || input.requested_by_employee_id <= 0) {
    throw new Error("Requested by employee is required.");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("At least one purchase item is required.");
  }

  input.items.forEach((item, index) => {
    const itemKind = item.item_kind === "asset" ? "asset" : input.request_type;
    if (itemKind === "material" && (!Number.isFinite(item.material_id) || Number(item.material_id) <= 0)) {
      throw new Error(`Material is required for item ${index + 1}.`);
    }
    if (itemKind === "asset" && (!Number.isFinite(item.company_asset_id) || Number(item.company_asset_id) <= 0) && !trimText(item.asset_name, 255)) {
      throw new Error(`Asset name is required for item ${index + 1}.`);
    }
    if (
      itemKind === "asset" &&
      (!Number.isFinite(item.company_asset_id) || Number(item.company_asset_id) <= 0) &&
      !["vehicle", "machine", "tool", "IT"].includes(trimText(item.asset_type, 50) || "")
    ) {
      throw new Error(`Asset type is required for item ${index + 1}.`);
    }
    if (!Number.isFinite(item.quantity_requested) || item.quantity_requested <= 0) {
      throw new Error(`Requested quantity must be greater than 0 for item ${index + 1}.`);
    }
    if (
      item.estimated_unit_price !== null &&
      item.estimated_unit_price !== undefined &&
      (!Number.isFinite(item.estimated_unit_price) || item.estimated_unit_price < 0)
    ) {
      throw new Error(`Estimated unit price must be 0 or greater for item ${index + 1}.`);
    }
    if (!trimText(item.unit, 100)) {
      throw new Error(`Unit is required for item ${index + 1}.`);
    }
  });
}

function validatePurchaseReceiveInput(input: PurchaseReceiveInput): void {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("At least one receive item is required.");
  }

  input.items.forEach((item, index) => {
    if (!trimText(item.uuid, 100)) {
      throw new Error(`Receive row ${index + 1} is missing a target item.`);
    }
    if (!Number.isFinite(item.quantity_received) || item.quantity_received <= 0) {
      throw new Error(`Received quantity must be greater than 0 for row ${index + 1}.`);
    }
    if (
      item.actual_unit_price !== null &&
      item.actual_unit_price !== undefined &&
      (!Number.isFinite(item.actual_unit_price) || item.actual_unit_price < 0)
    ) {
      throw new Error(`Actual unit price must be 0 or greater for row ${index + 1}.`);
    }
  });
}

function toPurchaseRequestPayload(input: PurchaseRequestInput): Obj {
  return {
    request_type: input.request_type,
    source_material_request_id: toNullableId(input.source_material_request_id),
    project_id: toNullableId(input.project_id),
    warehouse_id: toId(input.warehouse_id),
    vendor_id: toNullableId(input.vendor_id),
    requested_by_employee_id: toId(input.requested_by_employee_id),
    notes: trimOrNull(input.notes, 5000),
    items: input.items.map((item) => ({
      uuid: trimText(item.uuid, 100) || crypto.randomUUID(),
      item_kind: item.item_kind === "asset" ? "asset" : input.request_type,
      material_id: input.request_type === "material" || item.item_kind === "material" ? toNullableId(item.material_id) : null,
      company_asset_id: input.request_type === "asset" || item.item_kind === "asset" ? toNullableId(item.company_asset_id) : null,
      asset_name: trimOrNull(item.asset_name, 255),
      asset_type: trimOrNull(item.asset_type, 50),
      asset_code_prefix: trimOrNull(item.asset_code_prefix, 50),
      quantity_requested: Math.max(0, toMoney(item.quantity_requested)),
      estimated_unit_price:
        item.estimated_unit_price === null || item.estimated_unit_price === undefined
          ? null
          : Math.max(0, toMoney(item.estimated_unit_price)),
      unit: trimText(item.unit, 100),
      notes: trimOrNull(item.notes, 1000),
    })),
  };
}

function toPurchaseReceivePayload(input: PurchaseReceiveInput): Obj {
  return {
    items: input.items.map((item) => ({
      uuid: trimText(item.uuid, 100),
      quantity_received: Math.max(0, toMoney(item.quantity_received)),
      actual_unit_price:
        item.actual_unit_price === null || item.actual_unit_price === undefined
          ? null
          : Math.max(0, toMoney(item.actual_unit_price)),
    })),
    notes: trimOrNull(input.notes, 5000),
    receive_date: input.receive_date ? new Date(input.receive_date).toISOString() : null,
  };
}

const purchaseRequestsConfig: PullConfig<PurchaseRequestRow> = {
  entity: "purchase_requests",
  endpoint: "/api/purchase-requests",
  cursorKey: PURCHASE_REQUESTS_CURSOR_KEY,
  cleanupKey: PURCHASE_REQUESTS_CLEANUP_KEY,
  table: db.purchase_requests,
  sanitize: sanitizePurchaseRequest,
  decorate: decoratePurchaseRequest,
  isValid: (row) => Boolean(row.uuid && row.request_no && row.warehouse_id > 0 && row.requested_by_employee_id > 0),
  matchesSearch: matchesPurchaseRequestSearch,
};

export async function purchaseRequestsRetentionCleanupIfDue(): Promise<number> {
  return retentionCleanupIfDue(purchaseRequestsConfig);
}

export async function purchaseRequestsListLocal(query: LocalQuery = {}): Promise<LocalPage<PurchaseRequestRow>> {
  await purchaseRequestsRetentionCleanupIfDue();
  const page = await listLocal(purchaseRequestsConfig, query);
  return {
    ...page,
    items: await Promise.all(page.items.map((item) => decoratePurchaseRequest(item))),
  };
}

export async function purchaseRequestsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(purchaseRequestsConfig);
}

export async function purchaseRequestCreate(input: PurchaseRequestInput): Promise<PurchaseRequestRow> {
  validatePurchaseRequestInput(input);

  const uuid = crypto.randomUUID();
  const payload = toPurchaseRequestPayload(input);
  const row = await decoratePurchaseRequest(
    sanitizePurchaseRequest({
      id: deriveIdFromUuid(uuid),
      uuid,
      request_no: `PR-LOCAL-${uuid.slice(0, 8).toUpperCase()}`,
      ...payload,
      status: "pending",
      requested_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  );

  if (!isOnline()) {
    await db.purchase_requests.put(row);
    await enqueueSync({
      entity: "purchase_requests",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Purchase request saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post(purchaseRequestsConfig.endpoint, { uuid, ...payload });
    const saved = await decoratePurchaseRequest(sanitizePurchaseRequest(obj(response.data).data ?? row));
    await db.purchase_requests.put(saved);
    notifySuccess("Purchase request created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.purchase_requests.put(row);
    await enqueueSync({
      entity: "purchase_requests",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Purchase request saved locally. Server sync will retry later.");
    return row;
  }
}

export async function purchaseRequestUpdate(uuid: string, input: PurchaseRequestInput): Promise<PurchaseRequestRow> {
  validatePurchaseRequestInput(input);

  const existing = await db.purchase_requests.get(uuid);
  if (!existing) throw new Error("Purchase request not found locally.");

  const payload = toPurchaseRequestPayload(input);
  const updated = await decoratePurchaseRequest(
    sanitizePurchaseRequest({
      ...existing,
      ...payload,
      updated_at: Date.now(),
      status: existing.status || "pending",
      request_no: existing.request_no,
    })
  );

  await db.purchase_requests.put(updated);
  await enqueueSync({
    entity: "purchase_requests",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Purchase request updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`${purchaseRequestsConfig.endpoint}/${uuid}`, payload);
    const saved = await decoratePurchaseRequest(sanitizePurchaseRequest(obj(response.data).data ?? updated));
    await db.purchase_requests.put(saved);
    notifySuccess("Purchase request updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.purchase_requests.put(existing);
      await removeLatestQueueItem("purchase_requests", uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Purchase request updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function purchaseRequestDelete(uuid: string): Promise<void> {
  const existing = await db.purchase_requests.get(uuid);
  if (!existing) throw new Error("Purchase request not found locally.");

  await db.purchase_requests.delete(uuid);
  await enqueueSync({
    entity: "purchase_requests",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Purchase request deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`${purchaseRequestsConfig.endpoint}/${uuid}`);
    notifySuccess("Purchase request deleted successfully.");
  } catch {
    notifyInfo("Purchase request deleted locally. Server sync will retry later.");
  }
}

export async function purchaseRequestApprove(uuid: string): Promise<PurchaseRequestRow> {
  if (!isOnline()) {
    throw new Error("Purchase request approval requires an online connection.");
  }

  try {
    const response = await api.post(`${purchaseRequestsConfig.endpoint}/${uuid}/approve`);
    const saved = await decoratePurchaseRequest(sanitizePurchaseRequest(obj(response.data).data));
    await db.purchase_requests.put(saved);
    notifySuccess("Purchase request approved.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function purchaseRequestReject(uuid: string): Promise<PurchaseRequestRow> {
  if (!isOnline()) {
    throw new Error("Purchase request rejection requires an online connection.");
  }

  try {
    const response = await api.post(`${purchaseRequestsConfig.endpoint}/${uuid}/reject`);
    const saved = await decoratePurchaseRequest(sanitizePurchaseRequest(obj(response.data).data));
    await db.purchase_requests.put(saved);
    notifySuccess("Purchase request rejected.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function purchaseRequestReceive(uuid: string, input: PurchaseReceiveInput): Promise<PurchaseRequestRow> {
  validatePurchaseReceiveInput(input);

  if (!isOnline()) {
    throw new Error("Purchase receiving requires an online connection.");
  }

  try {
    const response = await api.post(`${purchaseRequestsConfig.endpoint}/${uuid}/receive`, toPurchaseReceivePayload(input));
    const saved = await decoratePurchaseRequest(sanitizePurchaseRequest(obj(response.data).data));
    await db.purchase_requests.put(saved);
    await Promise.all([
      materialsPullToLocal(),
      stockMovementsPullToLocal(),
      warehouseMaterialStocksPullToLocal(),
      projectMaterialStocksPullToLocal(),
      companyAssetsPullToLocal(),
    ]);
    notifySuccess("Purchase items received successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function purchaseRequestsRefreshDependencies(): Promise<void> {
  await Promise.all([
    purchaseRequestsPullToLocal(),
    materialsPullToLocal(),
    vendorsPullToLocal(),
    warehousesPullToLocal(),
    warehouseMaterialStocksPullToLocal(),
    projectMaterialStocksPullToLocal(),
    companyAssetsPullToLocal(),
    employeePullToLocal(),
    projectsPullToLocal(),
  ]);
}
