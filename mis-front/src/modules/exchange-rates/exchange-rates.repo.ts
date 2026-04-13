import { db, type ExchangeRateRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 365;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "exchange_rates_sync_cursor";
const CLEANUP_KEY = "exchange_rates_last_cleanup_ms";
const isValidationError = (status?: number) => status === 409 || status === 422;

type Obj = Record<string, unknown>;

export type ExchangeRateInput = {
  rate: number;
  effective_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
  source?: "manual" | "api";
};

export type ExchangeRateLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type LocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
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

function trimOrNull(value: unknown, max = 5000): string | null {
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

function toMoney(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(6));
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

function isDeletedRecord(input: unknown): boolean {
  const record = obj(input);
  return record.deleted_at !== null && record.deleted_at !== undefined && String(record.deleted_at).trim() !== "";
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

  return { list: [], hasMore: false, serverTime: nowIso() };
}

function sanitizeExchangeRate(input: unknown): ExchangeRateRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    base_currency: trimText(record.base_currency ?? "USD", 10).toUpperCase() || "USD",
    quote_currency: trimText(record.quote_currency ?? "AFN", 10).toUpperCase() || "AFN",
    rate: toMoney(record.rate),
    source: trimOrNull(record.source, 20),
    effective_date: toNullableTs(record.effective_date),
    approved_by_user_id: Number.isFinite(Number(record.approved_by_user_id)) ? Math.trunc(Number(record.approved_by_user_id)) : null,
    approved_by_user_name: trimOrNull(record.approved_by_user_name, 255),
    is_active: record.is_active !== false,
    notes: trimOrNull(record.notes, 5000),
    can_delete: record.can_delete !== false,
    delete_blocked_reason: trimOrNull(record.delete_blocked_reason, 5000),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesSearch(row: ExchangeRateRow, query: string): boolean {
  return [
    row.base_currency,
    row.quote_currency,
    row.rate,
    row.source,
    row.notes,
    row.approved_by_user_name,
    row.is_active ? "active" : "inactive",
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function validateInput(input: ExchangeRateInput): void {
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error("Exchange rate must be greater than 0.");
  }
}

function toPayload(input: ExchangeRateInput): Obj {
  return {
    base_currency: "USD",
    quote_currency: "AFN",
    rate: toMoney(input.rate),
    effective_date: input.effective_date || new Date().toISOString().slice(0, 10),
    is_active: input.is_active !== false,
    notes: trimOrNull(input.notes, 5000),
    source: input.source ?? "manual",
  };
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

async function removeLatestQueueItem(uuid: string, action: "create" | "update" | "delete"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((item) => item.entity === "exchange_rates" && item.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}

async function deactivateOtherLocalActiveRates(uuid: string): Promise<void> {
  const activeRows = await db.exchange_rates.filter((row) => row.uuid !== uuid && row.is_active).toArray();
  if (!activeRows.length) return;
  await db.exchange_rates.bulkPut(activeRows.map((row) => ({ ...row, is_active: false, updated_at: Date.now() })));
}

export async function exchangeRatesListLocal(query: ExchangeRateLocalQuery = {}): Promise<LocalPage<ExchangeRateRow>> {
  await exchangeRatesRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  const allRows = await db.exchange_rates.orderBy("updated_at").reverse().toArray();
  const filtered = search ? allRows.filter((row) => matchesSearch(row, search)) : allRows;
  const items = filtered.slice(offset, offset + pageSize);
  return { items, page, pageSize, total: filtered.length, hasMore: offset + items.length < filtered.length };
}

export async function getActiveExchangeRateLocal(): Promise<ExchangeRateRow | null> {
  const rows = await db.exchange_rates.filter((row) => row.is_active).toArray();
  const [active] = rows.sort((left, right) => {
    const leftDate = Number(left.effective_date ?? left.updated_at ?? 0);
    const rightDate = Number(right.effective_date ?? right.updated_at ?? 0);
    return rightDate - leftDate;
  });
  return active ?? null;
}

export async function exchangeRatesRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("exchange_rates", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("exchange_rates").toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = await db.exchange_rates.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await db.exchange_rates.bulkDelete(removable);
  }
  return removable.length;
}

export async function exchangeRatesRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(CLEANUP_KEY);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await exchangeRatesRetentionCleanup();
  lsSet(CLEANUP_KEY, String(now));
  return removed;
}

export async function exchangeRatesPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(CURSOR_KEY);
  const localCount = await db.exchange_rates.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(CURSOR_KEY);
  }

  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get("/api/exchange-rates", { params });
    const parsed = parsePayload(response.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.exchange_rates.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("exchange_rates", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeExchangeRate)
      .filter((row) => row.uuid && row.rate > 0);

    if (rows.length) {
      await db.exchange_rates.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(CURSOR_KEY, serverTime);
  await exchangeRatesRetentionCleanupIfDue();
  return { pulled };
}

export async function exchangeRateCreate(input: ExchangeRateInput): Promise<ExchangeRateRow> {
  validateInput(input);

  const uuid = crypto.randomUUID();
  const payload = toPayload(input);
  const row = sanitizeExchangeRate({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...payload,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  if (!isOnline()) {
    if (row.is_active) {
      await deactivateOtherLocalActiveRates(uuid);
    }
    await db.exchange_rates.put(row);
    await enqueueSync({
      entity: "exchange_rates",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Exchange rate saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post("/api/exchange-rates", { uuid, ...payload });
    const saved = sanitizeExchangeRate(obj(response.data).data ?? row);
    await db.exchange_rates.put(saved);
    await exchangeRatesPullToLocal();
    notifySuccess("Exchange rate created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.exchange_rates.put(row);
    if (row.is_active) {
      await deactivateOtherLocalActiveRates(uuid);
    }
    await enqueueSync({
      entity: "exchange_rates",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Exchange rate saved locally. Server sync will retry later.");
    return row;
  }
}

export async function exchangeRateUpdate(uuid: string, input: ExchangeRateInput): Promise<ExchangeRateRow> {
  validateInput(input);

  const existing = await db.exchange_rates.get(uuid);
  if (!existing) throw new Error("Exchange rate not found locally.");

  const payload = toPayload(input);
  const updated = sanitizeExchangeRate({
    ...existing,
    ...payload,
    updated_at: Date.now(),
  });

  await db.exchange_rates.put(updated);
  await enqueueSync({
    entity: "exchange_rates",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    if (updated.is_active) {
      await deactivateOtherLocalActiveRates(uuid);
    }
    notifySuccess("Exchange rate updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`/api/exchange-rates/${uuid}`, payload);
    const saved = sanitizeExchangeRate(obj(response.data).data ?? updated);
    await db.exchange_rates.put(saved);
    await exchangeRatesPullToLocal();
    notifySuccess("Exchange rate updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.exchange_rates.put(existing);
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Exchange rate updated locally. Server sync will retry later.");
    if (updated.is_active) {
      await deactivateOtherLocalActiveRates(uuid);
    }
    return updated;
  }
}

export async function exchangeRateDelete(uuid: string): Promise<void> {
  const existing = await db.exchange_rates.get(uuid);
  if (!existing) throw new Error("Exchange rate not found locally.");
  if (existing.can_delete === false) {
    throw new Error(existing.delete_blocked_reason || "This exchange rate cannot be deleted right now.");
  }

  await db.exchange_rates.delete(uuid);
  await enqueueSync({
    entity: "exchange_rates",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Exchange rate deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/exchange-rates/${uuid}`);
    notifySuccess("Exchange rate deleted successfully.");
  } catch (error: unknown) {
    const status = getApiStatus(error);
    if (status) {
      await db.exchange_rates.put(existing);
      await removeLatestQueueItem(uuid, "delete");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Exchange rate deleted locally. Server sync will retry later.");
  }
}
