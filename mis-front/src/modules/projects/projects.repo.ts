import { type Table } from "dexie";
import { db, type ProjectRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 5000;
const PULL_PAGE_SIZE = 200;
const PROJECTS_CURSOR_KEY = "projects_sync_cursor";
const PROJECTS_CLEANUP_KEY = "projects_last_cleanup_ms";
const isValidationError = (status?: number) => status === 409 || status === 422;

type Obj = Record<string, unknown>;

type ProjectLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type ProjectLocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type ProjectInput = {
  name: string;
  location?: string | null;
  status?: "planned" | "active" | "completed";
  start_date?: string | null;
  end_date?: string | null;
};

type PullConfig<Row extends { uuid: string; updated_at: number }> = {
  entity: "projects";
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

function toNullableTs(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return toTs(value);
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

function normalizeStatus(value: unknown): ProjectRow["status"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "active" || normalized === "completed") return normalized;
  return "planned";
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

function isDeletedRecord(input: unknown): boolean {
  const record = obj(input);
  return record.deleted_at !== null && record.deleted_at !== undefined && String(record.deleted_at).trim() !== "";
}

async function removeQueuedOpsForEntityUuids(entity: string, uuids: string[]): Promise<void> {
  const unique = [...new Set(uuids.filter(Boolean))];
  if (!unique.length) return;

  const ids: number[] = [];
  for (const uuid of unique) {
    const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
    for (const item of items) {
      if (item.entity === entity && item.id !== undefined) ids.push(item.id);
    }
  }

  if (ids.length) await db.sync_queue.bulkDelete(ids);
}

async function removeLatestQueueItem(entity: string, uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items.filter((item) => item.entity === entity && item.action === action).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
  if (target?.id !== undefined) await db.sync_queue.delete(target.id);
}

function sanitizeProject(input: unknown): ProjectRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    name: trimText(record.name, 255),
    location: trimOrNull(record.location, 255),
    status: normalizeStatus(record.status),
    start_date: toNullableTs(record.start_date),
    end_date: toNullableTs(record.end_date),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function matchesProjectSearch(row: ProjectRow, query: string): boolean {
  return [row.name, row.location, row.status].some((value) => String(value ?? "").toLowerCase().includes(query));
}

async function listLocal<Row extends { uuid: string; updated_at: number }>(
  config: Pick<PullConfig<Row>, "table" | "matchesSearch">,
  query: ProjectLocalQuery = {},
): Promise<ProjectLocalPage<Row>> {
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

async function retentionCleanup(config: PullConfig<ProjectRow>): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays(config.entity, RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals(config.entity).toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = await config.table.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await config.table.bulkDelete(removable);
  }
  return removable.length;
}

async function retentionCleanupIfDue(config: PullConfig<ProjectRow>): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(config.cleanupKey);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await retentionCleanup(config);
  lsSet(config.cleanupKey, String(now));
  return removed;
}

async function pullToLocal(config: PullConfig<ProjectRow>): Promise<{ pulled: number }> {
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

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await config.table.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids(config.entity, deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(config.sanitize)
      .filter(config.isValid);

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

function validateProjectInput(input: ProjectInput): void {
  if (!trimText(input.name, 255)) {
    throw new Error("Project name is required.");
  }
}

function toProjectPayload(input: ProjectInput): Obj {
  return {
    name: trimText(input.name, 255),
    location: trimOrNull(input.location, 255),
    status: normalizeStatus(input.status),
    start_date: input.start_date ? new Date(input.start_date).toISOString() : null,
    end_date: input.end_date ? new Date(input.end_date).toISOString() : null,
  };
}

const projectsConfig: PullConfig<ProjectRow> = {
  entity: "projects",
  endpoint: "/api/projects",
  cursorKey: PROJECTS_CURSOR_KEY,
  cleanupKey: PROJECTS_CLEANUP_KEY,
  table: db.projects,
  sanitize: sanitizeProject,
  isValid: (row) => Boolean(row.uuid && row.name),
  matchesSearch: matchesProjectSearch,
};

export async function projectsRetentionCleanupIfDue(): Promise<number> {
  return retentionCleanupIfDue(projectsConfig);
}

export async function projectsListLocal(query: ProjectLocalQuery = {}): Promise<ProjectLocalPage<ProjectRow>> {
  await projectsRetentionCleanupIfDue();
  return listLocal(projectsConfig, query);
}

export async function projectsPullToLocal(): Promise<{ pulled: number }> {
  return pullToLocal(projectsConfig);
}

export async function projectCreate(input: ProjectInput): Promise<ProjectRow> {
  validateProjectInput(input);
  const uuid = crypto.randomUUID();
  const payload = toProjectPayload(input);
  const row = sanitizeProject({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...payload,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  if (!isOnline()) {
    await db.projects.put(row);
    await enqueueSync({
      entity: "projects",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Project saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post(projectsConfig.endpoint, { uuid, ...payload });
    const saved = sanitizeProject(obj(response.data).data ?? row);
    await db.projects.put(saved);
    notifySuccess("Project created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.projects.put(row);
    await enqueueSync({
      entity: "projects",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Project saved locally. Server sync will retry later.");
    return row;
  }
}

export async function projectUpdate(uuid: string, input: ProjectInput): Promise<ProjectRow> {
  validateProjectInput(input);
  const existing = await db.projects.get(uuid);
  if (!existing) throw new Error("Project not found locally.");

  const payload = toProjectPayload(input);
  const updated = sanitizeProject({
    ...existing,
    ...payload,
    updated_at: Date.now(),
  });

  await db.projects.put(updated);
  await enqueueSync({
    entity: "projects",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Project updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`${projectsConfig.endpoint}/${uuid}`, payload);
    const saved = sanitizeProject(obj(response.data).data ?? updated);
    await db.projects.put(saved);
    notifySuccess("Project updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.projects.put(existing);
      await removeLatestQueueItem("projects", uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Project updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function projectDelete(uuid: string): Promise<void> {
  const existing = await db.projects.get(uuid);
  if (!existing) throw new Error("Project not found locally.");

  await db.projects.delete(uuid);
  await enqueueSync({
    entity: "projects",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Project deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`${projectsConfig.endpoint}/${uuid}`);
    notifySuccess("Project deleted successfully.");
  } catch {
    notifyInfo("Project deleted locally. Server sync will retry later.");
  }
}
