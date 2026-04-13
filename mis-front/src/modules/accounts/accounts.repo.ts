import {
  db,
  type AccountRow,
  type AccountTransactionRow,
} from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 365;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const ACCOUNTS_CURSOR_KEY = "accounts_sync_cursor";
const ACCOUNT_TRANSACTIONS_CURSOR_KEY = "account_transactions_sync_cursor";
const ACCOUNTS_CLEANUP_KEY = "accounts_last_cleanup_ms";
const ACCOUNT_TRANSACTIONS_CLEANUP_KEY = "account_transactions_last_cleanup_ms";
const isValidationError = (status?: number) => status === 409 || status === 422;

type Obj = Record<string, unknown>;

export type AccountInput = {
  name: string;
  account_type: string;
  bank_name?: string | null;
  account_number?: string | null;
  currency?: string | null;
  opening_balance?: number;
  status?: string;
  notes?: string | null;
};

export type AccountLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type AccountTransactionLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  accountId?: number | null;
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

function trimOrNull(value: unknown, max = 255): string | null {
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
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
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

function isDeletedRecord(input: unknown): boolean {
  const record = obj(input);
  return record.deleted_at !== null && record.deleted_at !== undefined && String(record.deleted_at).trim() !== "";
}

function normalizeAccountType(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 80);

  return normalized || "office";
}

function normalizeAccountStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
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

function sanitizeAccount(input: unknown): AccountRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    name: trimText(record.name, 255),
    account_type: normalizeAccountType(record.account_type),
    bank_name: trimOrNull(record.bank_name, 255),
    account_number: trimOrNull(record.account_number, 100),
    currency: trimText(record.currency ?? "USD", 10).toUpperCase() || "USD",
    opening_balance: toMoney(record.opening_balance),
    current_balance: toMoney(record.current_balance),
    status: normalizeAccountStatus(record.status),
    notes: trimOrNull(record.notes, 5000),
    can_delete: record.can_delete !== false,
    delete_blocked_reason: trimOrNull(record.delete_blocked_reason, 5000),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeAccountTransaction(input: unknown): AccountTransactionRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    account_id: toId(record.account_id),
    account_uuid: trimOrNull(record.account_uuid, 100),
    account_name: trimOrNull(record.account_name, 255),
    account_currency: trimOrNull(record.account_currency, 10),
    direction: trimText(record.direction, 20),
    amount: toMoney(record.amount),
    currency_code: trimOrNull(record.currency_code, 10),
    exchange_rate_snapshot:
      record.exchange_rate_snapshot === null || record.exchange_rate_snapshot === undefined
        ? null
        : Number(Number(record.exchange_rate_snapshot).toFixed(6)),
    amount_usd: record.amount_usd === null || record.amount_usd === undefined ? null : toMoney(record.amount_usd),
    module: trimOrNull(record.module, 100),
    reference_type: trimOrNull(record.reference_type, 100),
    reference_uuid: trimOrNull(record.reference_uuid, 100),
    description: trimOrNull(record.description, 5000),
    payment_method: trimOrNull(record.payment_method, 100),
    transaction_date: toNullableTs(record.transaction_date),
    created_by_user_id: toNullableId(record.created_by_user_id),
    created_by_user_name: trimOrNull(record.created_by_user_name, 255),
    status: trimText(record.status ?? "posted", 20) || "posted",
    reversal_of_id: toNullableId(record.reversal_of_id),
    metadata: (typeof record.metadata === "object" && record.metadata !== null ? (record.metadata as Record<string, unknown>) : null),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesAccountSearch(row: AccountRow, query: string): boolean {
  return [
    row.name,
    row.account_type,
    row.bank_name,
    row.account_number,
    row.currency,
    row.status,
    row.opening_balance,
    row.current_balance,
    row.notes,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function matchesTransactionSearch(row: AccountTransactionRow, query: string): boolean {
  return [
    row.account_name,
    row.direction,
    row.amount,
    row.currency_code,
    row.amount_usd,
    row.module,
    row.reference_type,
    row.description,
    row.payment_method,
    row.status,
    row.created_by_user_name,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
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
    .filter((item) => item.entity === "accounts" && item.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}

function validateAccountInput(input: AccountInput): void {
  if (!input.name.trim()) {
    throw new Error("Account name is required.");
  }
  if (!normalizeAccountType(input.account_type)) {
    throw new Error("Account type is required.");
  }
  if (input.currency && !["USD", "AFN"].includes(String(input.currency).trim().toUpperCase())) {
    throw new Error("Account currency must be USD or AFN.");
  }
}

async function assertNoDuplicateAccount(name: string, ignoreUuid?: string): Promise<void> {
  const duplicate = await db.accounts
    .filter((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase() && item.uuid !== ignoreUuid)
    .first();

  if (duplicate) {
    throw new Error("Account name already exists.");
  }
}

function toAccountPayload(input: AccountRow | AccountInput & { uuid?: string }): Obj {
  return {
    uuid: "uuid" in input ? input.uuid : undefined,
    name: trimText(input.name, 255),
    account_type: normalizeAccountType(input.account_type),
    bank_name: trimOrNull(input.bank_name, 255),
    account_number: trimOrNull(input.account_number, 100),
    currency: trimText(input.currency ?? "USD", 10).toUpperCase() || "USD",
    opening_balance: toMoney(input.opening_balance ?? 0),
    status: normalizeAccountStatus(input.status),
    notes: trimOrNull(input.notes, 5000),
  };
}

export async function accountsListLocal(query: AccountLocalQuery = {}): Promise<LocalPage<AccountRow>> {
  await accountsRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await db.accounts.count();
    const items = await db.accounts.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = db.accounts.orderBy("updated_at").reverse().filter((row) => matchesAccountSearch(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function accountTransactionsListLocal(
  query: AccountTransactionLocalQuery = {}
): Promise<LocalPage<AccountTransactionRow>> {
  await accountTransactionsRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();
  const filtered = await db.account_transactions
    .orderBy("updated_at")
    .reverse()
    .filter((row) => {
      if (query.accountId && Number(row.account_id) !== Number(query.accountId)) return false;
      if (!search) return true;
      return matchesTransactionSearch(row, search);
    })
    .toArray();

  const items = filtered.slice(offset, offset + pageSize);
  return { items, page, pageSize, total: filtered.length, hasMore: offset + items.length < filtered.length };
}

export async function accountsRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("accounts", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("accounts").toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = await db.accounts.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await db.accounts.bulkDelete(removable);
  }
  return removable.length;
}

export async function accountTransactionsRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("account_transactions", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldRows = await db.account_transactions.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.map((row) => row.uuid);
  if (removable.length) {
    await db.account_transactions.bulkDelete(removable);
  }
  return removable.length;
}

export async function accountsRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(ACCOUNTS_CLEANUP_KEY);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await accountsRetentionCleanup();
  lsSet(ACCOUNTS_CLEANUP_KEY, String(now));
  return removed;
}

export async function accountTransactionsRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(ACCOUNT_TRANSACTIONS_CLEANUP_KEY);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await accountTransactionsRetentionCleanup();
  lsSet(ACCOUNT_TRANSACTIONS_CLEANUP_KEY, String(now));
  return removed;
}

export async function accountsPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(ACCOUNTS_CURSOR_KEY);
  const localCount = await db.accounts.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(ACCOUNTS_CURSOR_KEY);
  }

  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get("/api/accounts", { params });
    const parsed = parsePayload(response.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.accounts.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("accounts", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeAccount)
      .filter((row) => row.uuid && row.name);

    if (rows.length) {
      await db.accounts.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(ACCOUNTS_CURSOR_KEY, serverTime);
  await accountsRetentionCleanupIfDue();
  return { pulled };
}

export async function accountTransactionsPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(ACCOUNT_TRANSACTIONS_CURSOR_KEY);
  const localCount = await db.account_transactions.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(ACCOUNT_TRANSACTIONS_CURSOR_KEY);
  }

  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get("/api/account-transactions", { params });
    const parsed = parsePayload(response.data);
    const rows = parsed.list
      .map(sanitizeAccountTransaction)
      .filter((row) => row.uuid && row.account_id > 0);

    if (rows.length) {
      await db.account_transactions.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(ACCOUNT_TRANSACTIONS_CURSOR_KEY, serverTime);
  await accountTransactionsRetentionCleanupIfDue();
  return { pulled };
}

export async function accountCreate(input: AccountInput): Promise<AccountRow> {
  validateAccountInput(input);
  await assertNoDuplicateAccount(input.name);

  const uuid = crypto.randomUUID();
  const row = sanitizeAccount({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...toAccountPayload(input),
    current_balance: toMoney(input.opening_balance ?? 0),
    can_delete: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  if (!isOnline()) {
    await db.accounts.put(row);
    await enqueueSync({
      entity: "accounts",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toAccountPayload(row),
    });
    notifySuccess("Account saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post("/api/accounts", { uuid, ...toAccountPayload(row) });
    const saved = sanitizeAccount(obj(response.data).data ?? row);
    await db.accounts.put(saved);
    notifySuccess("Account created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.accounts.put(row);
    await enqueueSync({
      entity: "accounts",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toAccountPayload(row),
    });
    notifyInfo("Account saved locally. Server sync will retry later.");
    return row;
  }
}

export async function accountUpdate(uuid: string, input: AccountInput): Promise<AccountRow> {
  validateAccountInput(input);
  const existing = await db.accounts.get(uuid);
  if (!existing) throw new Error("Account not found locally.");
  await assertNoDuplicateAccount(input.name, uuid);

  const updated = sanitizeAccount({
    ...existing,
    ...toAccountPayload(input),
    current_balance: Number((Number(existing.current_balance ?? 0) + (toMoney(input.opening_balance ?? 0) - Number(existing.opening_balance ?? 0))).toFixed(2)),
    updated_at: Date.now(),
  });

  await db.accounts.put(updated);
  await enqueueSync({
    entity: "accounts",
    uuid,
    localKey: uuid,
    action: "update",
    payload: toAccountPayload(updated),
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Account updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`/api/accounts/${uuid}`, toAccountPayload(updated));
    const saved = sanitizeAccount(obj(response.data).data ?? updated);
    await db.accounts.put(saved);
    notifySuccess("Account updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.accounts.put(existing);
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Account updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function accountDelete(uuid: string): Promise<void> {
  const existing = await db.accounts.get(uuid);
  if (!existing) throw new Error("Account not found locally.");

  await db.accounts.delete(uuid);
  await enqueueSync({
    entity: "accounts",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Account deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/accounts/${uuid}`);
    notifySuccess("Account deleted successfully.");
  } catch (error: unknown) {
    const status = getApiStatus(error);
    if (status) {
      await db.accounts.put(existing);
      await removeLatestQueueItem(uuid, "delete");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Account deleted locally. Server sync will retry later.");
  }
}
