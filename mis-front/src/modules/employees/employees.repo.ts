import { db, type EmployeeRow, type EmployeeSalaryHistoryRow } from "@/db/localDB";
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
type EmployeePayloadInput = Obj & {
  salary_change_reason?: unknown;
  salary_effective_from?: unknown;
  salary_history_uuid?: unknown;
};

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

function sanitizeEmployee(input: unknown): EmployeeRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);

  return {
    id: toRowId(record.id, uuid),
    uuid,
    first_name: trimText(record.first_name ?? record.firstname, 100),
    last_name: trimOrNull(record.last_name, 100),
    biometric_user_id: trimOrNull(record.biometric_user_id, 255),
    job_title: trimOrNull(record.job_title, 100),
    salary_type: normalizeSalaryType(record.salary_type),
    base_salary: toNullableMoney(record.base_salary),
    salary_currency_code: trimOrNull(record.salary_currency_code, 10)?.toUpperCase() || "USD",
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
    row.biometric_user_id,
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

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await db.employees.count();
    const items = await db.employees.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = db.employees.orderBy("updated_at").reverse().filter((row) => matchesSearch(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function employeesRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("employees", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("employees").toArray();
  const locked = new Set(pending.map((item) => item.uuid));

  const oldRows = await db.employees.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);

  if (removable.length) {
    await db.employees.bulkDelete(removable);
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
  return db.employees.get(uuid);
}

export async function employeePullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(CURSOR_KEY);
  const localCount = await db.employees.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(CURSOR_KEY);
  }
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
      await db.employees.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("employees", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeEmployee)
      .filter((row) => row.uuid && row.first_name);

    if (rows.length) {
      await db.employees.bulkPut(rows);
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
}

async function assertNoDuplicate(row: EmployeeRow, ignoreUuid?: string): Promise<void> {
  const email = row.email.toLowerCase();
  const biometricId = String(row.biometric_user_id ?? "").trim().toLowerCase();
  const duplicate = await db.employees
    .filter((item) => {
      const emailMatch = email !== "" && (item.email ?? "").toLowerCase() === email;
      const biometricMatch =
        biometricId !== "" && String(item.biometric_user_id ?? "").trim().toLowerCase() === biometricId;
      return item.uuid !== ignoreUuid && (emailMatch || biometricMatch);
    })
    .first();

  if (duplicate) {
    if (email !== "" && (duplicate.email ?? "").toLowerCase() === email) {
      throw new Error("Email already exists.");
    }
    throw new Error("Biometric ID already exists.");
  }
}

function toDateOnly(value?: number | null): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function toEmployeeApiPayload(row: EmployeeRow, extras?: EmployeePayloadInput): Obj {
  return {
    uuid: row.uuid,
    first_name: row.first_name,
    last_name: row.last_name,
    job_title: row.job_title,
    salary_type: row.salary_type,
    base_salary: row.base_salary,
    salary_currency_code: trimText(row.salary_currency_code ?? "USD", 10).toUpperCase() || "USD",
    address: row.address,
    email: row.email,
    phone: row.phone !== null ? String(row.phone) : null,
    biometric_user_id: trimOrNull(row.biometric_user_id, 255),
    hire_date: toDateOnly(row.hire_date),
    status: row.status,
    updated_at: row.updated_at,
    salary_change_reason: trimOrNull(extras?.salary_change_reason, 2000),
    salary_effective_from: trimOrNull(extras?.salary_effective_from, 50),
    salary_history_uuid: trimOrNull(extras?.salary_history_uuid, 100),
  };
}

async function createOptimisticSalaryHistory(
  employee: EmployeeRow,
  previousSalary: number | null,
  previousSalaryCurrency: string | null,
  extras: EmployeePayloadInput
): Promise<string | null> {
  const newSalary = employee.base_salary ?? null;
  const nextSalaryCurrency = String(employee.salary_currency_code ?? "USD").toUpperCase();
  const priorSalaryCurrency = String(previousSalaryCurrency ?? nextSalaryCurrency).toUpperCase();
  if (previousSalary === newSalary && priorSalaryCurrency === nextSalaryCurrency) return null;

  const historyUuid = crypto.randomUUID();
  const row: EmployeeSalaryHistoryRow = {
    uuid: historyUuid,
    employee_id: Number(employee.id ?? 0),
    employee_uuid: employee.uuid,
    employee_name: [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || employee.first_name,
    previous_salary: previousSalary,
    previous_salary_currency_code: previousSalary === null ? null : priorSalaryCurrency,
    new_salary: newSalary,
    new_salary_currency_code: newSalary === null ? null : nextSalaryCurrency,
    effective_from: Date.parse(String(extras.salary_effective_from ?? "")) || Date.now(),
    reason: trimOrNull(extras.salary_change_reason, 5000),
    changed_by: null,
    changed_by_name: null,
    source: "manual",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await db.employee_salary_histories.put(row);
  return historyUuid;
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
  if (!saved.uuid || !saved.first_name) {
    return fallback;
  }
  return saved;
}

export async function employeeCreate(payload: unknown): Promise<EmployeeRow> {
  const uuid = crypto.randomUUID();
  const extras = obj(payload) as EmployeePayloadInput;
  const row = sanitizeEmployee({ ...extras, uuid, updated_at: Date.now() });

  validateEmployee(row);
  await assertNoDuplicate(row);

  if (!isOnline()) {
    await db.employees.put(row);
    await enqueueSync({
      entity: "employees",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toEmployeeApiPayload(row, extras),
    });
    notifySuccess("Employee saved offline. It will sync when online.");
    return row;
  }

  try {
    const res = await api.post("/api/employees", toEmployeeApiPayload(row, extras));
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
      payload: toEmployeeApiPayload(row, extras),
    });
    notifyInfo("Employee saved locally. Server sync will retry later.");
    return row;
  }
}

export async function employeeUpdate(uuid: string, patch: unknown): Promise<EmployeeRow> {
  const existing = await db.employees.get(uuid);
  if (!existing) throw new Error("Employee not found locally");

  const extras = obj(patch) as EmployeePayloadInput;
  const previousSalary = existing.base_salary ?? null;
  const previousSalaryCurrency = String(existing.salary_currency_code ?? "USD").toUpperCase();
  const updated = sanitizeEmployee({ ...existing, ...extras, uuid, updated_at: Date.now() });

  validateEmployee(updated);
  await assertNoDuplicate(updated, uuid);

  await db.employees.put(updated);
  const historyUuid = await createOptimisticSalaryHistory(
    updated,
    previousSalary,
    previousSalaryCurrency,
    {
      ...extras,
      salary_effective_from: extras.salary_effective_from ?? toDateOnly(updated.hire_date) ?? new Date().toISOString().slice(0, 10),
    }
  );
  await enqueueSync({
    entity: "employees",
    uuid,
    localKey: uuid,
    action: "update",
    payload: toEmployeeApiPayload(updated, {
      ...extras,
      salary_history_uuid: historyUuid,
      salary_effective_from: extras.salary_effective_from ?? toDateOnly(updated.hire_date) ?? new Date().toISOString().slice(0, 10),
    }),
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Employee updated offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.put(`/api/employees/${uuid}`, toEmployeeApiPayload(updated, {
      ...extras,
      salary_history_uuid: historyUuid,
      salary_effective_from: extras.salary_effective_from ?? toDateOnly(updated.hire_date) ?? new Date().toISOString().slice(0, 10),
    }));
    const saved = pickSavedOrFallback(sanitizeEmployee(obj(res.data).data ?? updated), updated);
    await db.employees.put(saved);
    notifySuccess("Employee updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.employees.put(existing);
      if (historyUuid) {
        await db.employee_salary_histories.delete(historyUuid);
      }
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    notifyInfo("Employee updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function employeeDelete(uuid: string): Promise<void> {
  const existing = await db.employees.get(uuid);
  if (!existing) throw new Error("Employee not found locally");

  await db.employees.delete(uuid);
  await enqueueSync({
    entity: "employees",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Employee deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/employees/${uuid}`);
    notifySuccess("Employee deleted successfully.");
  } catch {
    notifyInfo("Employee deleted locally. Server sync will retry later.");
  }
}
