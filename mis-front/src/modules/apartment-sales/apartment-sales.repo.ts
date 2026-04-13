import { db, type ApartmentSaleRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { emitAppEvent } from "@/lib/appEvents";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";
import { apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { installmentsPullToLocal } from "@/modules/installments/installments.repo";
import {
  apartmentSaleFinancialDeleteBySaleUuid,
  sanitizeApartmentSaleFinancial,
  apartmentSaleFinancialUpsertForSale,
} from "../apartment-sale-financials/apartment-sale-financials.repo";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "apartment_sales_sync_cursor_v2";
const CLEANUP_KEY = "apartment_sales_last_cleanup_ms";

type Obj = Record<string, unknown>;

export type ApartmentSaleLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

export type ApartmentSaleLocalPage = {
  items: ApartmentSaleRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const ALLOWED_STATUSES = ["active", "completed", "cancelled", "pending", "approved", "defaulted", "terminated"];
const ALLOWED_FREQUENCIES = ["weekly", "monthly", "quarterly", "custom_dates"];
const ALLOWED_DEED_STATUSES = ["not_issued", "eligible", "issued"];
const ALLOWED_KEY_HANDOVER_STATUSES = ["not_handed_over", "handed_over", "returned"];

function toIsoDate(v: unknown): string {
  const d = new Date(typeof v === "number" ? v : Date.parse(String(v ?? "")));
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function normalizeFrequency(v: unknown): string {
  const f = String(v ?? "").trim().toLowerCase();
  return ALLOWED_FREQUENCIES.includes(f) ? f : "monthly";
}

function sanitizeCustomDates(
  v: unknown,
  toInt: (x: unknown) => number,
  toMoney: (x: unknown) => number,
  parseTs: (x: unknown) => number
): NonNullable<ApartmentSaleRow["custom_dates"]> {
  if (!Array.isArray(v)) return [];
  return v
    .map((item, idx) => {
      const r = asObj(item);
      return {
        installment_no: toInt(r.installment_no) || idx + 1,
        due_date: parseTs(r.due_date),
        amount: toMoney(r.amount),
      };
    })
    .filter((item) => item.installment_no > 0 && item.amount >= 0);
}

function sanitizeApartmentSale(input: unknown): ApartmentSaleRow {
  const r = asObj(input);
  const idNum = Number(r.id);
  const parseTs = (v: unknown): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const d = Date.parse(String(v ?? ""));
    return Number.isFinite(d) ? d : Date.now();
  };
  const toInt = (v: unknown): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  };
  const toMoney = (v: unknown): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : Number(n.toFixed(2));
  };
  const toBool = (v: unknown): boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  };
  const status = String(r.status ?? "").trim().toLowerCase();
  const editScopeRaw = String(r.edit_scope ?? "").trim().toLowerCase();
  const editScope: ApartmentSaleRow["edit_scope"] =
    editScopeRaw === "full" || editScopeRaw === "limited" || editScopeRaw === "none"
      ? (editScopeRaw as ApartmentSaleRow["edit_scope"])
      : undefined;
  const totalPrice = toMoney(r.total_price);
  const discount = toMoney(r.discount);
  const scheduleLockedAtRaw = r.schedule_locked_at;
  const approvedAtRaw = r.approved_at;
  const hasPaidRaw = r.has_paid_installments;
  const canUpdateRaw = r.can_update;
  const canDeleteRaw = r.can_delete;
  const deedStatusRaw = String(r.deed_status ?? "").trim().toLowerCase();
  const deedIssuedAtRaw = r.deed_issued_at;
  const deedIssuedByRaw = r.deed_issued_by;
  const keyHandoverStatusRaw = String(r.key_handover_status ?? "").trim().toLowerCase();
  const keyHandoverAtRaw = r.key_handover_at;
  const keyHandoverByRaw = r.key_handover_by;
  const possessionStartDateRaw = r.possession_start_date;
  const vacatedAtRaw = r.vacated_at;
  const keyReturnedAtRaw = r.key_returned_at;
  const keyReturnedByRaw = r.key_returned_by;
  const terminationReasonRaw = r.termination_reason;
  const terminationChargeRaw = r.termination_charge;
  const refundAmountRaw = r.refund_amount;
  const remainingDebtAfterTerminationRaw = r.remaining_debt_after_termination;
  const actualNetRevenueRaw = r.actual_net_revenue;
  const hasFirstInstallmentPaidRaw = r.has_first_installment_paid;
  const canHandoverKeyRaw = r.can_handover_key;
  const firstDueRaw = r.first_due_date ?? r.sale_date;
  const customDates = sanitizeCustomDates(r.custom_dates, toInt, toMoney, parseTs);
  const installmentCount = toInt(r.installment_count);
  const frequency = normalizeFrequency(r.frequency_type);

  return {
    id: Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : undefined,
    uuid: String(r.uuid ?? ""),
    sale_id: String(r.sale_id ?? "").trim(),
    sale_date: parseTs(r.sale_date ?? r.updated_at ?? r.server_updated_at),
    total_price: totalPrice,
    discount,
    payment_type: String(r.payment_type ?? "").trim().toLowerCase() === "installment" ? "installment" : "full",
    frequency_type: frequency,
    interval_count: Math.max(1, toInt(r.interval_count) || 1),
    installment_count: installmentCount || (frequency === "custom_dates" ? customDates.length : 0),
    first_due_date: parseTs(firstDueRaw),
    custom_dates: customDates,
    schedule_locked: toBool(r.schedule_locked),
    schedule_locked_at:
      scheduleLockedAtRaw === null || scheduleLockedAtRaw === undefined || String(scheduleLockedAtRaw).trim() === ""
        ? null
        : parseTs(scheduleLockedAtRaw),
    approved_at:
      approvedAtRaw === null || approvedAtRaw === undefined || String(approvedAtRaw).trim() === ""
        ? null
        : parseTs(approvedAtRaw),
    deed_status: ALLOWED_DEED_STATUSES.includes(deedStatusRaw) ? (deedStatusRaw as ApartmentSaleRow["deed_status"]) : "not_issued",
    deed_issued_at:
      deedIssuedAtRaw === null || deedIssuedAtRaw === undefined || String(deedIssuedAtRaw).trim() === ""
        ? null
        : parseTs(deedIssuedAtRaw),
    deed_issued_by:
      deedIssuedByRaw === null || deedIssuedByRaw === undefined || String(deedIssuedByRaw).trim() === ""
        ? null
        : Math.max(0, toInt(deedIssuedByRaw)),
    key_handover_status: ALLOWED_KEY_HANDOVER_STATUSES.includes(keyHandoverStatusRaw)
      ? (keyHandoverStatusRaw as NonNullable<ApartmentSaleRow["key_handover_status"]>)
      : "not_handed_over",
    key_handover_at:
      keyHandoverAtRaw === null || keyHandoverAtRaw === undefined || String(keyHandoverAtRaw).trim() === ""
        ? null
        : parseTs(keyHandoverAtRaw),
    key_handover_by:
      keyHandoverByRaw === null || keyHandoverByRaw === undefined || String(keyHandoverByRaw).trim() === ""
        ? null
        : Math.max(0, toInt(keyHandoverByRaw)),
    possession_start_date:
      possessionStartDateRaw === null || possessionStartDateRaw === undefined || String(possessionStartDateRaw).trim() === ""
        ? null
        : parseTs(possessionStartDateRaw),
    vacated_at:
      vacatedAtRaw === null || vacatedAtRaw === undefined || String(vacatedAtRaw).trim() === ""
        ? null
        : parseTs(vacatedAtRaw),
    key_returned_at:
      keyReturnedAtRaw === null || keyReturnedAtRaw === undefined || String(keyReturnedAtRaw).trim() === ""
        ? null
        : parseTs(keyReturnedAtRaw),
    key_returned_by:
      keyReturnedByRaw === null || keyReturnedByRaw === undefined || String(keyReturnedByRaw).trim() === ""
        ? null
        : Math.max(0, toInt(keyReturnedByRaw)),
    termination_reason:
      terminationReasonRaw === null || terminationReasonRaw === undefined ? null : String(terminationReasonRaw),
    termination_charge: toMoney(terminationChargeRaw),
    refund_amount: toMoney(refundAmountRaw),
    remaining_debt_after_termination: toMoney(remainingDebtAfterTerminationRaw),
    actual_net_revenue: toMoney(actualNetRevenueRaw),
    net_price: toMoney(r.net_price ?? totalPrice - discount),
    installments_count: toInt(r.installments_count),
    installments_paid_total: toMoney(r.installments_paid_total),
    has_paid_installments:
      hasPaidRaw === null || hasPaidRaw === undefined || String(hasPaidRaw).trim() === ""
        ? undefined
        : toBool(hasPaidRaw),
    has_first_installment_paid:
      hasFirstInstallmentPaidRaw === null ||
      hasFirstInstallmentPaidRaw === undefined ||
      String(hasFirstInstallmentPaidRaw).trim() === ""
        ? undefined
        : toBool(hasFirstInstallmentPaidRaw),
    can_handover_key:
      canHandoverKeyRaw === null || canHandoverKeyRaw === undefined || String(canHandoverKeyRaw).trim() === ""
        ? undefined
        : toBool(canHandoverKeyRaw),
    edit_scope: editScope,
    can_update:
      canUpdateRaw === null || canUpdateRaw === undefined || String(canUpdateRaw).trim() === ""
        ? undefined
        : toBool(canUpdateRaw),
    can_delete:
      canDeleteRaw === null || canDeleteRaw === undefined || String(canDeleteRaw).trim() === ""
        ? undefined
        : toBool(canDeleteRaw),
    customer_id: toInt(r.customer_id),
    apartment_id: toInt(r.apartment_id),
    status: ALLOWED_STATUSES.includes(status) ? status : "active",
    updated_at: parseTs(r.updated_at ?? r.server_updated_at),
  };
}

async function hasAnyPaidInstallmentLocal(sale: ApartmentSaleRow): Promise<boolean> {
  if (sale.id && sale.id > 0) {
    const paidBySaleId = await db.installments
      .where("apartment_sale_id")
      .equals(sale.id)
      .filter((row) => Number(row.paid_amount) > 0)
      .first();
    if (paidBySaleId) return true;
  }

  if (sale.uuid) {
    const paidBySaleUuid = await db.installments
      .where("sale_uuid")
      .equals(sale.uuid)
      .filter((row) => Number(row.paid_amount) > 0)
      .first();
    if (paidBySaleUuid) return true;
  }

  return false;
}

async function resolveLocalEditScope(sale: ApartmentSaleRow): Promise<"full" | "limited" | "none"> {
  if (sale.edit_scope) return sale.edit_scope;

  if (sale.deed_status === "issued") return "none";

  const status = String(sale.status ?? "").trim().toLowerCase();
  const hasPaid = sale.has_paid_installments || (await hasAnyPaidInstallmentLocal(sale));

  if (status === "completed" || status === "cancelled" || status === "terminated" || status === "defaulted") return "none";
  if ((status === "pending" || status === "active") && !hasPaid) return "full";
  if (status === "approved" || hasPaid) return "limited";
  return "none";
}

async function canDeleteLocalSale(sale: ApartmentSaleRow): Promise<boolean> {
  if (typeof sale.can_delete === "boolean") return sale.can_delete;
  if (sale.deed_status === "issued") return false;

  const status = String(sale.status ?? "").trim().toLowerCase();
  const hasPaid = sale.has_paid_installments || (await hasAnyPaidInstallmentLocal(sale));

  if (status === "cancelled") return !hasPaid;
  if (status === "completed" || status === "terminated" || status === "defaulted" || status === "approved") return false;
  return status === "pending" || status === "active";
}

function isEquivalentCustomDates(
  a: ApartmentSaleRow["custom_dates"] | undefined,
  b: ApartmentSaleRow["custom_dates"] | undefined
): boolean {
  const normalize = (rows: ApartmentSaleRow["custom_dates"] | undefined) =>
    (rows ?? [])
      .map((row, idx) => ({
        installment_no: Math.max(1, Number(row.installment_no) || idx + 1),
        due_date: Number(row.due_date) || 0,
        amount: Number(row.amount) || 0,
      }))
      .sort((x, y) => x.installment_no - y.installment_no);

  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function hasRestrictedSaleChanges(existing: ApartmentSaleRow, updated: ApartmentSaleRow): boolean {
  return (
    String(existing.sale_id ?? "").trim() !== String(updated.sale_id ?? "").trim() ||
    Number(existing.apartment_id || 0) !== Number(updated.apartment_id || 0) ||
    Number(existing.customer_id || 0) !== Number(updated.customer_id || 0) ||
    Number(existing.sale_date || 0) !== Number(updated.sale_date || 0) ||
    Number(existing.total_price || 0) !== Number(updated.total_price || 0) ||
    Number(existing.discount || 0) !== Number(updated.discount || 0) ||
    String(existing.payment_type ?? "") !== String(updated.payment_type ?? "") ||
    String(existing.frequency_type ?? "") !== String(updated.frequency_type ?? "") ||
    Number(existing.interval_count || 0) !== Number(updated.interval_count || 0) ||
    Number(existing.installment_count || 0) !== Number(updated.installment_count || 0) ||
    Number(existing.first_due_date || 0) !== Number(updated.first_due_date || 0) ||
    !isEquivalentCustomDates(existing.custom_dates, updated.custom_dates) ||
    Boolean(existing.schedule_locked) !== Boolean(updated.schedule_locked) ||
    Number(existing.net_price || 0) !== Number(updated.net_price || 0)
  );
}

function validateApartmentSale(row: ApartmentSaleRow): void {

  
  if (row.apartment_id <= 0) throw new Error("Apartment is required.");
  if (row.customer_id <= 0) throw new Error("Customer is required.");
  if (row.total_price <= 0) throw new Error("Total price must be greater than 0.");
  if (row.discount < 0) throw new Error("Discount cannot be negative.");
  if (row.discount > row.total_price) throw new Error("Discount cannot exceed total price.");
  if (row.payment_type === "installment") {
    const frequency = normalizeFrequency(row.frequency_type);
    if (frequency === "custom_dates") {
      const customDates = row.custom_dates ?? [];
      if (!customDates.length) throw new Error("At least one custom installment date is required.");
      const badRow = customDates.find((item) => item.installment_no <= 0 || item.amount <= 0 || !item.due_date);
      if (badRow) throw new Error("Custom installment dates must include due date and positive amount.");
    } else {
      if (!row.installment_count || row.installment_count <= 0) {
        throw new Error("Installment count must be greater than 0.");
      }
      if (!row.first_due_date || row.first_due_date <= 0) {
        throw new Error("First due date is required for installment plans.");
      }
    }
  }
}

async function assertNoDuplicateSale(row: ApartmentSaleRow, ignoreUuid?: string): Promise<void> {
  const nonBlockingStatuses = new Set(["cancelled", "terminated", "defaulted"]);
  const duplicate = await db.apartment_sales
    .filter(
      (item) =>
        item.uuid !== ignoreUuid &&
        Number(item.customer_id) === Number(row.customer_id) &&
        Number(item.apartment_id) === Number(row.apartment_id) &&
        !nonBlockingStatuses.has(String(item.status ?? "").trim().toLowerCase())
    )
    .first();

  if (duplicate) {
    throw new Error("This customer already has a sale for the selected apartment.");
  }
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
    .filter((i) => i.entity === "apartment_sales" && i.action === action)
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

function matchesSearch(row: ApartmentSaleRow, q: string): boolean {
  return [
    row.uuid,
    row.sale_id,
    row.sale_date,
    row.total_price,
    row.discount,
    row.payment_type,
    row.customer_id,
    row.apartment_id,
    row.status,
    row.deed_status,
    row.frequency_type,
    row.installment_count,
    row.actual_net_revenue,
  ].some((v) => String(v ?? "").toLowerCase().includes(q));
}

function parseApartmentSalesPayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
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

function toApiPayload(row: ApartmentSaleRow): Obj {
  const paymentType = String(row.payment_type ?? "").trim().toLowerCase() === "installment" ? "installment" : "full";
  const payload: Obj = {
    uuid: row.uuid,
    sale_id: String(row.sale_id ?? "").trim() || undefined,
    sale_date: toIsoDate(row.sale_date),
    total_price: row.total_price,
    discount: row.discount,
    payment_type: paymentType,
    customer_id: row.customer_id,
    apartment_id: row.apartment_id,
    status: row.status,
    updated_at: row.updated_at,
  };

  if (paymentType === "installment") {
    const frequencyType = normalizeFrequency(row.frequency_type);
    payload.frequency_type = frequencyType;
    payload.interval_count = Math.max(1, Number(row.interval_count ?? 1) || 1);
    payload.installment_count = Math.max(0, Number(row.installment_count ?? 0) || 0);
    payload.first_due_date = toIsoDate(row.first_due_date ?? row.sale_date);
    if (frequencyType === "custom_dates") {
      payload.custom_dates = (row.custom_dates ?? []).map((item, idx) => ({
        installment_no: Number(item.installment_no) > 0 ? Number(item.installment_no) : idx + 1,
        due_date: toIsoDate(item.due_date),
        amount: Number(item.amount) > 0 ? Number(item.amount) : 0,
      }));
    }
  }

  payload.schedule_locked = Boolean(row.schedule_locked);
  if (row.schedule_locked_at) payload.schedule_locked_at = new Date(row.schedule_locked_at).toISOString();
  if (row.approved_at) payload.approved_at = new Date(row.approved_at).toISOString();
  if (row.deed_status) payload.deed_status = row.deed_status;
  if (row.deed_issued_at) payload.deed_issued_at = new Date(row.deed_issued_at).toISOString();
  if (typeof row.deed_issued_by === "number" && Number.isFinite(row.deed_issued_by) && row.deed_issued_by > 0) {
    payload.deed_issued_by = Math.trunc(row.deed_issued_by);
  }
  if (row.key_handover_status) payload.key_handover_status = row.key_handover_status;
  if (row.key_handover_at) payload.key_handover_at = new Date(row.key_handover_at).toISOString();
  if (typeof row.key_handover_by === "number" && Number.isFinite(row.key_handover_by) && row.key_handover_by > 0) {
    payload.key_handover_by = Math.trunc(row.key_handover_by);
  }
  if (row.possession_start_date) payload.possession_start_date = toIsoDate(row.possession_start_date);
  if (row.vacated_at) payload.vacated_at = toIsoDate(row.vacated_at);
  if (row.key_returned_at) payload.key_returned_at = new Date(row.key_returned_at).toISOString();
  if (typeof row.key_returned_by === "number" && Number.isFinite(row.key_returned_by) && row.key_returned_by > 0) {
    payload.key_returned_by = Math.trunc(row.key_returned_by);
  }
  if (typeof row.termination_reason === "string" && row.termination_reason.trim()) {
    payload.termination_reason = row.termination_reason.trim();
  }
  if (typeof row.termination_charge === "number" && Number.isFinite(row.termination_charge)) {
    payload.termination_charge = row.termination_charge;
  }
  if (typeof row.refund_amount === "number" && Number.isFinite(row.refund_amount)) {
    payload.refund_amount = row.refund_amount;
  }
  if (
    typeof row.remaining_debt_after_termination === "number" &&
    Number.isFinite(row.remaining_debt_after_termination)
  ) {
    payload.remaining_debt_after_termination = row.remaining_debt_after_termination;
  }
  if (typeof row.net_price === "number" && Number.isFinite(row.net_price)) payload.net_price = row.net_price;

  return payload;
}

export async function apartmentSaleListLocal(query: ApartmentSaleLocalQuery = {}): Promise<ApartmentSaleLocalPage> {
  await apartmentSaleRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();

  if (!q) {
    const total = await db.apartment_sales.count();
    const items = await db.apartment_sales.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const cursor = db.apartment_sales.orderBy("updated_at").reverse().filter((row) => matchesSearch(row, q));
  const total = await cursor.count();
  const items = await cursor.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function apartmentSaleGetLocal(uuid: string): Promise<ApartmentSaleRow | undefined> {
  const normalized = uuid.trim();
  if (!normalized) return undefined;
  return db.apartment_sales.get(normalized);
}

export async function apartmentSalePullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = typeof window === "undefined" ? null : window.localStorage.getItem(CURSOR_KEY);
  const localCount = await db.apartment_sales.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince && typeof window !== "undefined") {
    window.localStorage.removeItem(CURSOR_KEY);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = new Date().toISOString();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/apartment-sales", { params });
    const parsed = parseApartmentSalesPayload(res.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(asObj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      const uniqueDeletedUuids = [...new Set(deletedUuids)];
      await db.apartment_sales.bulkDelete(uniqueDeletedUuids);
      await db.installments.where("sale_uuid").anyOf(uniqueDeletedUuids).delete();
      await db.apartment_sale_financials.where("sale_uuid").anyOf(uniqueDeletedUuids).delete();
      await removeQueuedOpsForEntityUuids("apartment_sales", deletedUuids);
      await removeQueuedOpsForEntityUuids("apartment_sale_financials", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeApartmentSale)
      .filter((r) => r.uuid);

    if (rows.length) {
      await db.apartment_sales.bulkPut(rows);
      const financialRows = parsed.list
        .filter((item) => !isDeletedRecord(item))
        .map((item) => {
          const root = asObj(item);
          const saleUuid = String(root.uuid ?? "");
          const financialRaw = asObj(root.financial);
          if (!saleUuid || Object.keys(financialRaw).length === 0) return null;

          return sanitizeApartmentSaleFinancial({
            ...financialRaw,
            sale_uuid: saleUuid,
            uuid: String(financialRaw.uuid ?? saleUuid),
            apartment_sale_id: financialRaw.apartment_sale_id ?? root.id,
          });
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row?.sale_uuid));

      if (financialRows.length) {
        await db.apartment_sale_financials.bulkPut(financialRows);
      } else {
        await Promise.all(rows.map((row) => apartmentSaleFinancialUpsertForSale(row, { queue: false })));
      }
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(CURSOR_KEY, serverTime);
  }
  await apartmentSaleRetentionCleanupIfDue();
  return { pulled };
}

export async function apartmentSaleCreate(payload: unknown): Promise<ApartmentSaleRow> {
  const sourcePayload = asObj(payload);
  const uuid = crypto.randomUUID();
  const row = sanitizeApartmentSale({ ...sourcePayload, uuid, updated_at: Date.now() });
  const receiveFullPaymentNow = Boolean(sourcePayload.receive_full_payment_now);

  validateApartmentSale(row);
  await assertNoDuplicateSale(row);

  if (receiveFullPaymentNow) {
    throw new Error("Apartment sale approval is required before receiving full payment.");
  }

  if (!isOnline()) {
    await db.apartment_sales.put(row);
    await apartmentSaleFinancialUpsertForSale(row, { queue: false });
    await enqueueSync({
      entity: "apartment_sales",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toApiPayload(row),
    });
    notifySuccess("Apartment sale saved offline. It will sync when online.");
    return row;
  }

  try {
    const apiPayload: Obj = {
      ...toApiPayload(row),
    };
    const res = await api.post("/api/apartment-sales", apiPayload);
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? row);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? row : parsed;
    await db.apartment_sales.put(saved);
    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    } else {
      await apartmentSaleFinancialUpsertForSale(saved, { queue: false });
    }
    notifySuccess("Apartment sale created and sent for admin approval.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.apartment_sales.delete(uuid);
      await removeLatestQueueItem(uuid, "create");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    await db.apartment_sales.put(row);
    await apartmentSaleFinancialUpsertForSale(row, { queue: false });
    await enqueueSync({
      entity: "apartment_sales",
      uuid,
      localKey: uuid,
      action: "create",
      payload: toApiPayload(row),
    });
    notifyInfo("Apartment sale saved locally. Server sync will retry later.");
    return row;
  }
}

export async function apartmentSaleUpdate(uuid: string, patch: unknown): Promise<ApartmentSaleRow> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  const editScope = await resolveLocalEditScope(existing);
  if (editScope === "none") {
    throw new Error("Completed or cancelled sales cannot be updated.");
  }

  const updated = sanitizeApartmentSale({ ...existing, ...asObj(patch), uuid, updated_at: Date.now() });
  validateApartmentSale(updated);
  await assertNoDuplicateSale(updated, uuid);

  if (editScope === "limited" && hasRestrictedSaleChanges(existing, updated)) {
    throw new Error("Only status update is allowed after approval or when payments exist.");
  }

  await db.apartment_sales.put(updated);
  await apartmentSaleFinancialUpsertForSale(updated, { queue: false });
  await enqueueSync({
    entity: "apartment_sales",
    uuid,
    localKey: uuid,
    action: "update",
    payload: toApiPayload(updated),
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Apartment sale updated offline. It will sync when online.");
    return updated;
  }

  try {
    const res = await api.put(`/api/apartment-sales/${uuid}`, toApiPayload(updated));
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? updated);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? updated : parsed;
    await db.apartment_sales.put(saved);
    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    } else {
      await apartmentSaleFinancialUpsertForSale(saved, { queue: false });
    }
    notifySuccess("Apartment sale updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.apartment_sales.put(existing);
      await apartmentSaleFinancialUpsertForSale(existing, { queue: false });
      await removeLatestQueueItem(uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }
    notifyInfo("Apartment sale updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function apartmentSaleDelete(uuid: string): Promise<void> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  const canDelete = await canDeleteLocalSale(existing);
  if (!canDelete) {
    throw new Error("Sale can only be deleted when it has no recorded payments and no closed workflow history.");
  }

  await db.apartment_sales.delete(uuid);
  await db.installments.where("sale_uuid").equals(uuid).delete();
  if (typeof existing.id === "number" && existing.id > 0) {
    await db.installments.where("apartment_sale_id").equals(existing.id).delete();
  }
  await apartmentSaleFinancialDeleteBySaleUuid(uuid, { queue: false });
  await enqueueSync({
    entity: "apartment_sales",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    emitAppEvent("installments:changed", { saleUuid: uuid });
    notifySuccess("Apartment sale deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/apartment-sales/${uuid}`);
    await Promise.all([apartmentsPullToLocal(), apartmentSalePullToLocal()]);
    emitAppEvent("installments:changed", { saleUuid: uuid });
    notifySuccess("Apartment sale deleted successfully.");
  } catch {
    notifyInfo("Apartment sale deleted locally. Server sync will retry later.");
  }
}

export async function apartmentSaleIssueDeed(uuid: string): Promise<ApartmentSaleRow> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  if (!isOnline()) {
    throw new Error("Deed issuance requires internet connection.");
  }

  try {
    const res = await api.post(`/api/apartment-sales/${uuid}/issue-deed`);
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? existing);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? existing : parsed;
    await db.apartment_sales.put(saved);

    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    }

    notifySuccess("Ownership deed issued successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function apartmentSaleApprove(uuid: string): Promise<ApartmentSaleRow> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  if (!isOnline()) {
    throw new Error("Sale approval requires internet connection.");
  }

  try {
    const res = await api.post(`/api/apartment-sales/${uuid}/approve`);
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? existing);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? existing : parsed;
    await db.apartment_sales.put(saved);

    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    } else {
      await apartmentSaleFinancialUpsertForSale(saved, { queue: false });
    }

    try {
      await apartmentSalePullToLocal();
    } catch {
      // Keep the approved sale locally even if follow-up refresh fails.
    }
    emitAppEvent("notifications:changed");
    notifySuccess("Apartment sale approved successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function apartmentSaleReject(uuid: string): Promise<ApartmentSaleRow> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  if (!isOnline()) {
    throw new Error("Sale rejection requires internet connection.");
  }

  try {
    const res = await api.post(`/api/apartment-sales/${uuid}/reject`);
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? existing);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? existing : parsed;
    await db.apartment_sales.put(saved);

    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    } else {
      await apartmentSaleFinancialUpsertForSale(saved, { queue: false });
    }

    try {
      await Promise.all([apartmentSalePullToLocal(), installmentsPullToLocal(), apartmentsPullToLocal()]);
    } catch {
      // Reject already succeeded on server; keep the saved local state and let later sync refresh the rest.
    }
    emitAppEvent("notifications:changed");
    emitAppEvent("installments:changed", { saleUuid: saved.uuid });
    notifySuccess("Apartment sale rejected and cancelled successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function apartmentSaleHandoverKey(uuid: string): Promise<ApartmentSaleRow> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  if (!isOnline()) {
    throw new Error("Key handover requires internet connection.");
  }

  try {
    const res = await api.post(`/api/apartment-sales/${uuid}/handover-key`);
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? existing);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? existing : parsed;
    await db.apartment_sales.put(saved);

    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    }

    notifySuccess("Apartment key handed over successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export type ApartmentSaleTerminateInput = {
  reason: string;
  status?: "terminated" | "defaulted";
  vacated_at?: string;
  termination_charge?: number;
};

export async function apartmentSaleTerminate(
  uuid: string,
  input: ApartmentSaleTerminateInput
): Promise<ApartmentSaleRow> {
  const existing = await db.apartment_sales.get(uuid);
  if (!existing) throw new Error("Apartment sale not found locally");

  if (!isOnline()) {
    throw new Error("Sale termination requires internet connection.");
  }

  try {
    const res = await api.post(`/api/apartment-sales/${uuid}/terminate`, input);
    const responseData = asObj(res.data).data;
    const parsed = sanitizeApartmentSale(responseData ?? existing);
    const saved = !parsed.uuid || parsed.customer_id <= 0 || parsed.apartment_id <= 0 ? existing : parsed;
    await db.apartment_sales.put(saved);

    const financialRaw = asObj(asObj(responseData).financial);
    if (Object.keys(financialRaw).length > 0) {
      const financial = sanitizeApartmentSaleFinancial({
        ...financialRaw,
        sale_uuid: saved.uuid,
        uuid: String(financialRaw.uuid ?? saved.uuid),
        apartment_sale_id: financialRaw.apartment_sale_id ?? saved.id,
      });
      await db.apartment_sale_financials.put(financial);
    }

    notifySuccess("Sale termination processed successfully.");
    return saved;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

async function apartmentSaleRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("apartment_sales", RETENTION_DAYS);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("apartment_sales").toArray();
  const locked = new Set(pending.map((i) => i.uuid));

  const oldRows = await db.apartment_sales.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((r) => !locked.has(r.uuid)).map((r) => r.uuid);
  if (removable.length) await db.apartment_sales.bulkDelete(removable);
  return removable.length;
}

export async function apartmentSaleRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRaw = typeof window === "undefined" ? null : window.localStorage.getItem(CLEANUP_KEY);
  const lastNum = lastRaw === null ? null : Number(lastRaw);
  const last = lastNum !== null && Number.isFinite(lastNum) ? lastNum : null;
  if (last !== null && now - last < CLEANUP_INTERVAL_MS) return 0;

  const removed = await apartmentSaleRetentionCleanup();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLEANUP_KEY, String(now));
  }
  return removed;
}
