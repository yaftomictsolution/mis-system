import type { Table } from "dexie";
import { db, type EmployeeRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { enqueueSync } from "@/sync/queue";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";

import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "employees_sync_cursor";
const CLEANUP_KEY = "employees_last_cleanup_ms";
const isValidationError = (status?: number) => status === 409 || status === 422;

type Obj = Record<string, unknown>;
type EmployeeStoreRow = EmployeeRow & { updated_at: number };

export type EmployeeLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type EmployeeLocalPage = {
  items: EmployeeRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const obj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});
const nowIso = () => new Date().toISOString();

function getEmployeesTable(): Table<EmployeeStoreRow, string> | null {
  if (db.employees) {
    return db.employees as unknown as Table<EmployeeStoreRow, string>;
  }

  try {
    return db.table<EmployeeStoreRow, string>("employees");
  } catch {
    return null;
  }
}

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

function trimOrNull(value: unknown, max = 255): string | null {
  const trimmed = trimText(value, max);
  return trimmed || null;
}

function toTs(value: unknown, fallback = Date.now()): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function toNullableMoney(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function normalizeSalaryType(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "daily" || normalized === "project") return normalized;
  return "fixed";
}

function normalizeEmployeeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "resign" ? "resign" : "active";
}

function isDeletedRecord(input: unknown): boolean {
  const record = obj(input);
  return record.deleted_at !== null && record.deleted_at !== undefined && String(record.deleted_at).trim() !== "";
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

function sanitizeEmployee(input: unknown): EmployeeStoreRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);

  return {
    id: toRowId(record.id, uuid),
    uuid,
    first_name: trimText(record.first_name ?? record.firstname, 100),
    last_name: trimOrNull(record.last_name, 100),
    job_title: trimOrNull(record.job_title, 100),
    salary_type: normalizeSalaryType(record.salary_type),
    base_salary: toNullableMoney(record.base_salary),
    address: trimOrNull(record.address, 255),
    email: trimText(record.email, 255),
    phone: toNullableInt(record.phone),
    status: normalizeEmployeeStatus(record.status),
    hire_date: record.hire_date === null || record.hire_date === undefined ? null : toTs(record.hire_date),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesSearch(row: EmployeeRow, query: string): boolean {
  return [
    row.first_name,
    row.last_name,
    row.job_title,
    row.salary_type,
    row.base_salary,
    row.address,
    row.email,
    row.phone,
    row.status,
    row.hire_date,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

export async function employeesListLocal(query: EmployeeLocalQuery = {}): Promise<EmployeeLocalPage> {
  await employeeRetentionCleanupIfDue();
  const table = getEmployeesTable();
  if (!table) {
    return { items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, hasMore: false };
  }

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await table.count();
    const items = await table.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = table.orderBy("updated_at").reverse().filter((row) => matchesSearch(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function employeesRetentionCleanup(): Promise<number> {
  const table = getEmployeesTable();
  if (!table) return 0;

  const retentionDays = getOfflineModuleRetentionDays("employees", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("employees").toArray();
  const locked = new Set(pending.map((item) => item.uuid));

  const oldRows = await table.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);

  if (removable.length) {
    await table.bulkDelete(removable);
  }

  return removable.length;
}

export async function employeeRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(CLEANUP_KEY);

  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;

  const removed = await employeesRetentionCleanup();
  lsSet(CLEANUP_KEY, String(now));
  return removed;
}

function parseEmployeePayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
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
async function removeLatestQueueItem(uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((i) => i.entity === "employees" && i.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}
export async function employeeGetLocal(uuid: string): Promise<EmployeeRow | undefined> {
  return getEmployeesTable()?.get(uuid);
}

export async function employeePullToLocal(): Promise<{ pulled: number }> {
  const table = getEmployeesTable();
  if (!isOnline() || !table) return { pulled: 0 };

  const since = lsGet(CURSOR_KEY);
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) {
      params.since = since;
    }

    const response = await api.get("/api/employees", { params });
    const parsed = parseEmployeePayload(response.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await table.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("employees", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeEmployee)
      .filter((row) => row.uuid && row.first_name);

    if (rows.length) {
      await table.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(CURSOR_KEY, serverTime);
  await employeeRetentionCleanupIfDue();
  return { pulled };
}


function validateEmployee(row: EmployeeRow): void {
  if (!row.first_name) throw new Error("First name code is required.");
  if (!row.last_name) throw new Error("Last name is required.");
  if (!row.phone) throw new Error("Phone is required.");

}


async function assertNoDuplicate(row: EmployeeRow, ignoreUuid?: string): Promise<void> {
  const email = row.email.toLowerCase();
  const duplicate = await db.employees
    .filter((item) => (item.email ?? "").toLowerCase() === email && item.uuid !== ignoreUuid)
    .first();

  if (duplicate) {
    throw new Error("Email already exists.");
  }
}


function toEmployeeApiPayload(row: EmployeeRow): Obj {
  
  return {
    uuid: row.uuid,
    first_name: row.first_name,
    last_name: row.last_name,
    job_title: row.job_title,
    salary_type: row.salary_type,
    base_salary: row.base_salary,
    address: row.address,
    email: row.email,
    phone: row.phone,
    hire_date: row.hire_date,
    status: row.status,
    updated_at: row.updated_at,
  };
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
function pickSavedOrFallback(saved: EmployeeRow, fallback: EmployeeRow): EmployeeRow {
  if (!saved.uuid || !saved.first_name || !saved.last_name) {
    return fallback;
  }
  return saved;
}

export async function employeeCreate(payload: unknown): Promise<EmployeeRow> {
  const uuid = crypto.randomUUID();
  const row = sanitizeEmployee({ ...obj(payload), uuid, updated_at: Date.now() });

  validateEmployee(row);
  await assertNoDuplicate(row);

  if (!isOnline()) {
    await db.employees.put(row);
    await enqueueSync({
      entity: "employees",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toEmployeeApiPayload(row),
    });
    notifySuccess("Employee saved offline. It will sync when online.");
    return row;
  }

  try {
    const res = await api.post("/api/employees", toEmployeeApiPayload(row));
    const saved = pickSavedOrFallback(sanitizeEmployee(obj(res.data).data ?? row), row);
    await db.employees.put(saved);
    notifySuccess("Employee created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.employees.delete(uuid);
      await removeLatestQueueItem(uuid, "create");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    await db.employees.put(row);
    await enqueueSync({
      entity: "employees",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toEmployeeApiPayload(row),
    });
    notifyInfo("Employee saved locally. Server sync will retry later.");
    return row;
  }
}