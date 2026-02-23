import { db, type CustomerRow } from "@/db/localDB";
import { api } from "@/lib/api";
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
type UnknownRecord = Record<string, unknown>;

function online() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function readLocalNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function writeLocalNumber(key: string, value: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
}

function readLocalString(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeLocalString(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeNullableText(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, maxLength);
}

function normalizePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 50);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed.slice(0, 255) : null;
}

function sanitizeCustomer(input: unknown): CustomerRow {
  const record = isRecord(input) ? input : {};

  return {
    uuid: String(record.uuid ?? ""),
    name: String(record.name ?? "").trim().slice(0, 255),
    fname: normalizeNullableText(record.fname, 255),
    gname: normalizeNullableText(record.gname, 255),
    phone: normalizePhone(record.phone),
    phone1: normalizeNullableText(record.phone1, 50),
    email: normalizeEmail(record.email),
    status: normalizeNullableText(record.status, 50),
    // Prevent very large text/blob-like values from growing IndexedDB too much.
    address: normalizeNullableText(record.address, MAX_LOCAL_TEXT),
    updated_at: toTimestamp(record.updated_at ?? record.server_updated_at),
  };
}

function validateCustomerRow(row: CustomerRow) {
  
  // console.log("Validating customer row:", row);
  // return false;
  if (!row.name) {
    throw new Error("Full name is required.");
  }

  if (!row.phone) {
    throw new Error("Primary phone is required.");
  }

  if (row.email && !EMAIL_REGEX.test(row.email)) {
    throw new Error("Email format is invalid.");
  }
}

async function assertNoLocalDuplicate(row: CustomerRow, ignoreUuid?: string) {
  const phoneMatch = await db.customers.where("phone").equals(row.phone).first();
  if (phoneMatch && phoneMatch.uuid !== ignoreUuid) {
    throw new Error("This phone number already exists.");
  }

  if (row.email) {
    const emailMatch = await db.customers
      .filter((item) => (item.email ?? "").toLowerCase() === row.email!.toLowerCase() && item.uuid !== ignoreUuid)
      .first();

    if (emailMatch) {
      throw new Error("This email already exists.");
    }
  }
}

function getApiErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const response = error.response;
  if (!isRecord(response)) return undefined;
  const status = response.status;
  return typeof status === "number" ? status : undefined;
}

function getApiErrorData(error: unknown): UnknownRecord | null {
  if (!isRecord(error)) return null;
  const response = error.response;
  if (!isRecord(response)) return null;
  const data = response.data;
  return isRecord(data) ? data : null;
}

function parseApiErrorMessage(error: unknown): string {
  const data = getApiErrorData(error);
  const message = data?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const errors = data?.errors;
  if (isRecord(errors)) {
    for (const key of Object.keys(errors)) {
      const value = errors[key];
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }

  return "Validation failed on server.";
}

function isValidationStatus(status?: number): boolean {
  return status === 409 || status === 422;
}

async function removeLatestQueuedOp(uuid: string, action: "create" | "update") {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((item) => item.entity === "customers" && item.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}

function customerMatchesQuery(row: CustomerRow, query: string): boolean {
  const q = query.toLowerCase();
  return (
    row.name.toLowerCase().includes(q) ||
    (row.fname ?? "").toLowerCase().includes(q) ||
    (row.gname ?? "").toLowerCase().includes(q) ||
    row.phone.toLowerCase().includes(q) ||
    (row.phone1 ?? "").toLowerCase().includes(q) ||
    (row.email ?? "").toLowerCase().includes(q)
  );
}

function parseCustomersApiPayload(payload: unknown): {
  list: UnknownRecord[];
  hasMore: boolean;
  serverTime: string;
} {
  if (Array.isArray(payload)) {
    return {
      list: payload.filter(isRecord),
      hasMore: false,
      serverTime: new Date().toISOString(),
    };
  }

  const payloadRecord = isRecord(payload) ? payload : {};
  const directData = payloadRecord.data;
  if (Array.isArray(directData)) {
    const meta = isRecord(payloadRecord.meta) ? payloadRecord.meta : {};
    return {
      list: directData.filter(isRecord),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? new Date().toISOString()),
    };
  }

  const nestedContainer = isRecord(directData) ? directData : {};
  const nestedData = nestedContainer.data;
  if (Array.isArray(nestedData)) {
    const meta = isRecord(payloadRecord.meta) ? payloadRecord.meta : {};
    const current = Number(nestedContainer.current_page ?? 1);
    const last = Number(nestedContainer.last_page ?? 1);

    return {
      list: nestedData.filter(isRecord),
      hasMore: current < last,
      serverTime: String(meta.server_time ?? new Date().toISOString()),
    };
  }

  return {
    list: [],
    hasMore: false,
    serverTime: new Date().toISOString(),
  };
}

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

export async function customersListLocal(query: CustomersLocalQuery = {}): Promise<CustomersLocalPage> {
  await customersRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await db.customers.count();
    const items = await db.customers.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return {
      items,
      page,
      pageSize,
      total,
      hasMore: offset + items.length < total,
    };
  }

  const collection = db.customers.orderBy("updated_at").reverse().filter((row) => customerMatchesQuery(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();

  return {
    items,
    page,
    pageSize,
    total,
    hasMore: offset + items.length < total,
  };
}

export async function customerGetLocal(uuid: string) {
  return db.customers.get(uuid);
}

export async function customersPullToLocal() {
  if (!online()) return { pulled: 0 };

  const since = readLocalString(CURSOR_KEY);
  let page = 1;
  let pulled = 0;
  let serverTime = new Date().toISOString();

  while (true) {
    const params: Record<string, string | number> = {
      offline: 1,
      page,
      per_page: PULL_PAGE_SIZE,
    };

    if (since && page === 1) {
      params.since = since;
    }

    const response = await api.get("/api/customers", { params });
    const parsed = parseCustomersApiPayload(response.data);

    const rows = parsed.list
      .map(sanitizeCustomer)
      .filter((row) => row.uuid && row.name && row.phone);

    serverTime = parsed.serverTime;

    if (rows.length > 0) {
      await db.customers.bulkPut(rows);
      pulled += rows.length;
    }

    if (!parsed.hasMore || rows.length === 0) {
      break;
    }

    page += 1;
  }

  writeLocalString(CURSOR_KEY, serverTime);
  await customersRetentionCleanupIfDue();

  return { pulled };
}

export async function customerCreate(payload: unknown) {

  
  const uuid = crypto.randomUUID();
  const payloadRecord = isRecord(payload) ? payload : {};
  const row = sanitizeCustomer({
    ...payloadRecord,
    uuid,
    updated_at: Date.now(),
  });
  validateCustomerRow(row);

  await assertNoLocalDuplicate(row);

  await db.customers.put(row);

  await enqueueSync({
    entity: "customers",
    uuid,
    action: "create",
    payload: row,
  });

  if (online()) {
    try {
      const response = await api.post("/api/customers", row);
      const saved = sanitizeCustomer(response.data?.data ?? row);
      await db.customers.put(saved);
    } catch (error: unknown) {
      const status = getApiErrorStatus(error);
      if (isValidationStatus(status)) {
        await db.customers.delete(uuid);
        await removeLatestQueuedOp(uuid, "create");
        throw new Error(parseApiErrorMessage(error));
      }
    }
  }
  return row;
}

export async function customerUpdate(uuid: string, patch: unknown) {

  const existing = await db.customers.get(uuid);
  if (!existing) throw new Error("Customer not found locally");
  const patchRecord = isRecord(patch) ? patch : {};

  const updated = sanitizeCustomer({
    ...existing,
    ...patchRecord,
    uuid,
    updated_at: Date.now(),
  });

  validateCustomerRow(updated);
  await assertNoLocalDuplicate(updated, uuid);

  await db.customers.put(updated);

  await enqueueSync({
    entity: "customers",
    uuid,
    action: "update",
    payload: updated,
  });

  if (online()) {
    try {
      const response = await api.put(`/api/customers/${uuid}`, updated);
      const saved = sanitizeCustomer(response.data?.data ?? updated);
      await db.customers.put(saved);
    } catch (error: unknown) {
      const status = getApiErrorStatus(error);
      if (isValidationStatus(status)) {
        await db.customers.put(existing);
        await removeLatestQueuedOp(uuid, "update");
        throw new Error(parseApiErrorMessage(error));
      }
    }
  }

  return updated;
}

export async function customerDelete(uuid: string) {
  await db.customers.delete(uuid);

  await enqueueSync({
    entity: "customers",
    uuid,
    action: "delete",
    payload: {},
  });

  if (online()) {
    try {
      await api.delete(`/api/customers/${uuid}`);
    } catch {}
  }
}

export async function customersRetentionCleanup() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("customers").toArray();
  const protectedUuids = new Set(pending.map((item) => item.uuid));
  const oldRows = await db.customers.where("updated_at").below(cutoff).toArray();
  const removableUuids = oldRows.filter((row) => !protectedUuids.has(row.uuid)).map((row) => row.uuid);

  if (removableUuids.length > 0) {
    await db.customers.bulkDelete(removableUuids);
  }

  return removableUuids.length;
}

export async function customersRetentionCleanupIfDue() {
  const now = Date.now();
  const last = readLocalNumber(CLEANUP_KEY);

  if (last !== null && now - last < CLEANUP_INTERVAL_MS) {
    return 0;
  }

  const removed = await customersRetentionCleanup();
  writeLocalNumber(CLEANUP_KEY, now);
  return removed;
}
