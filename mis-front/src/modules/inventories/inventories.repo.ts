import { Table } from "dexie";
import {
  db,
  type CompanyAssetRow,
  type EmployeeRow,
  type MaterialRow,
  type ProjectRow,
  type VendorRow,
  type WarehouseRow,
} from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 5000;
const PULL_PAGE_SIZE = 200;
const isValidationError = (status?: number) => status === 409 || status === 422;

const VENDORS_CURSOR_KEY = "vendors_sync_cursor";
const WAREHOUSES_CURSOR_KEY = "warehouses_sync_cursor";
const MATERIALS_CURSOR_KEY = "materials_sync_cursor";
const COMPANY_ASSETS_CURSOR_KEY = "company_assets_sync_cursor";

const VENDORS_CLEANUP_KEY = "vendors_last_cleanup_ms";
const WAREHOUSES_CLEANUP_KEY = "warehouses_last_cleanup_ms";
const MATERIALS_CLEANUP_KEY = "materials_last_cleanup_ms";
const COMPANY_ASSETS_CLEANUP_KEY = "company_assets_last_cleanup_ms";

type Obj = Record<string, unknown>;

type InventoryLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type InventoryLocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type VendorInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string;
};

export type WarehouseInput = {
  name: string;
  location?: string | null;
  status?: string;
};

export type MaterialInput = {
  name: string;
  material_type?: string | null;
  unit: string;
  quantity: number;
  supplier_id?: number | null;
  batch_no?: string | null;
  serial_no?: string | null;
  expiry_date?: string | null;
  min_stock_level?: number;
  status?: string;
  notes?: string | null;
};

export type CompanyAssetInput = {
  asset_code: string;
  asset_name: string;
  asset_type: string;
  supplier_id?: number | null;
  serial_no?: string | null;
  status?: string;
  current_employee_id?: number | null;
  current_project_id?: number | null;
  notes?: string | null;
};

type InventoryModuleKey = "vendors" | "warehouses" | "materials" | "company_assets";

type LocalListConfig<Row extends { uuid: string; updated_at: number }> = {
  table: Table<Row, string>;
  matchesSearch: (row: Row, query: string) => boolean;
};

type PullConfig<Row extends { uuid: string; updated_at: number }> = LocalListConfig<Row> & {
  entity: InventoryModuleKey;
  endpoint: string;
  cursorKey: string;
  cleanupKey: string;
  sanitize: (input: unknown) => Row;
  isValid: (row: Row) => boolean;
  decorate?: (row: Row) => Promise<Row>;
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
    return {
      list: topData.map(obj),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  const paged = obj(topData);
  if (Array.isArray(paged.data)) {
    const currentPage = Number(paged.current_page ?? 1);
    const lastPage = Number(paged.last_page ?? 1);
    return {
      list: paged.data.map(obj),
      hasMore: currentPage < lastPage,
      serverTime: String(meta.server_time ?? nowIso()),
    };
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
      if (item.entity === entity && item.id !== undefined) {
        ids.push(item.id);
      }
    }
  }

  if (ids.length) {
    await db.sync_queue.bulkDelete(ids);
  }
}

async function removeLatestQueueItem(entity: string, uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((item) => item.entity === entity && item.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}
async function getVendorSnapshot(vendorId: number): Promise<VendorRow | undefined> {
  const direct = await db.vendors.filter((item) => Number(item.id) === vendorId).first();
  if (direct) return direct;
  return db.vendors.where("updated_at").above(0).filter((item) => Number(item.id) === vendorId).first();
}

async function getEmployeeSnapshot(employeeId: number): Promise<EmployeeRow | undefined> {
  const direct = await db.employees.filter((item) => Number(item.id) === employeeId).first();
  if (direct) return direct;
  return db.employees.where("updated_at").above(0).filter((item) => Number(item.id) === employeeId).first();
}

async function getProjectSnapshot(projectId: number): Promise<ProjectRow | undefined> {
  const direct = await db.projects.filter((item) => Number(item.id) === projectId).first();
  if (direct) return direct;
  return db.projects.where("updated_at").above(0).filter((item) => Number(item.id) === projectId).first();
}

async function getVendorDecorators(vendorId: number | null): Promise<{
  supplier_id: number | null;
  supplier_uuid: string | null;
  supplier_name: string | null;
}> {
  if (!vendorId || vendorId <= 0) {
    return { supplier_id: null, supplier_uuid: null, supplier_name: null };
  }

  const vendor = await getVendorSnapshot(vendorId);
  if (!vendor) {
    return { supplier_id: vendorId, supplier_uuid: null, supplier_name: null };
  }

  return {
    supplier_id: vendorId,
    supplier_uuid: vendor.uuid || null,
    supplier_name: vendor.name || null,
  };
}

async function getEmployeeDecorators(employeeId: number | null): Promise<{
  current_employee_id: number | null;
  current_employee_uuid: string | null;
  current_employee_name: string | null;
}> {
  if (!employeeId || employeeId <= 0) {
    return { current_employee_id: null, current_employee_uuid: null, current_employee_name: null };
  }

  const employee = await getEmployeeSnapshot(employeeId);
  if (!employee) {
    return { current_employee_id: employeeId, current_employee_uuid: null, current_employee_name: null };
  }

  const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim();
  return {
    current_employee_id: employeeId,
    current_employee_uuid: employee.uuid || null,
    current_employee_name: fullName || employee.first_name || null,
  };
}

async function getProjectDecorators(projectId: number | null): Promise<{
  current_project_id: number | null;
  current_project_uuid: string | null;
  current_project_name: string | null;
}> {
  if (!projectId || projectId <= 0) {
    return { current_project_id: null, current_project_uuid: null, current_project_name: null };
  }

  const project = await getProjectSnapshot(projectId);
  if (!project) {
    return { current_project_id: projectId, current_project_uuid: null, current_project_name: null };
  }

  return {
    current_project_id: projectId,
    current_project_uuid: project.uuid || null,
    current_project_name: project.name || null,
  };
}

function matchesVendorSearch(row: VendorRow, query: string): boolean {
  return [row.name, row.phone, row.email, row.address, row.status].some((value) =>
    String(value ?? "").toLowerCase().includes(query)
  );
}

function matchesWarehouseSearch(row: WarehouseRow, query: string): boolean {
  return [row.name, row.location, row.status].some((value) =>
    String(value ?? "").toLowerCase().includes(query)
  );
}

function matchesMaterialSearch(row: MaterialRow, query: string): boolean {
  return [
    row.name,
    row.material_type,
    row.unit,
    row.supplier_name,
    row.batch_no,
    row.serial_no,
    row.status,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function matchesCompanyAssetSearch(row: CompanyAssetRow, query: string): boolean {
  return [
    row.asset_code,
    row.asset_name,
    row.asset_type,
    row.supplier_name,
    row.current_employee_name,
    row.current_project_name,
    row.serial_no,
    row.status,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function normalizeVendorStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

function normalizeWarehouseStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

function normalizeMaterialStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

function normalizeAssetStatus(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["allocated", "maintenance", "damaged", "retired"].includes(normalized) ? normalized : "available";
}

function normalizeAssetType(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized === "IT" ? "IT" : normalized.toLowerCase();
}

function sanitizeVendor(input: unknown): VendorRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    name: trimText(record.name, 255),
    phone: trimOrNull(record.phone, 50),
    email: trimOrNull(record.email, 255),
    address: trimOrNull(record.address, 4000),
    status: normalizeVendorStatus(record.status),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeWarehouse(input: unknown): WarehouseRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    name: trimText(record.name, 255),
    location: trimOrNull(record.location, 255),
    status: normalizeWarehouseStatus(record.status),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeMaterial(input: unknown): MaterialRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    name: trimText(record.name, 255),
    material_type: trimOrNull(record.material_type, 255),
    unit: trimText(record.unit, 100),
    quantity: Math.max(0, toMoney(record.quantity)),
    supplier_id: toNullableId(record.supplier_id),
    supplier_uuid: trimOrNull(record.supplier_uuid, 100),
    supplier_name: trimOrNull(record.supplier_name, 255),
    batch_no: trimOrNull(record.batch_no, 255),
    serial_no: trimOrNull(record.serial_no, 255),
    expiry_date: toNullableTs(record.expiry_date),
    min_stock_level: Math.max(0, toMoney(record.min_stock_level)),
    status: normalizeMaterialStatus(record.status),
    notes: trimOrNull(record.notes, 5000),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeCompanyAsset(input: unknown): CompanyAssetRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    asset_code: trimText(record.asset_code, 100),
    asset_name: trimText(record.asset_name, 255),
    asset_type: normalizeAssetType(record.asset_type),
    supplier_id: toNullableId(record.supplier_id),
    supplier_uuid: trimOrNull(record.supplier_uuid, 100),
    supplier_name: trimOrNull(record.supplier_name, 255),
    serial_no: trimOrNull(record.serial_no, 255),
    status: normalizeAssetStatus(record.status),
    current_employee_id: toNullableId(record.current_employee_id),
    current_employee_uuid: trimOrNull(record.current_employee_uuid, 100),
    current_employee_name: trimOrNull(record.current_employee_name, 255),
    current_project_id: toNullableId(record.current_project_id),
    current_project_uuid: trimOrNull(record.current_project_uuid, 100),
    current_project_name: trimOrNull(record.current_project_name, 255),
    notes: trimOrNull(record.notes, 5000),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

async function decorateMaterial(row: MaterialRow): Promise<MaterialRow> {
  if (row.supplier_name && row.supplier_uuid) return row;
  return {
    ...row,
    ...(await getVendorDecorators(row.supplier_id ?? null)),
  };
}

async function decorateCompanyAsset(row: CompanyAssetRow): Promise<CompanyAssetRow> {
  const supplierDecorators =
    row.supplier_name && row.supplier_uuid ? {} : await getVendorDecorators(row.supplier_id ?? null);
  const employeeDecorators =
    row.current_employee_name && row.current_employee_uuid ? {} : await getEmployeeDecorators(row.current_employee_id ?? null);
  const projectDecorators =
    row.current_project_name && row.current_project_uuid ? {} : await getProjectDecorators(row.current_project_id ?? null);
  return {
    ...row,
    ...supplierDecorators,
    ...employeeDecorators,
    ...projectDecorators,
  };
}
async function listLocal<Row extends { uuid: string; updated_at: number }>(
  config: LocalListConfig<Row>,
  query: InventoryLocalQuery = {}
): Promise<InventoryLocalPage<Row>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await config.table.count();
    const items = await config.table.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = config.table.orderBy("updated_at").reverse().filter((row) => config.matchesSearch(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

async function retentionCleanup<Row extends { uuid: string; updated_at: number }>(
  config: PullConfig<Row>
): Promise<number> {
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

async function retentionCleanupIfDue<Row extends { uuid: string; updated_at: number }>(
  config: PullConfig<Row>
): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(config.cleanupKey);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await retentionCleanup(config);
  lsSet(config.cleanupKey, String(now));
  return removed;
}

async function pullToLocal<Row extends { uuid: string; updated_at: number }>(
  config: PullConfig<Row>
): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const since = lsGet(config.cursorKey);
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

async function createEntity<Row extends { uuid: string }, Payload extends Obj>(options: {
  entity: InventoryModuleKey;
  endpoint: string;
  table: Table<Row, string>;
  row: Row;
  payload: Payload;
  sanitizeSaved: (input: unknown) => Promise<Row> | Row;
  label: string;
}): Promise<Row> {
  if (!isOnline()) {
    await options.table.put(options.row);
    await enqueueSync({
      entity: options.entity,
      uuid: options.row.uuid,
      localKey: options.row.uuid,
      action: "create",
      payload: options.payload,
    });
    notifySuccess(`${options.label} saved offline. It will sync when online.`);
    return options.row;
  }

  try {
    const response = await api.post(options.endpoint, { uuid: options.row.uuid, ...options.payload });
    const saved = await options.sanitizeSaved(obj(response.data).data ?? options.row);
    await options.table.put(saved);
    notifySuccess(`${options.label} created successfully.`);
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await options.table.put(options.row);
    await enqueueSync({
      entity: options.entity,
      uuid: options.row.uuid,
      localKey: options.row.uuid,
      action: "create",
      payload: options.payload,
    });
    notifyInfo(`${options.label} saved locally. Server sync will retry later.`);
    return options.row;
  }
}

async function updateEntity<Row extends { uuid: string }, Payload extends Obj>(options: {
  entity: InventoryModuleKey;
  endpoint: string;
  table: Table<Row, string>;
  existing: Row;
  updated: Row;
  payload: Payload;
  sanitizeSaved: (input: unknown) => Promise<Row> | Row;
  label: string;
}): Promise<Row> {
  await options.table.put(options.updated);
  await enqueueSync({
    entity: options.entity,
    uuid: options.updated.uuid,
    localKey: options.updated.uuid,
    action: "update",
    payload: options.payload,
    rollbackSnapshot: options.existing,
  });

  if (!isOnline()) {
    notifySuccess(`${options.label} updated offline. It will sync when online.`);
    return options.updated;
  }

  try {
    const response = await api.put(`${options.endpoint}/${options.updated.uuid}`, options.payload);
    const saved = await options.sanitizeSaved(obj(response.data).data ?? options.updated);
    await options.table.put(saved);
    notifySuccess(`${options.label} updated successfully.`);
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await options.table.put(options.existing);
      await removeLatestQueueItem(options.entity, options.updated.uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo(`${options.label} updated locally. Server sync will retry later.`);
    return options.updated;
  }
}

async function deleteEntity<Row extends { uuid: string }>(options: {
  entity: InventoryModuleKey;
  endpoint: string;
  table: Table<Row, string>;
  existing: Row;
  label: string;
}): Promise<void> {
  await options.table.delete(options.existing.uuid);
  await enqueueSync({
    entity: options.entity,
    uuid: options.existing.uuid,
    localKey: options.existing.uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: options.existing,
  });

  if (!isOnline()) {
    notifySuccess(`${options.label} deleted offline. It will sync when online.`);
    return;
  }

  try {
    await api.delete(`${options.endpoint}/${options.existing.uuid}`);
    notifySuccess(`${options.label} deleted successfully.`);
  } catch {
    notifyInfo(`${options.label} deleted locally. Server sync will retry later.`);
  }
}

function validateVendorInput(input: VendorInput): void {
  if (!trimText(input.name, 255)) {
    throw new Error("Vendor name is required.");
  }
}

function validateWarehouseInput(input: WarehouseInput): void {
  if (!trimText(input.name, 255)) {
    throw new Error("Warehouse name is required.");
  }
}

function validateMaterialInput(input: MaterialInput): void {
  if (!trimText(input.name, 255)) {
    throw new Error("Material name is required.");
  }
  if (!trimText(input.unit, 100)) {
    throw new Error("Material unit is required.");
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error("Material quantity must be 0 or greater.");
  }
  if (!Number.isFinite(input.min_stock_level ?? 0) || (input.min_stock_level ?? 0) < 0) {
    throw new Error("Minimum stock level must be 0 or greater.");
  }
}

function validateCompanyAssetInput(input: CompanyAssetInput): void {
  if (!trimText(input.asset_code, 100)) {
    throw new Error("Asset code is required.");
  }
  if (!trimText(input.asset_name, 255)) {
    throw new Error("Asset name is required.");
  }
  if (!["vehicle", "machine", "tool", "IT"].includes(input.asset_type)) {
    throw new Error("Asset type is invalid.");
  }
}
function toVendorPayload(input: VendorInput): Obj {
  return {
    name: trimText(input.name, 255),
    phone: trimOrNull(input.phone, 50),
    email: trimOrNull(input.email, 255),
    address: trimOrNull(input.address, 4000),
    status: normalizeVendorStatus(input.status),
  };
}

function toWarehousePayload(input: WarehouseInput): Obj {
  return {
    name: trimText(input.name, 255),
    location: trimOrNull(input.location, 255),
    status: normalizeWarehouseStatus(input.status),
  };
}

function toMaterialPayload(input: MaterialInput): Obj {
  return {
    name: trimText(input.name, 255),
    material_type: trimOrNull(input.material_type, 255),
    unit: trimText(input.unit, 100),
    quantity: Math.max(0, toMoney(input.quantity)),
    supplier_id: toNullableId(input.supplier_id),
    batch_no: trimOrNull(input.batch_no, 255),
    serial_no: trimOrNull(input.serial_no, 255),
    expiry_date: input.expiry_date ? new Date(input.expiry_date).toISOString() : null,
    min_stock_level: Math.max(0, toMoney(input.min_stock_level ?? 0)),
    status: normalizeMaterialStatus(input.status),
    notes: trimOrNull(input.notes, 5000),
  };
}

function toCompanyAssetPayload(input: CompanyAssetInput): Obj {
  return {
    asset_code: trimText(input.asset_code, 100),
    asset_name: trimText(input.asset_name, 255),
    asset_type: input.asset_type === "IT" ? "IT" : String(input.asset_type).trim().toLowerCase(),
    supplier_id: toNullableId(input.supplier_id),
    serial_no: trimOrNull(input.serial_no, 255),
    status: normalizeAssetStatus(input.status),
    current_employee_id: toNullableId(input.current_employee_id),
    current_project_id: toNullableId(input.current_project_id),
    notes: trimOrNull(input.notes, 5000),
  };
}

const vendorsConfig: PullConfig<VendorRow> = {
  entity: "vendors",
  endpoint: "/api/vendors",
  cursorKey: VENDORS_CURSOR_KEY,
  cleanupKey: VENDORS_CLEANUP_KEY,
  table: db.vendors,
  sanitize: sanitizeVendor,
  isValid: (row) => Boolean(row.uuid && row.name),
  matchesSearch: matchesVendorSearch,
};

const warehousesConfig: PullConfig<WarehouseRow> = {
  entity: "warehouses",
  endpoint: "/api/warehouses",
  cursorKey: WAREHOUSES_CURSOR_KEY,
  cleanupKey: WAREHOUSES_CLEANUP_KEY,
  table: db.warehouses,
  sanitize: sanitizeWarehouse,
  isValid: (row) => Boolean(row.uuid && row.name),
  matchesSearch: matchesWarehouseSearch,
};

const materialsConfig: PullConfig<MaterialRow> = {
  entity: "materials",
  endpoint: "/api/materials",
  cursorKey: MATERIALS_CURSOR_KEY,
  cleanupKey: MATERIALS_CLEANUP_KEY,
  table: db.materials,
  sanitize: sanitizeMaterial,
  decorate: decorateMaterial,
  isValid: (row) => Boolean(row.uuid && row.name && row.unit),
  matchesSearch: matchesMaterialSearch,
};

const companyAssetsConfig: PullConfig<CompanyAssetRow> = {
  entity: "company_assets",
  endpoint: "/api/company-assets",
  cursorKey: COMPANY_ASSETS_CURSOR_KEY,
  cleanupKey: COMPANY_ASSETS_CLEANUP_KEY,
  table: db.company_assets,
  sanitize: sanitizeCompanyAsset,
  decorate: decorateCompanyAsset,
  isValid: (row) => Boolean(row.uuid && row.asset_code && row.asset_name),
  matchesSearch: matchesCompanyAssetSearch,
};

export async function vendorsListLocal(query: InventoryLocalQuery = {}): Promise<InventoryLocalPage<VendorRow>> {
  await retentionCleanupIfDue(vendorsConfig);
  return listLocal(vendorsConfig, query);
}

export async function warehousesListLocal(query: InventoryLocalQuery = {}): Promise<InventoryLocalPage<WarehouseRow>> {
  await retentionCleanupIfDue(warehousesConfig);
  return listLocal(warehousesConfig, query);
}

export async function materialsListLocal(query: InventoryLocalQuery = {}): Promise<InventoryLocalPage<MaterialRow>> {
  await retentionCleanupIfDue(materialsConfig);
  const page = await listLocal(materialsConfig, query);
  return {
    ...page,
    items: await Promise.all(page.items.map((item) => decorateMaterial(item))),
  };
}

export async function companyAssetsListLocal(query: InventoryLocalQuery = {}): Promise<InventoryLocalPage<CompanyAssetRow>> {
  await retentionCleanupIfDue(companyAssetsConfig);
  const page = await listLocal(companyAssetsConfig, query);
  return {
    ...page,
    items: await Promise.all(page.items.map((item) => decorateCompanyAsset(item))),
  };
}

export async function vendorsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(vendorsConfig);
}

export async function warehousesPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(warehousesConfig);
}

export async function materialsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(materialsConfig);
}

export async function companyAssetsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(companyAssetsConfig);
}

export async function vendorCreate(input: VendorInput): Promise<VendorRow> {
  validateVendorInput(input);
  const uuid = crypto.randomUUID();
  const payload = toVendorPayload(input);
  const row = sanitizeVendor({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...payload,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  return createEntity({
    entity: "vendors",
    endpoint: vendorsConfig.endpoint,
    table: db.vendors,
    row,
    payload,
    sanitizeSaved: sanitizeVendor,
    label: "Vendor",
  });
}

export async function vendorUpdate(uuid: string, input: VendorInput): Promise<VendorRow> {
  validateVendorInput(input);
  const existing = await db.vendors.get(uuid);
  if (!existing) throw new Error("Vendor not found locally.");

  const payload = toVendorPayload(input);
  const updated = sanitizeVendor({
    ...existing,
    ...payload,
    updated_at: Date.now(),
  });

  return updateEntity({
    entity: "vendors",
    endpoint: vendorsConfig.endpoint,
    table: db.vendors,
    existing,
    updated,
    payload,
    sanitizeSaved: sanitizeVendor,
    label: "Vendor",
  });
}

export async function vendorDelete(uuid: string): Promise<void> {
  const existing = await db.vendors.get(uuid);
  if (!existing) throw new Error("Vendor not found locally.");

  return deleteEntity({
    entity: "vendors",
    endpoint: vendorsConfig.endpoint,
    table: db.vendors,
    existing,
    label: "Vendor",
  });
}

export async function warehouseCreate(input: WarehouseInput): Promise<WarehouseRow> {
  validateWarehouseInput(input);
  const uuid = crypto.randomUUID();
  const payload = toWarehousePayload(input);
  const row = sanitizeWarehouse({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...payload,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  return createEntity({
    entity: "warehouses",
    endpoint: warehousesConfig.endpoint,
    table: db.warehouses,
    row,
    payload,
    sanitizeSaved: sanitizeWarehouse,
    label: "Warehouse",
  });
}

export async function warehouseUpdate(uuid: string, input: WarehouseInput): Promise<WarehouseRow> {
  validateWarehouseInput(input);
  const existing = await db.warehouses.get(uuid);
  if (!existing) throw new Error("Warehouse not found locally.");

  const payload = toWarehousePayload(input);
  const updated = sanitizeWarehouse({
    ...existing,
    ...payload,
    updated_at: Date.now(),
  });

  return updateEntity({
    entity: "warehouses",
    endpoint: warehousesConfig.endpoint,
    table: db.warehouses,
    existing,
    updated,
    payload,
    sanitizeSaved: sanitizeWarehouse,
    label: "Warehouse",
  });
}

export async function warehouseDelete(uuid: string): Promise<void> {
  const existing = await db.warehouses.get(uuid);
  if (!existing) throw new Error("Warehouse not found locally.");

  return deleteEntity({
    entity: "warehouses",
    endpoint: warehousesConfig.endpoint,
    table: db.warehouses,
    existing,
    label: "Warehouse",
  });
}
export async function materialCreate(input: MaterialInput): Promise<MaterialRow> {
  validateMaterialInput(input);
  const uuid = crypto.randomUUID();
  const payload = toMaterialPayload(input);
  const row = await decorateMaterial(
    sanitizeMaterial({
      id: deriveIdFromUuid(uuid),
      uuid,
      ...payload,
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  );

  return createEntity({
    entity: "materials",
    endpoint: materialsConfig.endpoint,
    table: db.materials,
    row,
    payload,
    sanitizeSaved: async (value) => decorateMaterial(sanitizeMaterial(value)),
    label: "Material",
  });
}

export async function materialUpdate(uuid: string, input: MaterialInput): Promise<MaterialRow> {
  validateMaterialInput(input);
  const existing = await db.materials.get(uuid);
  if (!existing) throw new Error("Material not found locally.");

  const payload = toMaterialPayload(input);
  const updated = await decorateMaterial(
    sanitizeMaterial({
      ...existing,
      ...payload,
      updated_at: Date.now(),
    })
  );

  return updateEntity({
    entity: "materials",
    endpoint: materialsConfig.endpoint,
    table: db.materials,
    existing,
    updated,
    payload,
    sanitizeSaved: async (value) => decorateMaterial(sanitizeMaterial(value)),
    label: "Material",
  });
}

export async function materialDelete(uuid: string): Promise<void> {
  const existing = await db.materials.get(uuid);
  if (!existing) throw new Error("Material not found locally.");

  return deleteEntity({
    entity: "materials",
    endpoint: materialsConfig.endpoint,
    table: db.materials,
    existing,
    label: "Material",
  });
}

export async function companyAssetCreate(input: CompanyAssetInput): Promise<CompanyAssetRow> {
  validateCompanyAssetInput(input);
  const uuid = crypto.randomUUID();
  const payload = toCompanyAssetPayload(input);
  const row = await decorateCompanyAsset(
    sanitizeCompanyAsset({
      id: deriveIdFromUuid(uuid),
      uuid,
      ...payload,
      created_at: Date.now(),
      updated_at: Date.now(),
    })
  );

  return createEntity({
    entity: "company_assets",
    endpoint: companyAssetsConfig.endpoint,
    table: db.company_assets,
    row,
    payload,
    sanitizeSaved: async (value) => decorateCompanyAsset(sanitizeCompanyAsset(value)),
    label: "Company asset",
  });
}

export async function companyAssetUpdate(uuid: string, input: CompanyAssetInput): Promise<CompanyAssetRow> {
  validateCompanyAssetInput(input);
  const existing = await db.company_assets.get(uuid);
  if (!existing) throw new Error("Company asset not found locally.");

  const payload = toCompanyAssetPayload(input);
  const updated = await decorateCompanyAsset(
    sanitizeCompanyAsset({
      ...existing,
      ...payload,
      updated_at: Date.now(),
    })
  );

  return updateEntity({
    entity: "company_assets",
    endpoint: companyAssetsConfig.endpoint,
    table: db.company_assets,
    existing,
    updated,
    payload,
    sanitizeSaved: async (value) => decorateCompanyAsset(sanitizeCompanyAsset(value)),
    label: "Company asset",
  });
}

export async function companyAssetDelete(uuid: string): Promise<void> {
  const existing = await db.company_assets.get(uuid);
  if (!existing) throw new Error("Company asset not found locally.");

  return deleteEntity({
    entity: "company_assets",
    endpoint: companyAssetsConfig.endpoint,
    table: db.company_assets,
    existing,
    label: "Company asset",
  });
}
