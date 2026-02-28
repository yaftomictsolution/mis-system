import { db, type CustomerRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const MAX_LOCAL_TEXT = 4000;
const CURSOR_KEY = "customers_sync_cursor";
const CLEANUP_KEY = "customers_last_cleanup_ms";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Obj = Record<string, unknown>;

export type CustomersLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type CustomersLocalPage = {
  items: CustomerRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const nowIso = () => new Date().toISOString();

function getLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function setLs(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function getLsNum(key: string): number | null {
  const raw = getLs(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const d = Date.parse(String(v ?? ""));
  return Number.isFinite(d) ? d : Date.now();
}

function trimOrNull(v: unknown, max = 255): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function toPhone(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, 50);
}

function toEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return t ? t.slice(0, 255) : null;
}

function sanitizeCustomer(input: unknown): CustomerRow {
  const r = obj(input);

  return {
    uuid: String(r.uuid ?? ""),
    name: String(r.name ?? "").trim().slice(0, 255),
    fname: trimOrNull(r.fname, 255),
    gname: trimOrNull(r.gname, 255),
    phone: toPhone(r.phone),
    phone1: trimOrNull(r.phone1, 50),
    email: toEmail(r.email),
    status: trimOrNull(r.status, 50),
    address: trimOrNull(r.address, MAX_LOCAL_TEXT),
    updated_at: toTs(r.updated_at ?? r.server_updated_at),
  };
}

function isDeletedRecord(input: unknown): boolean {
  const r = obj(input);
  return r.deleted_at !== null && r.deleted_at !== undefined && String(r.deleted_at).trim() !== "";
}

function validateCustomer(row: CustomerRow): void {
  if (!row.name) throw new Error("Full name is required.");
  if (!row.phone) throw new Error("Primary phone is required.");
  if (row.email && !EMAIL_REGEX.test(row.email)) {
    throw new Error("Email format is invalid.");
  }
}

async function assertNoDuplicate(row: CustomerRow, ignoreUuid?: string): Promise<void> {
  const phone = await db.customers.where("phone").equals(row.phone).first();
  if (phone && phone.uuid !== ignoreUuid) {
    throw new Error("This phone number already exists.");
  }

  if (!row.email) return;

  const email = row.email.toLowerCase();
  const emailDup = await db.customers
    .filter((item) => (item.email ?? "").toLowerCase() === email && item.uuid !== ignoreUuid)
    .first();

  if (emailDup) {
    throw new Error("This email already exists.");
  }
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
      const v = (data.errors as Obj)[key];
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    }
  }

  return "Validation failed on server.";
}

const isValidationError = (status?: number) => status === 409 || status === 422;

async function removeLatestQueueItem(uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((i) => i.entity === "customers" && i.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
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

function matchesSearch(row: CustomerRow, q: string): boolean {
  return [row.name, row.fname, row.gname, row.phone, row.phone1, row.email]
    .some((v) => (v ?? "").toLowerCase().includes(q));
}

function parseCustomersPayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
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
  const nested = paged.data;
  if (Array.isArray(nested)) {
    const current = Number(paged.current_page ?? 1);
    const last = Number(paged.last_page ?? 1);

    return {
      list: nested.map(obj),
      hasMore: current < last,
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  return { list: [], hasMore: false, serverTime: nowIso() };
}

export async function customersListLocal(query: CustomersLocalQuery = {}): Promise<CustomersLocalPage> {
  await customersRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();

  if (!q) {
    const total = await db.customers.count();
    const items = await db.customers.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const c = db.customers.orderBy("updated_at").reverse().filter((row) => matchesSearch(row, q));
  const total = await c.count();
  const items = await c.offset(offset).limit(pageSize).toArray();

  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function customerGetLocal(uuid: string): Promise<CustomerRow | undefined> {
  return db.customers.get(uuid);
}

export async function customersPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const since = getLs(CURSOR_KEY);
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/customers", { params });
    const parsed = parseCustomersPayload(res.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.customers.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("customers", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeCustomer)
      .filter((r) => r.uuid && r.name && r.phone);

    if (rows.length) {
      await db.customers.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  setLs(CURSOR_KEY, serverTime);
  await customersRetentionCleanupIfDue();

  return { pulled };
}

export async function customerCreate(payload: unknown): Promise<CustomerRow> {
  const uuid = crypto.randomUUID();
  const row = sanitizeCustomer({ ...obj(payload), uuid, updated_at: Date.now() });

  validateCustomer(row);
  await assertNoDuplicate(row);


  if (!isOnline()) {

    await db.customers.put(row);
    await enqueueSync({ entity: "customers", uuid, action: "create", payload: row });
    notifySuccess("Customer saved offline. It will sync when online.");
    return row;
  }

  try {
    const res = await api.post("/api/customers", row);
    const saved = sanitizeCustomer(obj(res.data).data ?? row);
    await db.customers.put(saved);
    notifySuccess("Customer created successfully.");
    return saved;
  } catch (error: unknown) {

    if (isValidationError(getApiStatus(error))) {
      await db.customers.delete(uuid);
      await removeLatestQueueItem(uuid, "create");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    await db.customers.put(row);
    await enqueueSync({ entity: "customers", uuid, action: "create", payload: row });
    notifyInfo("Customer saved locally. Server sync will retry later.");
    return row;
  }
}

export async function customerUpdate(uuid: string, patch: unknown): Promise<CustomerRow> {
  const existing = await db.customers.get(uuid);
  if (!existing) throw new Error("Customer not found locally");

  const updated = sanitizeCustomer({ ...existing, ...obj(patch), uuid, updated_at: Date.now() });

  validateCustomer(updated);
  await assertNoDuplicate(updated, uuid);

  await db.customers.put(updated);
  await enqueueSync({ entity: "customers", uuid, action: "update", payload: updated });

  if (!isOnline()) {
    notifySuccess("Customer updated offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.put(`/api/customers/${uuid}`, updated);
    const saved = sanitizeCustomer(obj(res.data).data ?? updated);
    await db.customers.put(saved);
    notifySuccess("Customer updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.customers.put(existing);
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    notifyInfo("Customer updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function customerDelete(uuid: string): Promise<void> {
  await db.customers.delete(uuid);
  await enqueueSync({ entity: "customers", uuid, action: "delete", payload: {} });

  if (!isOnline()) {
    notifySuccess("Customer deleted offline. It will sync when online.");
    return;
  }
  try {
    await api.delete(`/api/customers/${uuid}`);
    notifySuccess("Customer deleted successfully.");
  } catch {
    notifyInfo("Customer deleted locally. Server sync will retry later.");
  }
}

export async function customersRetentionCleanup(): Promise<number> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("customers").toArray();
  const locked = new Set(pending.map((i) => i.uuid));

  const oldRows = await db.customers.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((r) => !locked.has(r.uuid)).map((r) => r.uuid);

  if (removable.length) {
    await db.customers.bulkDelete(removable);
  }

  return removable.length;
}

export async function customersRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const last = getLsNum(CLEANUP_KEY);

  if (last !== null && now - last < CLEANUP_INTERVAL_MS) return 0;

  const removed = await customersRetentionCleanup();
  setLs(CLEANUP_KEY, String(now));
  return removed;
}
