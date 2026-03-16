import { db, type ApartmentRentalRow, type RentalPaymentRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { emitAppEvent } from "@/lib/appEvents";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const CURSOR_KEY = "rentals_sync_cursor";

type Obj = Record<string, unknown>;

export type RentalsLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
};

export type RentalsLocalPage = {
  items: ApartmentRentalRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type RentalPaymentsLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  paymentType?: "advance" | "monthly" | "late_fee" | "adjustment";
};

export type RentalPaymentsLocalPage = {
  items: RentalPaymentRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type RentalCreateInput = {
  apartment_id: number;
  tenant_id: number;
  contract_start: string;
  contract_end?: string;
  monthly_rent: number;
  advance_months: number;
  initial_advance_paid?: number;
  initial_payment_method?: string;
  notes?: string;
};

export type RentalUpdateInput = Partial<
  Pick<RentalCreateInput, "contract_start" | "contract_end" | "monthly_rent" | "advance_months">
> & {
  status?: "draft" | "advance_pending" | "active" | "completed" | "terminated" | "defaulted" | "cancelled";
};

export type RentalPaymentInput = {
  payment_type: "advance" | "monthly" | "late_fee" | "adjustment";
  amount: number;
  amount_due?: number;
  due_date?: string;
  payment_date?: string;
  period_month?: string;
  payment_method?: string;
  reference_no?: string;
  notes?: string;
};

export type RentalBillInput = {
  payment_type?: "advance" | "monthly" | "late_fee" | "adjustment";
  amount_due: number;
  due_date: string;
  period_month?: string;
  notes?: string;
};

export type RentalFinanceApproveInput = {
  amount: number;
  payment_date?: string;
  payment_method?: string;
  reference_no?: string;
  notes?: string;
};

export type RentalCloseInput = {
  status: "completed" | "terminated" | "defaulted" | "cancelled";
  termination_reason?: string;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const nowIso = () => new Date().toISOString();

function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const parsed = Date.parse(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

function toMoney(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : Number(n.toFixed(2));
}

function normalizeStatus(v: unknown): string {
  const status = String(v ?? "").trim().toLowerCase();
  if (["draft", "advance_pending", "active", "completed", "terminated", "defaulted", "cancelled"].includes(status)) {
    return status;
  }
  return "draft";
}

function normalizeAdvanceStatus(v: unknown): string {
  const status = String(v ?? "").trim().toLowerCase();
  if (status === "partial" || status === "completed") return status;
  return "pending";
}

function normalizeKeyStatus(v: unknown): string {
  const status = String(v ?? "").trim().toLowerCase();
  if (status === "handed_over" || status === "returned") return status;
  return "not_handed_over";
}

function sanitizeRental(input: unknown): ApartmentRentalRow {
  const r = asObj(input);
  const apartment = asObj(r.apartment);
  const tenant = asObj(r.tenant);
  const id = Number(r.id);
  const advanceRemaining = toMoney(r.advance_remaining_amount);
  const normalizedStatus = normalizeStatus(r.status);
  const status =
    advanceRemaining <= 0 && !["completed", "terminated", "defaulted", "cancelled"].includes(normalizedStatus)
      ? "active"
      : normalizedStatus;

  return {
    id: Number.isFinite(id) && id > 0 ? Math.trunc(id) : undefined,
    uuid: String(r.uuid ?? ""),
    rental_id: String(r.rental_id ?? ""),
    apartment_id: toInt(r.apartment_id),
    tenant_id: toInt(r.tenant_id),
    created_by: r.created_by == null ? null : toInt(r.created_by),
    contract_start: toTs(r.contract_start),
    contract_end: r.contract_end ? toTs(r.contract_end) : null,
    monthly_rent: toMoney(r.monthly_rent),
    advance_months: Math.max(1, toInt(r.advance_months || 3, 3)),
    advance_required_amount: toMoney(r.advance_required_amount),
    advance_paid_amount: toMoney(r.advance_paid_amount),
    advance_remaining_amount: advanceRemaining,
    total_paid_amount: toMoney(r.total_paid_amount),
    advance_status: normalizeAdvanceStatus(r.advance_status),
    next_due_date: r.next_due_date ? toTs(r.next_due_date) : null,
    status,
    key_handover_status: normalizeKeyStatus(r.key_handover_status),
    key_handover_at: r.key_handover_at ? toTs(r.key_handover_at) : null,
    key_handover_by: r.key_handover_by == null ? null : toInt(r.key_handover_by),
    key_returned_at: r.key_returned_at ? toTs(r.key_returned_at) : null,
    key_returned_by: r.key_returned_by == null ? null : toInt(r.key_returned_by),
    termination_reason: String(r.termination_reason ?? "").trim() || null,
    terminated_at: r.terminated_at ? toTs(r.terminated_at) : null,
    apartment_code: String(apartment.apartment_code ?? "").trim() || null,
    apartment_unit: String(apartment.unit_number ?? "").trim() || null,
    tenant_name: String(tenant.name ?? "").trim() || null,
    tenant_phone: String(tenant.phone ?? "").trim() || null,
    tenant_email: String(tenant.email ?? "").trim() || null,
    updated_at: toTs(r.updated_at),
    created_at: toTs(r.created_at ?? r.updated_at),
  };
}

function sanitizeRentalPayment(input: unknown): RentalPaymentRow {
  const r = asObj(input);
  const id = Number(r.id);
  return {
    id: Number.isFinite(id) && id > 0 ? Math.trunc(id) : undefined,
    uuid: String(r.uuid ?? ""),
    bill_no: String(r.bill_no ?? "").trim() || null,
    bill_generated_at: r.bill_generated_at ? toTs(r.bill_generated_at) : null,
    rental_id: toInt(r.rental_id),
    rental_uuid: String(r.rental_uuid ?? "").trim() || null,
    rental_code: String(r.rental_code ?? "").trim() || null,
    tenant_id: r.tenant_id == null ? null : toInt(r.tenant_id),
    tenant_name: String(r.tenant_name ?? "").trim() || null,
    tenant_phone: String(r.tenant_phone ?? "").trim() || null,
    apartment_id: r.apartment_id == null ? null : toInt(r.apartment_id),
    apartment_code: String(r.apartment_code ?? "").trim() || null,
    period_month: String(r.period_month ?? "").trim() || null,
    due_date: r.due_date ? toTs(r.due_date) : null,
    payment_type: String(r.payment_type ?? "monthly").trim().toLowerCase(),
    amount_due: toMoney(r.amount_due),
    amount_paid: toMoney(r.amount_paid),
    remaining_amount: toMoney(r.remaining_amount),
    paid_date: r.paid_date ? toTs(r.paid_date) : null,
    status: String(r.status ?? "pending").trim().toLowerCase(),
    notes: String(r.notes ?? "").trim() || null,
    approved_by: r.approved_by == null ? null : toInt(r.approved_by),
    approved_at: r.approved_at ? toTs(r.approved_at) : null,
    approved_by_name: String(r.approved_by_name ?? "").trim() || null,
    updated_at: toTs(r.updated_at),
    created_at: toTs(r.created_at ?? r.updated_at),
  };
}

function parsePayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
  if (Array.isArray(payload)) {
    return { list: payload.map(asObj), hasMore: false, serverTime: nowIso() };
  }

  const root = asObj(payload);
  const meta = asObj(root.meta);
  const topData = root.data;

  if (Array.isArray(topData)) {
    return {
      list: topData.map(asObj),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? nowIso()),
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
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  return { list: [], hasMore: false, serverTime: nowIso() };
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
  return "Request failed.";
}

function emitRentalsChanged(rentalUuid?: string): void {
  emitAppEvent("rentals:changed", { rentalUuid: rentalUuid ?? null });
}

function getLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function setLs(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function removeLs(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function matchesSearch(row: ApartmentRentalRow, q: string): boolean {
  return [
    row.rental_id,
    row.status,
    row.apartment_code,
    row.apartment_unit,
    row.tenant_name,
    row.tenant_phone,
    row.tenant_email,
    row.contract_start,
    row.contract_end,
    row.monthly_rent,
    row.advance_months,
  ].some((value) => String(value ?? "").toLowerCase().includes(q));
}

function createPayload(input: RentalCreateInput): Obj {
  return {
    apartment_id: Math.trunc(input.apartment_id),
    tenant_id: Math.trunc(input.tenant_id),
    contract_start: input.contract_start,
    contract_end: input.contract_end || null,
    monthly_rent: toMoney(input.monthly_rent),
    advance_months: Math.max(1, Math.min(12, Math.trunc(input.advance_months || 3))),
    initial_advance_paid: toMoney(input.initial_advance_paid ?? 0),
    initial_payment_method: (input.initial_payment_method ?? "cash").trim() || "cash",
    notes: (input.notes ?? "").trim() || null,
  };
}

export async function rentalsListLocal(query: RentalsLocalQuery = {}): Promise<RentalsLocalPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();
  const statusFilter = (query.status ?? "").trim().toLowerCase();

  let rows = await db.rentals.orderBy("updated_at").reverse().toArray();
  rows = rows.map((row) => {
    const status = String(row.status ?? "").trim().toLowerCase();
    const isClosed = ["completed", "terminated", "defaulted", "cancelled"].includes(status);
    if (!isClosed && Number(row.advance_remaining_amount ?? 0) <= 0) {
      return { ...row, status: "active" };
    }
    return row;
  });
  if (statusFilter) rows = rows.filter((row) => String(row.status ?? "").toLowerCase() === statusFilter);
  if (q) rows = rows.filter((row) => matchesSearch(row, q));

  const total = rows.length;
  const items = rows.slice(offset, offset + pageSize);
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function rentalsPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = getLs(CURSOR_KEY);
  const localCount = await db.rentals.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    // Recover from stale cursor after local DB clear/version change.
    removeLs(CURSOR_KEY);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const res = await api.get("/api/rentals", { params });
    const parsed = parsePayload(res.data);
    const rows = parsed.list.map(sanitizeRental).filter((r) => r.uuid);

    if (rows.length) {
      await db.rentals.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  setLs(CURSOR_KEY, serverTime);
  return { pulled };
}

export async function rentalPaymentsPullToLocal(
  input: { paymentType?: "advance" | "monthly" | "late_fee" | "adjustment" } = {}
): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  let page = 1;
  let pulled = 0;
  while (true) {
    const params: Record<string, string | number> = { page, per_page: PULL_PAGE_SIZE };
    if (input.paymentType) params.payment_type = input.paymentType;

    const res = await api.get("/api/rental-payments", { params });
    const parsed = parsePayload(res.data);
    const rows = parsed.list.map(sanitizeRentalPayment).filter((r) => r.uuid);
    if (rows.length) {
      await db.rental_payments.bulkPut(rows);
      pulled += rows.length;
    }
    if (!parsed.hasMore) break;
    page += 1;
  }

  return { pulled };
}

export async function rentalCreate(input: RentalCreateInput): Promise<ApartmentRentalRow> {
  if (!isOnline()) {
    throw new Error("Rental creation requires internet connection.");
  }

  try {
    const res = await api.post("/api/rentals", createPayload(input));
    const row = sanitizeRental(asObj(res.data).data);
    await db.rentals.put(row);
    notifySuccess("Rental contract created.");
    emitRentalsChanged(row.uuid);
    return row;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalUpdate(uuid: string, input: RentalUpdateInput): Promise<ApartmentRentalRow> {
  if (!isOnline()) {
    throw new Error("Rental update requires internet connection.");
  }

  try {
    const res = await api.put(`/api/rentals/${uuid}`, input);
    const row = sanitizeRental(asObj(res.data).data);
    await db.rentals.put(row);
    notifySuccess("Rental contract updated.");
    emitRentalsChanged(row.uuid);
    return row;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalDelete(uuid: string): Promise<void> {
  if (!isOnline()) {
    throw new Error("Rental delete requires internet connection.");
  }

  try {
    await api.delete(`/api/rentals/${uuid}`);
    await db.rentals.delete(uuid);
    notifySuccess("Rental deleted.");
    emitRentalsChanged(uuid);
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalAddPayment(uuid: string, input: RentalPaymentInput): Promise<ApartmentRentalRow> {
  if (!isOnline()) {
    throw new Error("Payment requires internet connection.");
  }

  try {
    const payload: Obj = {
      payment_type: input.payment_type,
      amount: toMoney(input.amount),
      amount_due: input.amount_due == null ? undefined : toMoney(input.amount_due),
      due_date: input.due_date || undefined,
      payment_date: input.payment_date || undefined,
      period_month: (input.period_month ?? "").trim() || undefined,
      payment_method: (input.payment_method ?? "cash").trim() || "cash",
      reference_no: (input.reference_no ?? "").trim() || undefined,
      notes: (input.notes ?? "").trim() || undefined,
    };

    const res = await api.post(`/api/rentals/${uuid}/payments`, payload);
    const data = asObj(res.data).data;
    const rental = sanitizeRental(asObj(data).rental ?? {});
    const paymentRaw = asObj(data).payment;
    if (paymentRaw && typeof paymentRaw === "object") {
      const payment = sanitizeRentalPayment({
        ...paymentRaw,
        rental_uuid: rental.uuid,
        rental_code: rental.rental_id,
        tenant_id: rental.tenant_id,
        tenant_name: rental.tenant_name,
        tenant_phone: rental.tenant_phone,
        apartment_id: rental.apartment_id,
        apartment_code: rental.apartment_code,
      });
      if (payment.uuid) {
        await db.rental_payments.put(payment);
      }
    }

    await db.rentals.put(rental);
    notifySuccess("Rental payment saved.");
    emitRentalsChanged(rental.uuid);
    return rental;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalGenerateBill(
  rentalUuid: string,
  input: RentalBillInput
): Promise<{ rental: ApartmentRentalRow; payment: RentalPaymentRow }> {
  if (!isOnline()) {
    throw new Error("Bill generation requires internet connection.");
  }

  try {
    const payload: Obj = {
      payment_type: input.payment_type ?? "monthly",
      amount_due: toMoney(input.amount_due),
      due_date: input.due_date,
      period_month: (input.period_month ?? "").trim() || undefined,
      notes: (input.notes ?? "").trim() || undefined,
    };
    const res = await api.post(`/api/rentals/${rentalUuid}/bills`, payload);
    const data = asObj(res.data).data;
    const rental = sanitizeRental(asObj(data).rental ?? {});
    const payment = sanitizeRentalPayment(asObj(data).payment ?? {});

    if (rental.uuid) {
      await db.rentals.put(rental);
    }
    if (payment.uuid) {
      await db.rental_payments.put(payment);
    }

    notifySuccess("Bill generated successfully.");
    emitRentalsChanged(rental.uuid || rentalUuid);
    return { rental, payment };
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalApprovePayment(
  paymentUuid: string,
  input: RentalFinanceApproveInput
): Promise<{ rental: ApartmentRentalRow; payment: RentalPaymentRow }> {
  if (!isOnline()) {
    throw new Error("Finance approval requires internet connection.");
  }

  try {
    const payload: Obj = {
      amount: toMoney(input.amount),
      payment_date: input.payment_date || undefined,
      payment_method: (input.payment_method ?? "cash").trim() || "cash",
      reference_no: (input.reference_no ?? "").trim() || undefined,
      notes: (input.notes ?? "").trim() || undefined,
    };
    const res = await api.post(`/api/rental-payments/${paymentUuid}/approve`, payload);
    const data = asObj(res.data).data;
    const rental = sanitizeRental(asObj(data).rental ?? {});
    const payment = sanitizeRentalPayment(asObj(data).payment ?? {});

    if (rental.uuid) {
      await db.rentals.put(rental);
    }
    if (payment.uuid) {
      await db.rental_payments.put(payment);
    }

    notifySuccess("Payment approved by finance.");
    emitRentalsChanged(rental.uuid);
    return { rental, payment };
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalHandoverKey(uuid: string): Promise<ApartmentRentalRow> {
  if (!isOnline()) {
    throw new Error("Key handover requires internet connection.");
  }

  try {
    const res = await api.post(`/api/rentals/${uuid}/handover-key`);
    const row = sanitizeRental(asObj(res.data).data);
    await db.rentals.put(row);
    notifySuccess("Key handover completed.");
    emitRentalsChanged(row.uuid);
    return row;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

export async function rentalClose(uuid: string, input: RentalCloseInput): Promise<ApartmentRentalRow> {
  if (!isOnline()) {
    throw new Error("Close rental requires internet connection.");
  }

  try {
    const res = await api.post(`/api/rentals/${uuid}/close`, input);
    const row = sanitizeRental(asObj(res.data).data);
    await db.rentals.put(row);
    notifyInfo("Rental contract closed.");
    emitRentalsChanged(row.uuid);
    return row;
  } catch (error: unknown) {
    const message = getApiErrorMessage(error);
    notifyError(message);
    throw new Error(message);
  }
}

function matchesPaymentSearch(row: RentalPaymentRow, q: string): boolean {
  return [
    row.rental_code,
    row.tenant_name,
    row.tenant_phone,
    row.apartment_code,
    row.period_month,
    row.payment_type,
    row.status,
    row.amount_due,
    row.amount_paid,
    row.remaining_amount,
  ].some((value) => String(value ?? "").toLowerCase().includes(q));
}

export async function rentalPaymentsListLocal(query: RentalPaymentsLocalQuery = {}): Promise<RentalPaymentsLocalPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const q = (query.q ?? "").trim().toLowerCase();
  const paymentType = (query.paymentType ?? "").trim().toLowerCase();

  let rows = await db.rental_payments.orderBy("updated_at").reverse().toArray();
  if (paymentType) {
    rows = rows.filter((row) => String(row.payment_type ?? "").toLowerCase() === paymentType);
  }
  if (q) {
    rows = rows.filter((row) => matchesPaymentSearch(row, q));
  }

  const total = rows.length;
  const items = rows.slice(offset, offset + pageSize);
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}
