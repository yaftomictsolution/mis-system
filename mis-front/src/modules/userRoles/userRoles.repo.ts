import { db, type RoleRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "roles_sync_cursor";
const CLEANUP_KEY = "roles_last_cleanup_ms";
const PERMISSION_OPTIONS_KEY = "roles_permission_options";

type Obj = Record<string, unknown>;

export type UserRoleLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type UserRoleLocalPage = {
  items: RoleRow[];
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

function lsSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function lsNum(key: string): number | null {
  const raw = lsGet(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const parsed = Date.parse(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
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

function readPermissionOptionsCache(): string[] {
  const raw = lsGet(PERMISSION_OPTIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return normalizePermissions(parsed);
  } catch {
    return [];
  }
}

function sanitizeRole(input: unknown): RoleRow {
  const r = asObj(input);
  return {
    uuid: String(r.uuid ?? ""),
    name: String(r.name ?? "").trim().slice(0, 255),
    guard_name: typeof r.guard_name === "string" ? r.guard_name : null,
    permissions: normalizePermissions(r.permissions),
    updated_at: toTs(r.updated_at ?? r.server_updated_at),
  };
}

function isDeletedRecord(input: unknown): boolean {
  const r = asObj(input);
  return r.deleted_at !== null && r.deleted_at !== undefined && String(r.deleted_at).trim() !== "";
}

function validateRole(row: RoleRow): void {
  if (!row.name) throw new Error("Role name is required.");
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

  return { list: [], hasMore: false, serverTime: nowIso() };
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

const isValidationError = (status?: number) => status === 409 || status === 422;

async function removeLatestQueueItem(uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((i) => i.entity === "roles" && i.action === action)
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


export async function userRoleUpdate(uuid: string, patch: unknown): Promise<RoleRow> {
  const existing = await db.roles.get(uuid);
  if (!existing) throw new Error("Role not found locally");

  const updated = sanitizeRole({ ...existing, ...obj(patch), uuid, updated_at: Date.now() });

  validateRole(updated);

  await db.roles.put(updated);
  await enqueueSync({
    entity: "roles",
    uuid,
    localKey: uuid,
    action: "update",
    payload: updated,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Role updated offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.put(`/api/roles/${uuid}`, updated);
    const saved = sanitizeRole(obj(res.data).data ?? updated);
    await db.roles.put(saved);
    notifySuccess("Role updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.roles.put(existing);
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    notifyInfo("Role updated locally. Server sync will retry later.");
    return updated;
  }
}
export async function UserRoleListLocal(query: UserRoleLocalQuery = {}): Promise<UserRoleLocalPage> {
  await userRoleRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();

  if (!q) {
    const total = await db.roles.count();
    const items = await db.roles.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const c = db.roles.orderBy("updated_at").reverse().filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true;
    return (row.permissions ?? []).some((permission) => permission.toLowerCase().includes(q));
  });
  const total = await c.count();
  const items = await c.offset(offset).limit(pageSize).toArray();

  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function userRolePullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const since = lsGet(CURSOR_KEY);
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/roles", { params });
    const parsed = parseRolesPayload(res.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(asObj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.roles.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("roles", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeRole)
      .filter((r) => r.uuid && r.name);

    if (rows.length) {
      await db.roles.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(CURSOR_KEY, serverTime);
  await userRoleRetentionCleanupIfDue();

  return { pulled };
}

export async function userRolePermissionOptions(): Promise<string[]> {
  
  if (!isOnline()) {
    return readPermissionOptionsCache();
  }

  try {
    const res = await api.get("/api/roles/permission-options");
    const names = normalizePermissions(asObj(res.data).data);
    lsSet(PERMISSION_OPTIONS_KEY, JSON.stringify(names));
    return names;
  } catch {
    return readPermissionOptionsCache();
  }
}

export async function userRoleCreate(payload: unknown): Promise<RoleRow> {
  const uuid = crypto.randomUUID();
  const row = sanitizeRole({ ...asObj(payload), uuid, updated_at: Date.now() });

  validateRole(row);
  await db.roles.put(row);
  await enqueueSync({
    entity: "roles",
    uuid,
    localKey: uuid,
    action: "create",
    payload: row,
  });

  if (!isOnline()) {
    notifySuccess("Role saved offline. It will sync when online.");
    return row;
  }

  try {
    const res = await api.post("/api/roles", row);
    const saved = sanitizeRole(asObj(res.data).data ?? row);
    if (saved.uuid && saved.uuid !== uuid) {
      await db.roles.delete(uuid);
    }
    await db.roles.put(saved);
    notifySuccess("Role saved successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.roles.delete(uuid);
      await removeLatestQueueItem(uuid, "create");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Role saved locally. Server sync will retry later.");
    return row;
  }
}

export async function userRoleDelete(uuid: string): Promise<void> {
  const existing = await db.roles.get(uuid);
  if (!existing) throw new Error("Role not found locally");

  await db.roles.delete(uuid);
  await enqueueSync({
    entity: "roles",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Role deleted offline. It will sync when online.");
    return;
  }
  try {
    await api.delete(`/api/roles/${uuid}`);
    notifySuccess("Role deleted successfully.");
  } catch {
    notifyInfo("Role deleted locally. Server sync will retry later.");
  }
}

export async function userRoleRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("roles", RETENTION_DAYS);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("roles").toArray();
  const protectedUuids = new Set(pending.map((i) => i.uuid));

  const oldRows = await db.roles.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((r) => !protectedUuids.has(r.uuid)).map((r) => r.uuid);

  if (removable.length) {
    await db.roles.bulkDelete(removable);
  }

  return removable.length;
}

export async function userRoleRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const last = lsNum(CLEANUP_KEY);

  if (last !== null && now - last < CLEANUP_INTERVAL_MS) return 0;

  const removed = await userRoleRetentionCleanup();
  lsSet(CLEANUP_KEY, String(now));
  return removed;
}
