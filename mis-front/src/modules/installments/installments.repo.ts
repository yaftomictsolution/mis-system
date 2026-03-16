import { db, type InstallmentRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { emitAppEvent } from "@/lib/appEvents";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";
import { apartmentSaleFinancialRecalculateForSaleUuid } from "../apartment-sale-financials/apartment-sale-financials.repo";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "installments_sync_cursor";
const CLEANUP_KEY = "installments_last_cleanup_ms";

type Obj = Record<string, unknown>;

export type InstallmentsLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  saleUuid?: string;
  saleId?: string;
  status?: string;
};

export type InstallmentsLocalPage = {
  items: InstallmentRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type InstallmentPayInput = {
  amount: number;
  paid_date?: string;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});

function emitInstallmentsChanged(payload?: { saleUuid?: string; installmentUuid?: string }): void {
  emitAppEvent("installments:changed", {
    saleUuid: payload?.saleUuid ?? null,
    installmentUuid: payload?.installmentUuid ?? null,
  });
}

function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const parsed = Date.parse(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function toAmount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : Number(n.toFixed(2));
}

function toPositiveInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function normalizeStatus(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "paid" || s === "overdue" || s === "cancelled") return s;
  return "pending";
}

function toIsoDate(v: unknown): string {
  const d = new Date(typeof v === "number" ? v : Date.parse(String(v ?? "")));
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function deriveStatus(row: InstallmentRow): string {
  if (row.paid_amount >= row.amount) return "paid";
  if (new Date(row.due_date).getTime() < new Date(new Date().toISOString().slice(0, 10)).getTime()) return "overdue";
  return "pending";
}

function sanitizeInstallment(input: unknown): InstallmentRow {
  const r = asObj(input);
  const idNum = Number(r.id);
  const amount = toAmount(r.amount);
  const paidAmount = toAmount(r.paid_amount);
  const remainingAmount =
    r.remaining_amount === undefined || r.remaining_amount === null
      ? Math.max(0, Number((amount - paidAmount).toFixed(2)))
      : toAmount(r.remaining_amount);

  return {
    id: Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : undefined,
    uuid: String(r.uuid ?? ""),
    sale_id: String(r.sale_id ?? "").trim(),
    apartment_sale_id: toPositiveInt(r.apartment_sale_id),
    installment_no: Math.max(1, toPositiveInt(r.installment_no)),
    amount,
    due_date: toTs(r.due_date),
    paid_amount: paidAmount,
    paid_date:
      r.paid_date === null || r.paid_date === undefined || String(r.paid_date).trim() === ""
        ? null
        : toTs(r.paid_date),
    remaining_amount: remainingAmount,
    status: normalizeStatus(r.status),
    sale_uuid: String(r.sale_uuid ?? ""),
    apartment_id: toPositiveInt(r.apartment_id),
    customer_id: toPositiveInt(r.customer_id),
    sale_status: String(r.sale_status ?? ""),
    updated_at: toTs(r.updated_at ?? r.server_updated_at),
    created_at: toTs(r.created_at ?? r.updated_at ?? r.server_updated_at),
  };
}

function isDeletedRecord(input: unknown): boolean {
  const r = asObj(input);
  return r.deleted_at !== null && r.deleted_at !== undefined && String(r.deleted_at).trim() !== "";
}

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function getApiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data?.errors && typeof data.errors === "object") {
    for (const key of Object.keys(data.errors)) {
      const value = (data.errors as Obj)[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  return "Validation failed on server.";
}

const isValidationError = (status?: number) => status === 409 || status === 422;

async function removeLatestQueueItem(uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((item) => item.entity === "installments" && item.action === action)
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

function matchesSearch(row: InstallmentRow, q: string): boolean {
  return [
    row.sale_id,
    row.uuid,
    row.sale_uuid,
    row.status,
    row.installment_no,
    row.amount,
    row.paid_amount,
    row.apartment_sale_id,
    row.customer_id,
    row.apartment_id,
  ].some((value) => String(value ?? "").toLowerCase().includes(q));
}

function parseInstallmentsPayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
  if (Array.isArray(payload)) {
    return { list: payload.map(asObj), hasMore: false, serverTime: new Date().toISOString() };
  }

  const root = asObj(payload);
  const meta = asObj(root.meta);
  const topData = root.data;

  if (Array.isArray(topData)) {
    return {
      list: topData.map(asObj),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? new Date().toISOString()),
    };
  }

  const paged = asObj(topData);
  const nested = paged.data;
  if (Array.isArray(nested)) {
    const current = Number(paged.current_page ?? 1);
    const last = Number(paged.last_page ?? 1);
    return {
      list: nested.map(asObj),
      hasMore: current < last,
      serverTime: String(meta.server_time ?? new Date().toISOString()),
    };
  }

  return { list: [], hasMore: false, serverTime: new Date().toISOString() };
}

function toApiPayload(row: InstallmentRow): Obj {
  return {
    uuid: row.uuid,
    apartment_sale_id: row.apartment_sale_id,
    installment_no: row.installment_no,
    amount: row.amount,
    due_date: toIsoDate(row.due_date),
    paid_amount: row.paid_amount,
    paid_date: row.paid_date ? toIsoDate(row.paid_date) : null,
    status: normalizeStatus(row.status),
    updated_at: row.updated_at,
  };
}

async function refreshSaleInstallmentsFromServer(apartmentSaleId: number): Promise<void> {
  if (apartmentSaleId <= 0) return;

  let page = 1;
  const allRows: InstallmentRow[] = [];

  while (true) {
    const res = await api.get("/api/installments", {
      params: { apartment_sale_id: apartmentSaleId, page, per_page: PULL_PAGE_SIZE },
    });
    const parsed = parseInstallmentsPayload(res.data);
    const rows = parsed.list.map(sanitizeInstallment).filter((row) => row.uuid);
    allRows.push(...rows);

    if (!parsed.hasMore) break;
    page += 1;
  }

  const existing = await db.installments.where("apartment_sale_id").equals(apartmentSaleId).toArray();
  const incomingUuids = new Set(allRows.map((row) => row.uuid));
  const staleUuids = existing.filter((row) => !incomingUuids.has(row.uuid)).map((row) => row.uuid);

  if (staleUuids.length) {
    await db.installments.bulkDelete(staleUuids);
  }
  if (allRows.length) {
    await db.installments.bulkPut(allRows);
  }
}

async function recalculateFinancialForInstallment(row: InstallmentRow): Promise<void> {
  const directSaleUuid = String(row.sale_uuid ?? "").trim();
  if (directSaleUuid) {
    await apartmentSaleFinancialRecalculateForSaleUuid(directSaleUuid, { queue: false });
    return;
  }

  if (row.apartment_sale_id > 0) {
    const sale = await db.apartment_sales.where("id").equals(row.apartment_sale_id).first();
    if (sale?.uuid) {
      await apartmentSaleFinancialRecalculateForSaleUuid(sale.uuid, { queue: false });
    }
  }
}

function getLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function setLs(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function getLsNumber(key: string): number | null {
  const raw = getLs(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function installmentsListLocal(query: InstallmentsLocalQuery = {}): Promise<InstallmentsLocalPage> {
  await installmentRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();
  const saleUuid = (query.saleUuid ?? "").trim();
  const saleId = (query.saleId ?? "").trim();
  const status = normalizeStatus(query.status);

  let rows = await db.installments.orderBy("updated_at").reverse().toArray();

  if (saleUuid) {
    rows = rows.filter((row) => row.sale_uuid === saleUuid);
  }
  if (saleId) {
    rows = rows.filter((row) => row.sale_id === saleId);
  }
  if ((query.status ?? "").trim()) {
    rows = rows.filter((row) => normalizeStatus(row.status) === status);
  }
  if (q) {
    rows = rows.filter((row) => matchesSearch(row, q));
  }

  const total = rows.length;
  const items = rows.slice(offset, offset + pageSize);
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function installmentsPaidTotalsBySaleUuidLocal(
  saleUuids: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(saleUuids.map((v) => v.trim()).filter(Boolean))];
  if (!unique.length) return new Map<string, number>();

  const sales = await db.apartment_sales.where("uuid").anyOf(unique).toArray();
  const saleIdToUuid = new Map<number, string>();
  for (const sale of sales) {
    if (typeof sale.id === "number" && sale.id > 0 && sale.uuid) {
      saleIdToUuid.set(sale.id, sale.uuid);
    }
  }

  const [byUuidRows, bySaleIdRows] = await Promise.all([
    db.installments.where("sale_uuid").anyOf(unique).toArray(),
    saleIdToUuid.size
      ? db.installments.where("apartment_sale_id").anyOf([...saleIdToUuid.keys()]).toArray()
      : Promise.resolve([] as InstallmentRow[]),
  ]);

  const rows = [...byUuidRows, ...bySaleIdRows];
  const totals = new Map<string, number>();
  const seenInstallments = new Set<string>();

  for (const row of rows) {
    if (row.uuid && seenInstallments.has(row.uuid)) continue;
    if (row.uuid) seenInstallments.add(row.uuid);

    const saleUuidFromRow = String(row.sale_uuid ?? "").trim();
    const saleUuid = saleUuidFromRow || saleIdToUuid.get(row.apartment_sale_id) || "";
    if (!saleUuid) continue;
    const paid = toAmount(row.paid_amount);
    const prev = totals.get(saleUuid) ?? 0;
    totals.set(saleUuid, Number((prev + paid).toFixed(2)));
  }

  return totals;
}

export async function installmentsPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const since = getLs(CURSOR_KEY);
  let page = 1;
  let pulled = 0;
  let serverTime = new Date().toISOString();
  const touchedSaleIds = new Set<number>();
  const touchedSaleUuids = new Set<string>();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/installments", { params });
    const parsed = parseInstallmentsPayload(res.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(asObj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.installments.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("installments", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeInstallment)
      .filter((row) => row.uuid);

    if (rows.length) {
      await db.installments.bulkPut(rows);
      pulled += rows.length;
      for (const row of rows) {
        if (row.apartment_sale_id > 0) {
          touchedSaleIds.add(row.apartment_sale_id);
        }
        const saleUuid = String(row.sale_uuid ?? "").trim();
        if (saleUuid) touchedSaleUuids.add(saleUuid);
      }
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  if (since) {
    for (const apartmentSaleId of touchedSaleIds) {
      await refreshSaleInstallmentsFromServer(apartmentSaleId);
    }
  }

  for (const apartmentSaleId of touchedSaleIds) {
    const sale = await db.apartment_sales.where("id").equals(apartmentSaleId).first();
    if (sale?.uuid) touchedSaleUuids.add(sale.uuid);
  }

  if (touchedSaleUuids.size) {
    await Promise.all(
      [...touchedSaleUuids].map((saleUuid) =>
        apartmentSaleFinancialRecalculateForSaleUuid(saleUuid, { queue: false })
      )
    );
  }

  setLs(CURSOR_KEY, serverTime);
  await installmentRetentionCleanupIfDue();
  return { pulled };
}

export async function installmentPay(uuid: string, input: InstallmentPayInput): Promise<InstallmentRow> {
  const existing = await db.installments.get(uuid);
  if (!existing) throw new Error("Installment not found locally.");
  if (existing.apartment_sale_id <= 0) {
    throw new Error("Installment is not linked to a synced sale yet.");
  }
  if (normalizeStatus(existing.status) === "cancelled") {
    throw new Error("Cancelled installment cannot be paid.");
  }

  const requested = toAmount(input.amount);
  if (requested <= 0) throw new Error("Payment amount must be greater than 0.");

  const remaining = Math.max(0, Number((existing.amount - existing.paid_amount).toFixed(2)));
  if (remaining <= 0) throw new Error("Installment is already fully paid.");

  const paid = Math.min(requested, remaining);
  const nextPaid = Number((existing.paid_amount + paid).toFixed(2));
  const paidDateTs = input.paid_date ? toTs(input.paid_date) : Date.now();

  const updated: InstallmentRow = {
    ...existing,
    paid_amount: nextPaid,
    remaining_amount: Math.max(0, Number((existing.amount - nextPaid).toFixed(2))),
    paid_date: paidDateTs,
    updated_at: Date.now(),
  };
  updated.status = deriveStatus(updated);
  const online = isOnline();

  await db.installments.put(updated);
  await recalculateFinancialForInstallment(updated);

  if (!online) {
    await enqueueSync({
      entity: "installments",
      uuid,
      localKey: uuid,
      action: "update",
      payload: toApiPayload(updated),
      rollbackSnapshot: existing,
    });
    emitInstallmentsChanged({ saleUuid: updated.sale_uuid, installmentUuid: updated.uuid });
    notifySuccess("Installment payment saved offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.post(`/api/installments/${uuid}/pay`, {
      amount: paid,
      paid_date: toIsoDate(paidDateTs),
    });
    const parsed = sanitizeInstallment(asObj(res.data).data ?? updated);
    const saved = !parsed.uuid ? updated : parsed;
    await db.installments.put(saved);
    await recalculateFinancialForInstallment(saved);
    emitInstallmentsChanged({ saleUuid: saved.sale_uuid, installmentUuid: saved.uuid });
    notifySuccess("Installment payment saved successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.installments.put(existing);
      await recalculateFinancialForInstallment(existing);
      emitInstallmentsChanged({ saleUuid: existing.sale_uuid, installmentUuid: existing.uuid });
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await enqueueSync({
      entity: "installments",
      uuid,
      localKey: uuid,
      action: "update",
      payload: toApiPayload(updated),
      rollbackSnapshot: existing,
    });
    emitInstallmentsChanged({ saleUuid: updated.sale_uuid, installmentUuid: updated.uuid });
    notifyInfo("Installment payment saved locally. Server sync will retry later.");
    return updated;
  }
}

async function installmentRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("installments", RETENTION_DAYS);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("installments").toArray();
  const locked = new Set(pending.map((item) => item.uuid));

  const oldRows = await db.installments.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await db.installments.bulkDelete(removable);
  }

  return removable.length;
}

export async function installmentRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const last = getLsNumber(CLEANUP_KEY);
  if (last !== null && now - last < CLEANUP_INTERVAL_MS) return 0;

  const removed = await installmentRetentionCleanup();
  setLs(CLEANUP_KEY, String(now));
  return removed;
}
