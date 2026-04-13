import type { ApartmentSaleRow } from "@/db/localDB";
import {
  statusFromPaymentType,
  type ApartmentSaleCustomDate,
  type ApartmentSaleFormData,
  type InstallmentFrequency,
  type SaleStatus,
} from "@/components/apartment-sales/apartment-sale.type";

export const LOCAL_LIST_PAGE_SIZE = 200;
export const TABLE_PAGE_SIZE = 10;
export const LOOKUP_PAGE_SIZE = 100;
export const TERMINATED_SUGGESTED_CHARGE_RATE = 0;
export const DEFAULTED_MIN_CHARGE_RATE = 0.2;
export const DEFAULTED_SUGGESTED_CHARGE_RATE = 0.2;

/**
 * Converts unix ms date to YYYY-MM-DD input value.
 */
export const toDateInput = (v?: number): string => {
  if (!v || !Number.isFinite(v)) return new Date().toISOString().slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
};

/**
 * Normalizes a numeric value to money precision (2 decimals).
 */
export const toMoney2 = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

/**
 * Validates and normalizes sale status to supported values.
 */
export const normalizeStatus = (value: string | undefined): SaleStatus => {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "completed" || s === "cancelled" || s === "defaulted" || s === "terminated") return s;
  return "active";
};

/**
 * Validates and normalizes installment frequency.
 */
export const normalizeFrequency = (value: string | undefined): InstallmentFrequency => {
  const f = String(value ?? "").trim().toLowerCase();
  if (f === "weekly" || f === "quarterly" || f === "custom_dates") return f;
  return "monthly";
};

/**
 * Formats a number as USD currency.
 */
export const toCurrency = (value: number): string => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(safe);
};

/**
 * Formats unix ms into local date label.
 */
export const toDateLabel = (value?: number | null): string => {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
};

/**
 * Maps a persisted sale row to editable form values.
 */
export const toForm = (row: ApartmentSaleRow): ApartmentSaleFormData => ({
  customer_id: String(row.customer_id || ""),
  apartment_id: String(row.apartment_id || ""),
  sale_date: toDateInput(row.sale_date),
  total_price: String(row.total_price ?? ""),
  discount: String(row.discount ?? 0),
  payment_type: row.payment_type === "installment" ? "installment" : "full",
  status: normalizeStatus(row.status),
  frequency_type: normalizeFrequency(row.frequency_type),
  installment_count: row.installment_count ? String(row.installment_count) : "",
  first_due_date: toDateInput(row.first_due_date ?? row.sale_date),
  schedule_locked: Boolean(row.schedule_locked),
  custom_dates: (row.custom_dates ?? []).map((item, idx) => ({
    installment_no: item.installment_no || idx + 1,
    due_date: toDateInput(item.due_date),
    amount: String(item.amount ?? ""),
  })),
  receive_full_payment_now: false,
  payment_account_id: "",
  payment_date: toDateInput(row.sale_date),
  payment_method: "cash",
  payment_reference_no: "",
  payment_notes: "",
});

/**
 * Rebuilds custom installment rows with sequential installment numbers.
 */
export const normalizeCustomDates = (rows: ApartmentSaleCustomDate[]) =>
  rows.map((item, idx) => ({
    installment_no: idx + 1,
    due_date: item.due_date,
    amount: item.amount,
  }));

/**
 * Builds and validates API payload from sale form values.
 * Throws Error when a required business rule is violated.
 */
export const buildSalePayload = (form: ApartmentSaleFormData): Record<string, unknown> => {
  const apartmentId = Number(form.apartment_id);
  const customerId = Number(form.customer_id);
  const totalPrice = Number(form.total_price);
  const discount = Number(form.discount || 0);

  if (!Number.isFinite(apartmentId) || apartmentId <= 0) {
    throw new Error("Please select an apartment.");
  }
  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new Error("Please select a customer.");
  }
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error("Total price must be greater than 0.");
  }
  if (!Number.isFinite(discount) || discount < 0 || discount > totalPrice) {
    throw new Error("Discount must be between 0 and total price.");
  }

  const payload: Record<string, unknown> = {
    apartment_id: apartmentId,
    customer_id: customerId,
    sale_date: form.sale_date || new Date().toISOString().slice(0, 10),
    total_price: totalPrice,
    discount,
    payment_type: form.payment_type,
    status: statusFromPaymentType(form.payment_type),
    schedule_locked: form.schedule_locked,
  };

  if (form.payment_type === "full" && form.receive_full_payment_now) {
    const paymentAccountId = Number(form.payment_account_id);
    if (!Number.isFinite(paymentAccountId) || paymentAccountId <= 0) {
      throw new Error("Payment account is required when receiving full payment now.");
    }

    payload.receive_full_payment_now = true;
    payload.payment_account_id = Math.trunc(paymentAccountId);
    payload.payment_date = (form.payment_date || form.sale_date || new Date().toISOString().slice(0, 10)).trim();
    payload.payment_method = (form.payment_method || "cash").trim() || "cash";

    const referenceNo = form.payment_reference_no.trim();
    if (referenceNo) payload.payment_reference_no = referenceNo;
    const paymentNotes = form.payment_notes.trim();
    if (paymentNotes) payload.payment_notes = paymentNotes;
  }

  if (form.payment_type === "installment") {
    payload.frequency_type = normalizeFrequency(form.frequency_type);

    if (form.frequency_type === "custom_dates") {
      const customDates = normalizeCustomDates(form.custom_dates)
        .map((item, idx) => ({
          installment_no: idx + 1,
          due_date: item.due_date.trim(),
          amount: Number(item.amount),
        }))
        .filter((item) => item.due_date && Number.isFinite(item.amount) && item.amount > 0);

      if (!customDates.length) {
        throw new Error("Custom dates must include at least one valid installment row.");
      }

      payload.custom_dates = customDates;
      payload.installment_count = customDates.length;
    } else {
      const installmentCount = Number(form.installment_count);
      if (!Number.isFinite(installmentCount) || installmentCount <= 0) {
        throw new Error("Installment count must be greater than 0.");
      }
      if (!form.first_due_date.trim()) {
        throw new Error("First due date is required for installment plans.");
      }
      payload.installment_count = Math.trunc(installmentCount);
      payload.first_due_date = form.first_due_date.trim();
    }
  }

  return payload;
};

/**
 * Computes customer remaining amount by sale and installment totals.
 */
export const customerRemainingAmount = (
  row: ApartmentSaleRow,
  installmentPaidBySaleUuid?: ReadonlyMap<string, number>
): number => {
  const netRaw = row.net_price ?? Number(row.total_price) - Number(row.discount);
  const net = Number.isFinite(Number(netRaw)) ? Number(netRaw) : 0;
  const customerReceivable = toMoney2(net * 0.85);
  const status = String(row.status ?? "").trim().toLowerCase();

  if (status === "terminated" || status === "defaulted") {
    const debt = Number(row.remaining_debt_after_termination);
    return Number.isFinite(debt) ? Math.max(0, debt) : 0;
  }

  if (row.payment_type !== "installment" && Number(row.installments_count ?? 0) <= 0) {
    return status === "completed" ? 0 : Math.max(0, customerReceivable);
  }

  const paidFromMap = installmentPaidBySaleUuid?.get(row.uuid);
  const paid = typeof paidFromMap === "number" && Number.isFinite(paidFromMap)
    ? paidFromMap
    : Number.isFinite(Number(row.installments_paid_total))
      ? Number(row.installments_paid_total)
      : 0;

  return Math.max(0, customerReceivable - paid);
};

export type RowEditScope = "full" | "limited" | "none";

/**
 * Resolves how much of a sale record can be edited based on workflow state.
 */
export const resolveRowEditScope = (row: ApartmentSaleRow): RowEditScope => {
  if (row.deed_status === "issued") return "none";

  if (row.edit_scope === "full" || row.edit_scope === "limited" || row.edit_scope === "none") {
    return row.edit_scope;
  }

  const status = String(row.status ?? "").trim().toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "terminated" || status === "defaulted") return "none";
  if (status === "approved" || row.has_paid_installments) return "limited";
  return status === "active" || status === "pending" ? "full" : "none";
};

/**
 * Resolves whether a sale can be deleted without reopening edit permissions.
 * Cancelled sales are deletable only when no payment was recorded and no deed was issued.
 */
export const canDeleteRow = (row: ApartmentSaleRow): boolean => {
  if (typeof row.can_delete === "boolean") return row.can_delete;
  if (row.deed_status === "issued") return false;

  const status = String(row.status ?? "").trim().toLowerCase();
  const hasPaid = Boolean(row.has_paid_installments) || Number(row.installments_paid_total ?? 0) > 0;

  if (status === "cancelled") return !hasPaid;
  if (status === "completed" || status === "terminated" || status === "defaulted" || status === "approved") return false;
  return status === "active" || status === "pending";
};
