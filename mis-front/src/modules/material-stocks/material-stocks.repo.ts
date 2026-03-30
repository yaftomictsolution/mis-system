import { type Table } from "dexie";
import { db, type ProjectMaterialStockRow, type WarehouseMaterialStockRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 5000;
const PULL_PAGE_SIZE = 200;
const WAREHOUSE_STOCKS_CURSOR_KEY = "warehouse_material_stocks_sync_cursor";
const PROJECT_STOCKS_CURSOR_KEY = "project_material_stocks_sync_cursor";
const WAREHOUSE_STOCKS_CLEANUP_KEY = "warehouse_material_stocks_last_cleanup_ms";
const PROJECT_STOCKS_CLEANUP_KEY = "project_material_stocks_last_cleanup_ms";

type Obj = Record<string, unknown>;

type MaterialStockLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type MaterialStockLocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type PullConfig<Row extends { uuid: string; updated_at: number }> = {
  entity: "warehouse_material_stocks" | "project_material_stocks";
  endpoint: string;
  cursorKey: string;
  cleanupKey: string;
  table: Table<Row, string>;
  sanitize: (input: unknown) => Row;
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

function toId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
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

function sanitizeWarehouseMaterialStock(input: unknown): WarehouseMaterialStockRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);

  return {
    id: toRowId(record.id, uuid),
    uuid,
    warehouse_id: toId(record.warehouse_id),
    warehouse_uuid: trimOrNull(record.warehouse_uuid, 100),
    warehouse_name: trimOrNull(record.warehouse_name, 255),
    material_id: toId(record.material_id),
    material_uuid: trimOrNull(record.material_uuid, 100),
    material_name: trimOrNull(record.material_name, 255),
    material_unit: trimOrNull(record.material_unit, 100),
    material_status: trimOrNull(record.material_status, 50),
    min_stock_level: Math.max(0, toMoney(record.min_stock_level)),
    qty_on_hand: Math.max(0, toMoney(record.qty_on_hand)),
    qty_reserved: Math.max(0, toMoney(record.qty_reserved)),
    qty_available: Math.max(0, toMoney(record.qty_available)),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeProjectMaterialStock(input: unknown): ProjectMaterialStockRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);

  return {
    id: toRowId(record.id, uuid),
    uuid,
    project_id: toId(record.project_id),
    project_uuid: trimOrNull(record.project_uuid, 100),
    project_name: trimOrNull(record.project_name, 255),
    material_id: toId(record.material_id),
    material_uuid: trimOrNull(record.material_uuid, 100),
    material_name: trimOrNull(record.material_name, 255),
    material_unit: trimOrNull(record.material_unit, 100),
    material_status: trimOrNull(record.material_status, 50),
    qty_issued: Math.max(0, toMoney(record.qty_issued)),
    qty_consumed: Math.max(0, toMoney(record.qty_consumed)),
    qty_returned: Math.max(0, toMoney(record.qty_returned)),
    qty_on_site: Math.max(0, toMoney(record.qty_on_site)),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesWarehouseStockSearch(row: WarehouseMaterialStockRow, query: string): boolean {
  return [
    row.warehouse_name,
    row.material_name,
    row.material_unit,
    row.material_status,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function matchesProjectStockSearch(row: ProjectMaterialStockRow, query: string): boolean {
  return [
    row.project_name,
    row.material_name,
    row.material_unit,
    row.material_status,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

async function listLocal<Row extends { uuid: string; updated_at: number }>(
  config: Pick<PullConfig<Row>, "table" | "matchesSearch">,
  query: MaterialStockLocalQuery = {},
): Promise<MaterialStockLocalPage<Row>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await config.table.count();
    const items = await config.table.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = config.table.orderBy("updated_at").reverse().filter((row) => config.matchesSearch(row as Row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

async function retentionCleanup<Row extends { uuid: string; updated_at: number }>(config: PullConfig<Row>): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays(config.entity, RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldRows = await config.table.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.map((row) => row.uuid).filter(Boolean);
  if (removable.length) await config.table.bulkDelete(removable);
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

const warehouseMaterialStocksConfig: PullConfig<WarehouseMaterialStockRow> = {
  entity: "warehouse_material_stocks",
  endpoint: "/api/warehouse-material-stocks",
  cursorKey: WAREHOUSE_STOCKS_CURSOR_KEY,
  cleanupKey: WAREHOUSE_STOCKS_CLEANUP_KEY,
  table: db.warehouse_material_stocks,
  sanitize: sanitizeWarehouseMaterialStock,
  isValid: (row) => Boolean(row.uuid && row.material_id > 0 && row.warehouse_id > 0),
  matchesSearch: matchesWarehouseStockSearch,
};

const projectMaterialStocksConfig: PullConfig<ProjectMaterialStockRow> = {
  entity: "project_material_stocks",
  endpoint: "/api/project-material-stocks",
  cursorKey: PROJECT_STOCKS_CURSOR_KEY,
  cleanupKey: PROJECT_STOCKS_CLEANUP_KEY,
  table: db.project_material_stocks,
  sanitize: sanitizeProjectMaterialStock,
  isValid: (row) => Boolean(row.uuid && row.material_id > 0 && row.project_id > 0),
  matchesSearch: matchesProjectStockSearch,
};

export async function warehouseMaterialStocksListLocal(query: MaterialStockLocalQuery = {}): Promise<MaterialStockLocalPage<WarehouseMaterialStockRow>> {
  await retentionCleanupIfDue(warehouseMaterialStocksConfig);
  return listLocal(warehouseMaterialStocksConfig, query);
}

export async function projectMaterialStocksListLocal(query: MaterialStockLocalQuery = {}): Promise<MaterialStockLocalPage<ProjectMaterialStockRow>> {
  await retentionCleanupIfDue(projectMaterialStocksConfig);
  return listLocal(projectMaterialStocksConfig, query);
}

export async function warehouseMaterialStocksPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(warehouseMaterialStocksConfig);
}

export async function projectMaterialStocksPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(projectMaterialStocksConfig);
}
