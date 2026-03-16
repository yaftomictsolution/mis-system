"use client";

import { db, type CrmMessageLocalRow, type PendingModuleOpRow } from "@/db/localDB";
import { emitAppEvent } from "@/lib/appEvents";
import { api } from "@/lib/api";
import {
  deletePendingModuleOp,
  enqueuePendingModuleOp,
  listPendingModuleOps,
} from "@/modules/offline-ops/offline-ops.repo";

type Obj = Record<string, unknown>;

export type CrmMessageRow = {
  id: number;
  customer_id: number;
  installment_id: number | null;
  installment_uuid: string | null;
  installment_no: number | null;
  installment_due_date: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  channel: "email" | "sms";
  message_type: string;
  status: "queued" | "sent" | "failed";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string | null;
  local_only?: boolean;
};

export type CrmMessagePage = {
  items: CrmMessageRow[];
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
};

export type CrmMessageCreatePayload = {
  customer_id: number;
  channel: "email" | "sms";
  message_type: string;
};

export type CrmReminderRunStats = {
  days: number;
  checked: number;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

type CrmSyncResult = {
  synced: number;
  retryableFailure: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();
const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});

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

function toRow(input: unknown): CrmMessageRow {
  const row = asObj(input);
  return {
    id: Number(row.id ?? 0),
    customer_id: Number(row.customer_id ?? 0),
    installment_id: row.installment_id ? Number(row.installment_id) : null,
    installment_uuid: row.installment_uuid ? String(row.installment_uuid) : null,
    installment_no: row.installment_no ? Number(row.installment_no) : null,
    installment_due_date: row.installment_due_date ? String(row.installment_due_date) : null,
    customer_name: String(row.customer_name ?? ""),
    customer_phone: row.customer_phone ? String(row.customer_phone) : null,
    customer_email: row.customer_email ? String(row.customer_email) : null,
    channel: String(row.channel ?? "email") === "sms" ? "sms" : "email",
    message_type: String(row.message_type ?? ""),
    status: (["queued", "sent", "failed"].includes(String(row.status)) ? row.status : "queued") as CrmMessageRow["status"],
    error_message: row.error_message ? String(row.error_message) : null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    local_only: Boolean(row.local_only),
  };
}

function toLocalRow(row: CrmMessageRow): CrmMessageLocalRow {
  return {
    ...row,
    updated_at: nowMs(),
    local_only: Boolean(row.local_only),
  };
}

function fromLocalRow(row: CrmMessageLocalRow): CrmMessageRow {
  return {
    id: row.id,
    customer_id: row.customer_id,
    installment_id: row.installment_id,
    installment_uuid: row.installment_uuid,
    installment_no: row.installment_no,
    installment_due_date: row.installment_due_date,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    channel: row.channel,
    message_type: row.message_type,
    status: row.status,
    error_message: row.error_message,
    metadata: row.metadata,
    sent_at: row.sent_at,
    created_at: row.created_at,
    local_only: Boolean(row.local_only),
  };
}

function nextTempCrmId(): number {
  return -Math.trunc(Date.now() + Math.random() * 1000);
}

function compareCreatedAt(a: CrmMessageLocalRow, b: CrmMessageLocalRow): number {
  return Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
}

async function crmMessagesListLocal(params: {
  page?: number;
  perPage?: number;
  q?: string;
  status?: string;
  channel?: string;
  customerId?: number;
} = {}): Promise<CrmMessagePage> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.max(1, params.perPage ?? 20);
  const q = (params.q ?? "").trim().toLowerCase();
  const rows = await db.crm_messages.toArray();

  const filtered = rows.filter((row) => {
    if (params.status && row.status !== params.status) return false;
    if (params.channel && row.channel !== params.channel) return false;
    if (params.customerId && row.customer_id !== params.customerId) return false;
    if (!q) return true;
    return [
      row.customer_name,
      row.customer_phone,
      row.customer_email,
      row.channel,
      row.message_type,
      row.status,
      row.error_message,
      row.installment_due_date,
    ].some((value) => String(value ?? "").toLowerCase().includes(q));
  });

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

async function crmMessagesListRemote(params: {
  page?: number;
  perPage?: number;
  q?: string;
  status?: string;
  channel?: string;
  customerId?: number;
} = {}): Promise<CrmMessagePage> {
  const res = await api.get("/api/crm/messages", {
    params: {
      page: params.page ?? 1,
      per_page: params.perPage ?? 20,
      q: params.q || undefined,
      status: params.status || undefined,
      channel: params.channel || undefined,
      customer_id: params.customerId || undefined,
    },
  });

  const root = asObj(res.data);
  const meta = asObj(root.meta);
  const data = Array.isArray(root.data) ? root.data.map(toRow) : [];
  if (data.length > 0) {
    await db.crm_messages.bulkPut(data.map(toLocalRow));
  }

  return {
    items: data,
    page: Number(meta.page ?? params.page ?? 1),
    perPage: Number(meta.per_page ?? params.perPage ?? 20),
    total: Number(meta.total ?? data.length),
    hasMore: Boolean(meta.has_more),
  };
}

async function buildOfflineCrmRow(payload: CrmMessageCreatePayload): Promise<CrmMessageRow> {
  const customer = await db.customers.filter((row) => Number(row.id) === payload.customer_id).first();
  return {
    id: nextTempCrmId(),
    customer_id: payload.customer_id,
    installment_id: null,
    installment_uuid: null,
    installment_no: null,
    installment_due_date: null,
    customer_name: customer?.name ?? `Customer #${payload.customer_id}`,
    customer_phone: customer?.phone ?? null,
    customer_email: customer?.email ?? null,
    channel: payload.channel,
    message_type: payload.message_type,
    status: "queued",
    error_message: null,
    metadata: { queued_offline: true },
    sent_at: null,
    created_at: nowIso(),
    local_only: true,
  };
}

async function syncCrmCreateOp(op: PendingModuleOpRow): Promise<"synced" | "retry" | "dropped"> {
  const payload = asObj(op.payload);
  const tempId = Number(payload.temp_id ?? 0);
  const customerId = Number(payload.customer_id ?? 0);
  const channel = String(payload.channel ?? "") === "sms" ? "sms" : "email";
  const messageType = String(payload.message_type ?? "");

  if (!tempId || !customerId || !messageType) {
    await db.crm_messages.delete(tempId);
    await deletePendingModuleOp(op.id);
    return "dropped";
  }

  try {
    const res = await api.post("/api/crm/messages", {
      customer_id: customerId,
      channel,
      message_type: messageType,
    });
    const saved = toRow(asObj(res.data).data);
    await db.transaction("rw", db.crm_messages, db.pending_module_ops, async () => {
      await db.crm_messages.delete(tempId);
      await db.crm_messages.put(toLocalRow(saved));
      await deletePendingModuleOp(op.id);
    });
    return "synced";
  } catch (error: unknown) {
    if (isRetryable(error)) return "retry";
    await db.crm_messages.delete(tempId);
    await deletePendingModuleOp(op.id);
    return "dropped";
  }
}

async function syncCrmRetryOp(op: PendingModuleOpRow): Promise<"synced" | "retry" | "dropped"> {
  const payload = asObj(op.payload);
  const id = Number(payload.id ?? 0);
  if (!id) {
    await deletePendingModuleOp(op.id);
    return "dropped";
  }

  try {
    const res = await api.post(`/api/crm/messages/${id}/retry`);
    const saved = toRow(asObj(res.data).data);
    await db.crm_messages.put(toLocalRow(saved));
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

export async function crmMessagesList(params: {
  page?: number;
  perPage?: number;
  q?: string;
  status?: string;
  channel?: string;
  customerId?: number;
} = {}): Promise<CrmMessagePage> {
  if (isOnline()) {
    try {
      await crmMessagesListRemote(params);
    } catch (error: unknown) {
      const local = await crmMessagesListLocal(params);
      if (local.items.length > 0 || isOfflineError(error)) {
        return local;
      }
      throw error;
    }
  }

  return crmMessagesListLocal(params);
}

export async function crmMessageCreate(payload: CrmMessageCreatePayload): Promise<CrmMessageRow> {
  if (isOnline()) {
    try {
      const res = await api.post("/api/crm/messages", payload);
      const saved = toRow(asObj(res.data).data);
      await db.crm_messages.put(toLocalRow(saved));
      emitAppEvent("crm:changed");
      return saved;
    } catch (error: unknown) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  const queued = await buildOfflineCrmRow(payload);
  await db.transaction("rw", db.crm_messages, db.pending_module_ops, async () => {
    await db.crm_messages.put(toLocalRow(queued));
    await enqueuePendingModuleOp({
      module: "crm",
      action: "create",
      target_id: String(queued.id),
      payload: {
        temp_id: queued.id,
        customer_id: payload.customer_id,
        channel: payload.channel,
        message_type: payload.message_type,
      },
    });
  });

  emitAppEvent("crm:changed");
  return queued;
}

export async function crmMessageRetry(id: number): Promise<CrmMessageRow> {
  const existing = await db.crm_messages.get(id);
  if (!existing) {
    throw new Error("CRM message not found.");
  }

  if (isOnline()) {
    try {
      const res = await api.post(`/api/crm/messages/${id}/retry`);
      const saved = toRow(asObj(res.data).data);
      await db.crm_messages.put(toLocalRow(saved));
      emitAppEvent("crm:changed");
      return saved;
    } catch (error: unknown) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  const queued: CrmMessageRow = {
    ...fromLocalRow(existing),
    status: "queued",
    error_message: null,
    metadata: { ...(existing.metadata ?? {}), queued_offline_retry: true },
    local_only: existing.local_only,
  };

  await db.transaction("rw", db.crm_messages, db.pending_module_ops, async () => {
    await db.crm_messages.put(toLocalRow(queued));
    await enqueuePendingModuleOp({
      module: "crm",
      action: "retry",
      target_id: String(id),
      payload: { id },
    });
  });

  emitAppEvent("crm:changed");
  return queued;
}

export async function crmRunInstallmentReminders(days = 10): Promise<CrmReminderRunStats> {
  if (!isOnline()) {
    throw new Error("Reminder run requires internet connection.");
  }

  const res = await api.post("/api/crm/reminders/run", { days });
  const data = asObj(asObj(res.data).data);
  emitAppEvent("crm:changed");
  return {
    days: Number(data.days ?? days),
    checked: Number(data.checked ?? 0),
    attempted: Number(data.attempted ?? 0),
    sent: Number(data.sent ?? 0),
    failed: Number(data.failed ?? 0),
    skipped: Number(data.skipped ?? 0),
  };
}

export async function syncPendingCrmOps(): Promise<CrmSyncResult> {
  if (!isOnline()) {
    return { synced: 0, retryableFailure: false };
  }

  const ops = await listPendingModuleOps("crm");
  let synced = 0;

  for (const op of ops) {
    const result = op.action === "create" ? await syncCrmCreateOp(op) : await syncCrmRetryOp(op);
    if (result === "synced") {
      synced += 1;
      continue;
    }
    if (result === "retry") {
      return { synced, retryableFailure: true };
    }
  }

  if (synced > 0) {
    emitAppEvent("crm:changed");
  }

  return { synced, retryableFailure: false };
}
