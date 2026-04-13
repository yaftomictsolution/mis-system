import { db, type UserRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "user_sync_cursor_v2";
const CLEANUP_KEY = "users_last_cleanup_ms";
const ROLE_OPTIONS_KEY = "roles_options_keys";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Obj = Record<string, unknown>;

export type UserRoleLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type UserRoleLocalPage = {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const nowIso = () => new Date().toISOString();
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function lsRemove(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function isDeletedRecord(input: unknown): boolean {
  const r = asObj(input);
  return r.deleted_at !== null && r.deleted_at !== undefined && String(r.deleted_at).trim() !== "";
}

function parseRolesPayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
  if (Array.isArray(payload)) {
    return { list: payload.map(asObj), hasMore: false, serverTime: nowIso() };
  }

  const root = asObj(payload);
  const meta = asObj(root.meta);
  const top = root.data;

  if (Array.isArray(top)) {
    return {
      list: top.map(asObj),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  if (top && typeof top === "object") {
    const paged = asObj(top);
    const nested = paged.data;
    
    if (Array.isArray(nested)) {
      const current = Number(paged.current_page ?? 1);
      const last = Number(paged.last_page ?? 1);
      return {
        list: nested.map(asObj),
        hasMore: current < last,
        serverTime: String(meta.server_time ?? nowIso()),
      };
    }
  }

  const users = root.users ?? root.items ?? root.records;
  if (Array.isArray(users)) {
    return { list: users.map(asObj), hasMore: false, serverTime: nowIso() };
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

async function cleanupBrokenDuplicateUsers(): Promise<void> {
  const rows = await db.users.toArray();
  const grouped = new Map<string, UserRow[]>();

  for (const row of rows) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const list = grouped.get(email) ?? [];
    list.push(row);
    grouped.set(email, list);
  }

  const removable: string[] = [];
  for (const list of grouped.values()) {
    if (list.length < 2) continue;
    const hasNamed = list.some((row) => row.name.trim().length > 0);
    if (!hasNamed) continue;

    for (const row of list) {
      if (!row.name.trim() && !row.password.trim()) {
        removable.push(row.uuid);
      }
    }
  }

  if (!removable.length) return;

  const unique = [...new Set(removable)];
  await db.users.bulkDelete(unique);
  await removeQueuedOpsForEntityUuids("users", unique);
}
function toEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return t ? t.slice(0, 255) : null;
}
function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const d = Date.parse(String(v ?? ""));
  return Number.isFinite(d) ? d : Date.now();
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const names = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "name" in item && typeof (item as { name?: unknown }).name === "string") {
        return ((item as { name: string }).name ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);

  return [...new Set(names)].slice(0, 200);
}

function normalizeUserRoles(value: unknown): string[] {
  if (typeof value === "string") {
    const role = value.trim();
    return role ? [role.slice(0, 255)] : [];
  }

  if (value && typeof value === "object" && "name" in (value as Obj)) {
    const name = String((value as { name?: unknown }).name ?? "").trim();
    return name ? [name.slice(0, 255)] : [];
  }

  return normalizePermissions(value);
}

function sanitizeRole(input: unknown): UserRow {
  const r = asObj(input);
  const name = String(r.name ?? r.full_name ?? "").trim();
  const customerId = Number(r.customer_id ?? 0);
  return {
    uuid: String(r.uuid ?? ""),
    name: name.slice(0, 255),
    password: "",
    email: toEmail(r.email),
    roles: normalizeUserRoles(r.roles ?? r.role),
    customer_id: Number.isFinite(customerId) && customerId > 0 ? Math.trunc(customerId) : null,
    customer_uuid: typeof r.customer_uuid === "string" ? r.customer_uuid.trim() || null : null,
    customer_name: typeof r.customer_name === "string" ? r.customer_name.trim() || null : null,
    updated_at: toTs(r.updated_at ?? r.server_updated_at),
  };
}
function lsSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}
export async function userRoleRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("users", RETENTION_DAYS);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("users").toArray();
  const protectedUuids = new Set(pending.map((i) => i.uuid));

  const oldRows = await db.users.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((r) => !protectedUuids.has(r.uuid)).map((r) => r.uuid);

  if (removable.length) {
    await db.users.bulkDelete(removable);
  }

  return removable.length;
}
function lsNum(key: string): number | null {
  const raw = lsGet(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
export async function userRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const last = lsNum(CLEANUP_KEY);

  if (last !== null && now - last < CLEANUP_INTERVAL_MS) return 0;

  const removed = await userRoleRetentionCleanup();
  lsSet(CLEANUP_KEY, String(now));
  return removed;
}


export async function userPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  await cleanupBrokenDuplicateUsers();

  const cachedSince = lsGet(CURSOR_KEY);
  const localCount = await db.users.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(CURSOR_KEY);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/users", { params });
    const parsed = parseRolesPayload(res.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(asObj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.users.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("users", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeRole)
      .filter((r) => r.uuid && r.name);

    if (rows.length) {
      await db.users.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(CURSOR_KEY, serverTime);
  await userRetentionCleanupIfDue();

  return { pulled };
}



export async function UserListLocal(query: UserRoleLocalQuery = {}): Promise<UserRoleLocalPage> {
  await cleanupBrokenDuplicateUsers();
  await userRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();

  if (!q) {
    const total = await db.users.count();
    const items = await db.users.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const c = db.users.orderBy("updated_at").reverse().filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true;
    if ((row.customer_name ?? "").toLowerCase().includes(q)) return true;
    return (row.roles ?? []).some((roles) => roles.toLowerCase().includes(q));
  });
  const total = await c.count();
  const items = await c.offset(offset).limit(pageSize).toArray();

  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}


function readRoleOptionsCache(): string[] {
  const raw = lsGet(ROLE_OPTIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return normalizePermissions(parsed);
  } catch {
    return [];
  }
}

export async function userRoleOptions(): Promise<string[]> {
  if (!isOnline()) {
    return readRoleOptionsCache();
  }

  try {
    const res = await api.get("/api/users/role-options");
    const data = asObj(res.data).data;
    let names: string[];
    
    if (Array.isArray(data)) {
      names = normalizePermissions(data);
    } else if (Array.isArray(res.data)) {
      names = normalizePermissions(res.data);
    } else {
      names = [];
    }
    
    if (names.length > 0) {
      lsSet(ROLE_OPTIONS_KEY, JSON.stringify(names));
    }
    return names;
  } catch {
    return readRoleOptionsCache();
  }
}

export async function getRolesForDropdown(): Promise<string[]> {
  const localRoles = await db.roles.toArray();
  if (localRoles.length > 0) {
    const names = localRoles.map((r) => r.name).filter(Boolean);
    if (names.length > 0) {
      lsSet(ROLE_OPTIONS_KEY, JSON.stringify(names));
    }
    return names;
  }

  const cached = readRoleOptionsCache();
  if (cached.length > 0) {
    return cached;
  }

  if (!isOnline()) {
    return [];
  }

  try {
    const res = await api.get("/api/roles");
    const data = res.data;
    let roleNames: string[] = [];

    if (Array.isArray(data)) {
      roleNames = data.map((r: unknown) => {
        const obj = asObj(r);
        return String(obj.name ?? "").trim();
      }).filter(Boolean);
    } else {
      const root = asObj(data);
      const arr = Array.isArray(root.data) ? root.data : 
                  Array.isArray(root.roles) ? root.roles : [];
      roleNames = arr.map((r: unknown) => {
        const obj = asObj(r);
        return String(obj.name ?? "").trim();
      }).filter(Boolean);
    }

    if (roleNames.length > 0) {
      lsSet(ROLE_OPTIONS_KEY, JSON.stringify(roleNames));
    }
    return roleNames;
  } catch {
    return [];
  }
}

function validateUser(row: UserRow): void {
  if (!row.name) throw new Error("Full name is required.");
  if (row.email && !EMAIL_REGEX.test(row.email)) {
    throw new Error("Email format is invalid.");
  }
}
function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}
function sanitizeUser(input: unknown): UserRow {
  const r = obj(input);
  const name = String(r.name ?? r.full_name ?? "").trim();
  const customerId = Number(r.customer_id ?? 0);
  return {
    uuid: String(r.uuid ?? ""),
    name: name.slice(0, 255),
    password: String(r.password ?? "").trim().slice(0, 255),
    roles: normalizeUserRoles(r.roles ?? r.role),
    email: toEmail(r.email),
    customer_id: Number.isFinite(customerId) && customerId > 0 ? Math.trunc(customerId) : null,
    customer_uuid: typeof r.customer_uuid === "string" ? r.customer_uuid.trim() || null : null,
    customer_name: typeof r.customer_name === "string" ? r.customer_name.trim() || null : null,
    updated_at: toTs(r.updated_at ?? r.server_updated_at),
  };
}

async function assertNoDuplicate(row: UserRow, ignoreUuid?: string): Promise<void> {
  if (row.email) {
    const email = row.email.toLowerCase();
    const emailDup = await db.users
      .filter((item) => (item.email ?? "").toLowerCase() === email && item.uuid !== ignoreUuid)
      .first();

    if (emailDup) {
      throw new Error("This email already exists.");
    }
  }

  if (row.customer_id && row.customer_id > 0) {
    const customerDup = await db.users
      .filter((item) => Number(item.customer_id ?? 0) === Number(row.customer_id) && item.uuid !== ignoreUuid)
      .first();

    if (customerDup) {
      throw new Error("This customer is already linked to another user.");
    }
  }
}
const isValidationError = (status?: number) => status === 409 || status === 422;

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

function toUserApiPayload(row: UserRow): Obj {
  const role = row.roles?.[0] ?? null;
  return {
    uuid: row.uuid,
    name: row.name,
    email: row.email,
    password: row.password,
    role,
    roles: row.roles ?? [],
    customer_id: row.customer_id ?? null,
    updated_at: row.updated_at,
  };
}

function sanitizeUserWithFallback(input: unknown, fallback: UserRow): UserRow {
  const saved = sanitizeUser(input);
  return {
    uuid: saved.uuid || fallback.uuid,
    name: saved.name || fallback.name,
    password: saved.password || fallback.password,
    roles: saved.roles && saved.roles.length ? saved.roles : fallback.roles,
    email: saved.email ?? fallback.email,
    customer_id: saved.customer_id ?? fallback.customer_id ?? null,
    customer_uuid: saved.customer_uuid ?? fallback.customer_uuid ?? null,
    customer_name: saved.customer_name ?? fallback.customer_name ?? null,
    updated_at: saved.updated_at || fallback.updated_at,
  };
}


export async function userCreate(payload: unknown): Promise<UserRow> {

  
  const uuid = crypto.randomUUID();
  
  const row = sanitizeUser({ ...obj(payload), uuid, updated_at: Date.now() });

  validateUser(row);
  await assertNoDuplicate(row);

  if (!isOnline()) {
    await db.users.put(row);
    await enqueueSync({
      entity: "users",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toUserApiPayload(row),
    });
    notifySuccess("User saved offline. It will sync when online.");
    return row;
  }

  try {
    const res = await api.post("/api/users", toUserApiPayload(row));
    const saved = sanitizeUserWithFallback(obj(res.data).data, row);
    await db.users.put(saved);
    notifySuccess("User created successfully.");
    return saved;
  } catch (error: unknown) {
   
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    await db.users.put(row);
    await enqueueSync({
      entity: "users",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toUserApiPayload(row),
    });
    notifyInfo("User saved locally. Server sync will retry later.");
    return row;
  }
}
export async function userUpdate(uuid: string, patch: unknown): Promise<UserRow> {


  const existing = await db.users.get(uuid);
  if (!existing) throw new Error("User not found locally");

  const updated = sanitizeUser({ ...existing, ...obj(patch), uuid, updated_at: Date.now() });

  validateUser(updated);
  await assertNoDuplicate(updated, uuid);

  if (!isOnline()) {
    await db.users.put(updated);
    await enqueueSync({
      entity: "users",
      uuid,
      localKey: uuid,
      action: "update",
      payload: toUserApiPayload(updated),
      rollbackSnapshot: existing,
    });
    notifySuccess("User updated offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.put(`/api/users/${uuid}`, toUserApiPayload(updated));
    const saved = sanitizeUserWithFallback(obj(res.data).data, updated);
    await db.users.put(saved);
    notifySuccess("User updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    await db.users.put(updated);
    await enqueueSync({
      entity: "users",
      uuid,
      localKey: uuid,
      action: "update",
      payload: toUserApiPayload(updated),
      rollbackSnapshot: existing,
    });
    notifyInfo("User updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function userDelete(uuid: string): Promise<void> {
  const existing = await db.users.get(uuid);
  if (!existing) throw new Error("User not found locally");

  await db.users.delete(uuid);
  await enqueueSync({
    entity: "users",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("User deleted offline. It will sync when online.");
    return;
  }
  try {
    await api.delete(`/api/users/${uuid}`);
    notifySuccess("User deleted successfully.");
  } catch {
    notifyInfo("User deleted locally. Server sync will retry later.");
  }
}



