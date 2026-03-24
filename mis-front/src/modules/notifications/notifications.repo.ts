"use client";

import { db, type AdminNotificationLocalRow, type PendingModuleOpRow } from "@/db/localDB";
import { emitAppEvent } from "@/lib/appEvents";
import { api } from "@/lib/api";
import {
  deletePendingModuleOp,
  deletePendingModuleOpsByModule,
  enqueuePendingModuleOp,
  listPendingModuleOps,
} from "@/modules/offline-ops/offline-ops.repo";

type Obj = Record<string, unknown>;

export type AdminNotificationRow = {
  id: string;
  type: string;
  category: string | null;
  title: string;
  message: string;
  sale_uuid: string | null;
  sale_id: string | null;
  read_at: string | null;
  created_at: string | null;
  data: Obj;
};

export type AdminNotificationPage = {
  items: AdminNotificationRow[];
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
};

type NotificationSyncResult = {
  synced: number;
  retryableFailure: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();
const asObj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function isRetryable(error: unknown): boolean {
  const status = getApiStatus(error);
  return status === undefined || status >= 500;
}

function isOfflineError(error: unknown): boolean {
  return !isOnline() || getApiStatus(error) === undefined;
}

function toRow(input: unknown): AdminNotificationRow {
  const row = asObj(input);
  return {
    id: String(row.id ?? ""),
    type: String(row.type ?? ""),
    category: row.category == null ? null : String(row.category),
    title: String(row.title ?? "Notification"),
    message: String(row.message ?? ""),
    sale_uuid: row.sale_uuid == null ? null : String(row.sale_uuid),
    sale_id: row.sale_id == null ? null : String(row.sale_id),
    read_at: row.read_at == null ? null : String(row.read_at),
    created_at: row.created_at == null ? null : String(row.created_at),
    data: asObj(row.data),
  };
}

function toLocalRow(row: AdminNotificationRow): AdminNotificationLocalRow {
  return {
    ...row,
    updated_at: nowMs(),
  };
}

function fromLocalRow(row: AdminNotificationLocalRow): AdminNotificationRow {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    message: row.message,
    sale_uuid: row.sale_uuid,
    sale_id: row.sale_id,
    read_at: row.read_at,
    created_at: row.created_at,
    data: row.data,
  };
}

function compareCreatedAt(a: AdminNotificationLocalRow, b: AdminNotificationLocalRow): number {
  return Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
}

async function notificationsListLocal(params: {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
} = {}): Promise<AdminNotificationPage> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.max(1, Math.min(100, params.perPage ?? 20));
  const rows = await db.admin_notifications.toArray();
  const filtered = params.unreadOnly ? rows.filter((row) => !row.read_at) : rows;
  const sorted = [...filtered].sort(compareCreatedAt);
  const offset = (page - 1) * perPage;
  const items = sorted.slice(offset, offset + perPage).map(fromLocalRow);

  return {
    items,
    page,
    perPage,
    total: sorted.length,
    hasMore: offset + items.length < sorted.length,
  };
}

async function notificationsListRemote(params: {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
} = {}): Promise<AdminNotificationPage> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.max(1, Math.min(100, params.perPage ?? 20));

  const res = await api.get("/api/notifications", {
    params: {
      page,
      per_page: perPage,
      unread_only: params.unreadOnly ? 1 : 0,
    },
  });

  const root = asObj(res.data);
  const data = Array.isArray(root.data) ? root.data : [];
  const meta = asObj(root.meta);
  const rows = data.map(toRow);
  if (rows.length > 0) {
    const existing = await db.admin_notifications.toArray();
    const existingById = new Map(existing.map((row) => [row.id, row]));
    await db.admin_notifications.bulkPut(
      rows.map((row) => {
        const local = existingById.get(row.id);
        return toLocalRow({
          ...row,
          read_at: local?.read_at ?? row.read_at,
        });
      })
    );
  }

  return {
    items: rows,
    page: Number(meta.page ?? page) || page,
    perPage: Number(meta.per_page ?? perPage) || perPage,
    total: Number(meta.total ?? rows.length) || rows.length,
    hasMore: Boolean(meta.has_more),
  };
}

async function setNotificationReadState(readAt: string | null, id?: string): Promise<void> {
  if (id) {
    const row = await db.admin_notifications.get(id);
    if (!row) return;
    await db.admin_notifications.put({
      ...row,
      read_at: readAt,
      updated_at: nowMs(),
    });
    return;
  }

  const rows = await db.admin_notifications.toArray();
  if (rows.length === 0) return;
  await db.admin_notifications.bulkPut(
    rows.map((row) => ({
      ...row,
      read_at: readAt,
      updated_at: nowMs(),
    }))
  );
}

async function removeNotificationLocal(id: string): Promise<void> {
  if (!id) return;
  await db.admin_notifications.delete(id);
}

async function removeReadNotificationsLocal(): Promise<number> {
  const rows = await db.admin_notifications.toArray();
  const ids = rows
    .filter((row) => Boolean(row.read_at))
    .map((row) => row.id)
    .filter(Boolean);

  if (ids.length > 0) {
    await db.admin_notifications.bulkDelete(ids);
  }

  return ids.length;
}

async function syncNotificationOp(op: PendingModuleOpRow): Promise<"synced" | "retry" | "dropped"> {
  const payload = asObj(op.payload);

  try {
    if (op.action === "mark_all_read") {
      await api.post("/api/notifications/read-all");
    } else if (op.action === "delete_all_read") {
      await api.delete("/api/notifications/read");
    } else if (op.action === "delete") {
      const id = String(payload.id ?? op.target_id ?? "");
      if (!id) {
        await deletePendingModuleOp(op.id);
        return "dropped";
      }
      await api.delete(`/api/notifications/${id}`);
    } else {
      const id = String(payload.id ?? op.target_id ?? "");
      if (!id) {
        await deletePendingModuleOp(op.id);
        return "dropped";
      }
      await api.post(`/api/notifications/${id}/read`);
    }

    await deletePendingModuleOp(op.id);
    return "synced";
  } catch (error: unknown) {
    const status = getApiStatus(error);
    if (status === 404 || status === 422) {
      await deletePendingModuleOp(op.id);
      return "dropped";
    }
    return isRetryable(error) ? "retry" : "dropped";
  }
}

export async function notificationsListMine(params: {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
} = {}): Promise<AdminNotificationPage> {
  if (isOnline()) {
    try {
      await notificationsListRemote(params);
    } catch (error: unknown) {
      const local = await notificationsListLocal(params);
      if (local.items.length > 0 || isOfflineError(error)) {
        return local;
      }
      throw error;
    }
  }

  return notificationsListLocal(params);
}

export async function notificationMarkRead(id: string): Promise<void> {
  if (!id) return;
  const readAt = nowIso();
  await setNotificationReadState(readAt, id);

  if (isOnline()) {
    try {
      await api.post(`/api/notifications/${id}/read`);
      emitAppEvent("notifications:changed");
      return;
    } catch (error: unknown) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  await enqueuePendingModuleOp({
    module: "notifications",
    action: "mark_read",
    target_id: id,
    payload: { id, read_at: readAt },
  });
  emitAppEvent("notifications:changed");
}

export async function notificationMarkAllRead(): Promise<void> {
  const readAt = nowIso();
  await setNotificationReadState(readAt);

  if (isOnline()) {
    try {
      await api.post("/api/notifications/read-all");
      emitAppEvent("notifications:changed");
      return;
    } catch (error: unknown) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  await deletePendingModuleOpsByModule("notifications");
  await enqueuePendingModuleOp({
    module: "notifications",
    action: "mark_all_read",
    target_id: "all",
    payload: { read_at: readAt },
  });
  emitAppEvent("notifications:changed");
}

export async function notificationDelete(id: string): Promise<void> {
  if (!id) return;
  await removeNotificationLocal(id);

  if (isOnline()) {
    try {
      await api.delete(`/api/notifications/${id}`);
      emitAppEvent("notifications:changed");
      return;
    } catch (error: unknown) {
      const status = getApiStatus(error);
      if (status === 404) {
        emitAppEvent("notifications:changed");
        return;
      }
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  await enqueuePendingModuleOp({
    module: "notifications",
    action: "delete",
    target_id: id,
    payload: { id },
  });
  emitAppEvent("notifications:changed");
}

export async function notificationDeleteAllRead(): Promise<number> {
  const removed = await removeReadNotificationsLocal();
  if (removed <= 0) return 0;

  if (isOnline()) {
    try {
      await api.delete("/api/notifications/read");
      emitAppEvent("notifications:changed");
      return removed;
    } catch (error: unknown) {
      const status = getApiStatus(error);
      if (status === 404) {
        emitAppEvent("notifications:changed");
        return removed;
      }
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  await enqueuePendingModuleOp({
    module: "notifications",
    action: "delete_all_read",
    target_id: "read",
    payload: { scope: "read" },
  });
  emitAppEvent("notifications:changed");
  return removed;
}

export async function syncPendingNotificationOps(): Promise<NotificationSyncResult> {
  if (!isOnline()) {
    return { synced: 0, retryableFailure: false };
  }

  const ops = await listPendingModuleOps("notifications");
  let synced = 0;

  for (const op of ops) {
    const result = await syncNotificationOp(op);
    if (result === "synced") {
      synced += 1;
      continue;
    }
    if (result === "retry") {
      return { synced, retryableFailure: true };
    }
  }

  if (synced > 0) {
    emitAppEvent("notifications:changed");
  }

  return { synced, retryableFailure: false };
}
