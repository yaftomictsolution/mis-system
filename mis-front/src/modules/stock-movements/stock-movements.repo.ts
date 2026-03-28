import { type Table } from "dexie";
import { db, type StockMovementRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 5000;
const PULL_PAGE_SIZE = 200;
const STOCK_MOVEMENTS_CURSOR_KEY = "stock_movements_sync_cursor";
const STOCK_MOVEMENTS_CLEANUP_KEY = "stock_movements_last_cleanup_ms";

type Obj = Record<string, unknown>;

type StockMovementLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  movementType?: string;
  materialId?: number | null;
  warehouseId?: number | null;
  projectId?: number | null;
};

type StockMovementLocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type PullConfig = {
  entity: "stock_movements";
  endpoint: string;
  cursorKey: string;
  cleanupKey: string;
  table: Table<StockMovementRow, string>;
  sanitize: (input: unknown) => StockMovementRow;
  isValid: (row: StockMovementRow) => boolean;
  matchesSearch: (row: StockMovementRow, query: string) => boolean;
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

function sanitizeStockMovement(input: unknown): StockMovementRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    material_id: toId(record.material_id),
    material_uuid: trimOrNull(record.material_uuid, 100),
    material_name: trimOrNull(record.material_name, 255),
    material_unit: trimOrNull(record.material_unit, 100),
    warehouse_id: toId(record.warehouse_id),
    warehouse_uuid: trimOrNull(record.warehouse_uuid, 100),
    warehouse_name: trimOrNull(record.warehouse_name, 255),
    project_id: toNullableId(record.project_id),
    project_uuid: trimOrNull(record.project_uuid, 100),
    project_name: trimOrNull(record.project_name, 255),
    employee_id: toNullableId(record.employee_id),
    employee_uuid: trimOrNull(record.employee_uuid, 100),
    employee_name: trimOrNull(record.employee_name, 255),
    material_request_item_id: toNullableId(record.material_request_item_id),
    material_request_item_uuid: trimOrNull(record.material_request_item_uuid, 100),
    material_request_uuid: trimOrNull(record.material_request_uuid, 100),
    material_request_no: trimOrNull(record.material_request_no, 100),
    quantity: Math.max(0, toMoney(record.quantity)),
    movement_type: trimText(record.movement_type, 50),
    reference_type: trimOrNull(record.reference_type, 50),
    reference_no: trimOrNull(record.reference_no, 100),
    approved_by_user_id: toNullableId(record.approved_by_user_id),
    approved_by_user_name: trimOrNull(record.approved_by_user_name, 255),
    issued_by_user_id: toNullableId(record.issued_by_user_id),
    issued_by_user_name: trimOrNull(record.issued_by_user_name, 255),
    movement_date: toNullableTs(record.movement_date),
    notes: trimOrNull(record.notes, 5000),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesStockMovementSearch(row: StockMovementRow, query: string): boolean {
  return [
    row.material_name,
    row.warehouse_name,
    row.project_name,
    row.employee_name,
    row.material_request_no,
    row.movement_type,
    row.reference_type,
    row.reference_no,
    row.notes,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

async function listLocal(
  config: Pick<PullConfig, "table" | "matchesSearch">,
  query: StockMovementLocalQuery = {},
): Promise<StockMovementLocalPage<StockMovementRow>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  let collection = config.table.orderBy("movement_date").reverse();

  if (search) {
    collection = collection.filter((row) => config.matchesSearch(row as StockMovementRow, search));
  }

  const items = await collection.toArray();
  const filtered = items.filter((row) => {
    if (query.movementType && row.movement_type !== query.movementType) return false;
    if ((query.materialId ?? 0) > 0 && Number(row.material_id) !== Number(query.materialId)) return false;
    if ((query.warehouseId ?? 0) > 0 && Number(row.warehouse_id) !== Number(query.warehouseId)) return false;
    if ((query.projectId ?? 0) > 0 && Number(row.project_id ?? 0) !== Number(query.projectId)) return false;
    return true;
  });

  const total = filtered.length;
  return {
    items: filtered.slice(offset, offset + pageSize),
    page,
    pageSize,
    total,
    hasMore: offset + pageSize < total,
  };
}

async function retentionCleanup(config: PullConfig): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays(config.entity, RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldRows = await config.table.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.map((row) => row.uuid).filter(Boolean);
  if (removable.length) {
    await config.table.bulkDelete(removable);
  }
  return removable.length;
}

async function retentionCleanupIfDue(config: PullConfig): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(config.cleanupKey);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await retentionCleanup(config);
  lsSet(config.cleanupKey, String(now));
  return removed;
}

async function pullToLocal(config: PullConfig): Promise<{ pulled: number }> {
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
    const rows = parsed.list.map(config.sanitize).filter(config.isValid);

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

const stockMovementsConfig: PullConfig = {
  entity: "stock_movements",
  endpoint: "/api/stock-movements",
  cursorKey: STOCK_MOVEMENTS_CURSOR_KEY,
  cleanupKey: STOCK_MOVEMENTS_CLEANUP_KEY,
  table: db.stock_movements,
  sanitize: sanitizeStockMovement,
  isValid: (row) => Boolean(row.uuid && row.material_id > 0 && row.warehouse_id > 0 && row.movement_type),
  matchesSearch: matchesStockMovementSearch,
};

export async function stockMovementsRetentionCleanupIfDue(): Promise<number> {
  return retentionCleanupIfDue(stockMovementsConfig);
}

export async function stockMovementsListLocal(query: StockMovementLocalQuery = {}): Promise<StockMovementLocalPage<StockMovementRow>> {
  await stockMovementsRetentionCleanupIfDue();
  return listLocal(stockMovementsConfig, query);
}

export async function stockMovementsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(stockMovementsConfig);
}

export async function stockMovementsGetLocal(uuid: string): Promise<StockMovementRow | undefined> {
  await stockMovementsRetentionCleanupIfDue();
  return db.stock_movements.get(uuid);
}

export async function stockMovementsListByReferenceLocal(referenceNo: string): Promise<StockMovementRow[]> {
  const reference = trimText(referenceNo, 100);
  if (!reference) return [];
  await stockMovementsRetentionCleanupIfDue();
  return db.stock_movements
    .where("updated_at")
    .above(0)
    .filter((row) => String(row.reference_no ?? "").trim() === reference)
    .reverse()
    .sortBy("movement_date")
    .then((items) => items.reverse());
}
