"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ApartmentRentalRow, RentalPaymentRow } from "@/db/localDB";
import { apartmentsListLocal, apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { customersListLocal, customersPullToLocal } from "@/modules/customers/customers.repo";
import {
  rentalClose,
  rentalCreate,
  rentalDelete,
  rentalGenerateBill,
  rentalHandoverKey,
  rentalPaymentsListLocal,
  rentalPaymentsPullToLocal,
  rentalsListLocal,
  rentalsPullToLocal,
  rentalUpdate,
  type RentalBillInput,
  type RentalCloseInput,
  type RentalCreateInput,
  type RentalUpdateInput,
} from "@/modules/rentals/rentals.repo";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError } from "@/lib/notify";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

type Option = {
  id: number;
  label: string;
  status?: string;
};

type RentalFormState = {
  apartment_id: string;
  tenant_id: string;
  contract_start: string;
  contract_end: string;
  monthly_rent: string;
  advance_months: string;
  initial_advance_paid: string;
  initial_payment_method: string;
  notes: string;
};

type BillFormState = {
  rental: ApartmentRentalRow | null;
  payment_type: "advance" | "monthly" | "late_fee" | "adjustment";
  amount_due: string;
  due_date: string;
  period_month: string;
  notes: string;
  submitting: boolean;
};

type CloseFormState = {
  rental: ApartmentRentalRow | null;
  status: "completed" | "terminated" | "defaulted" | "cancelled";
  termination_reason: string;
  submitting: boolean;
};

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;

const today = () => new Date().toISOString().slice(0, 10);

const money = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);

const toDateLabel = (value: number | null | undefined): string => {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
};

const toDateInput = (value: number | null | undefined): string => {
  if (!value || !Number.isFinite(value)) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const statusColor: Record<string, "blue" | "emerald" | "amber" | "red" | "purple"> = {
  draft: "blue",
  advance_pending: "amber",
  active: "emerald",
  completed: "emerald",
  terminated: "purple",
  defaulted: "red",
  cancelled: "red",
};

const emptyRentalForm = (): RentalFormState => ({
  apartment_id: "",
  tenant_id: "",
  contract_start: today(),
  contract_end: "",
  monthly_rent: "",
  advance_months: "3",
  initial_advance_paid: "0",
  initial_payment_method: "cash",
  notes: "",
});

const emptyBillForm = (): BillFormState => ({
  rental: null,
  payment_type: "advance",
  amount_due: "",
  due_date: "",
  period_month: "",
  notes: "",
  submitting: false,
});

const emptyCloseForm = (): CloseFormState => ({
  rental: null,
  status: "completed",
  termination_reason: "",
  submitting: false,
});

function buildAdvancePaidDateByRentalUuid(
  rentals: ApartmentRentalRow[],
  payments: RentalPaymentRow[]
): Map<string, number> {
  const rentalUuidById = new Map<number, string>();
  for (const rental of rentals) {
    if (typeof rental.id === "number" && rental.id > 0 && rental.uuid) {
      rentalUuidById.set(rental.id, rental.uuid);
    }
  }

  const latestPaidDateByUuid = new Map<string, number>();
  for (const payment of payments) {
    if (payment.payment_type !== "advance") continue;
    if ((payment.amount_paid ?? 0) <= 0) continue;

    const rentalUuid =
      (typeof payment.rental_uuid === "string" && payment.rental_uuid.trim()) ||
      rentalUuidById.get(Number(payment.rental_id)) ||
      "";

    if (!rentalUuid) continue;

    const paidDate = payment.paid_date ?? payment.updated_at ?? payment.created_at;
    if (!Number.isFinite(paidDate) || paidDate <= 0) continue;

    const prev = latestPaidDateByUuid.get(rentalUuid);
    if (prev === undefined || paidDate > prev) {
      latestPaidDateByUuid.set(rentalUuid, paidDate);
    }
  }

  return latestPaidDateByUuid;
}

export default function RentalsPage() {
  const permissions = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const canGenerateBills = permissions.includes("sales.create");
  const [rows, setRows] = useState<ApartmentRentalRow[]>([]);
  const [latestBillByRentalUuid, setLatestBillByRentalUuid] = useState<Map<string, RentalPaymentRow>>(
    () => new Map()
  );
  const [advancePaidDateByRentalUuid, setAdvancePaidDateByRentalUuid] = useState<Map<string, number>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apartments, setApartments] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [editing, setEditing] = useState<ApartmentRentalRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RentalFormState>(emptyRentalForm());
  const [billForm, setBillForm] = useState<BillFormState>(emptyBillForm());
  const [closeForm, setCloseForm] = useState<CloseFormState>(emptyCloseForm());
  const [pendingDelete, setPendingDelete] = useState<ApartmentRentalRow | null>(null);

  const loadLookups = useCallback(async () => {
    await Promise.allSettled([apartmentsPullToLocal(), customersPullToLocal()]);
    const [apartmentsLocal, customersLocal] = await Promise.all([
      apartmentsListLocal({ page: 1, pageSize: 500 }),
      customersListLocal({ page: 1, pageSize: 500 }),
    ]);

    const apartmentOptions = apartmentsLocal.items
      .filter((item) => item.id > 0)
      .map((item) => ({
        id: item.id,
        label: `${item.apartment_code} - Unit ${item.unit_number}`,
        status: item.status,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const customerOptions = customersLocal.items
      .filter((item) => Number(item.id) > 0)
      .map((item) => ({
        id: Number(item.id),
        label: `${item.name} (${item.phone})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setApartments(apartmentOptions);
    setCustomers(customerOptions);
  }, []);

  const refresh = useCallback(async () => {
    const buildLatestBillByRentalUuid = (
      rentals: ApartmentRentalRow[],
      payments: RentalPaymentRow[]
    ): Map<string, RentalPaymentRow> => {
      const rentalUuidById = new Map<number, string>();
      for (const rental of rentals) {
        if (typeof rental.id === "number" && rental.id > 0 && rental.uuid) {
          rentalUuidById.set(rental.id, rental.uuid);
        }
      }

      const map = new Map<string, RentalPaymentRow>();
      for (const payment of payments) {
        if (!payment.bill_no) continue;
        const rentalUuid =
          (typeof payment.rental_uuid === "string" && payment.rental_uuid.trim()) ||
          rentalUuidById.get(Number(payment.rental_id)) ||
          "";
        if (!rentalUuid) continue;

        const currentTs = payment.bill_generated_at ?? payment.updated_at ?? payment.created_at ?? 0;
        const prev = map.get(rentalUuid);
        const prevTs = prev ? prev.bill_generated_at ?? prev.updated_at ?? prev.created_at ?? 0 : 0;
        if (!prev || currentTs > prevTs) {
          map.set(rentalUuid, payment);
        }
      }
      return map;
    };

    setLoading(true);
    try {
      const [localRentals, localPayments] = await Promise.all([
        rentalsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
        rentalPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      ]);
      setRows(localRentals.items);
      setAdvancePaidDateByRentalUuid(buildAdvancePaidDateByRentalUuid(localRentals.items, localPayments.items));
      setLatestBillByRentalUuid(buildLatestBillByRentalUuid(localRentals.items, localPayments.items));

      let pullFailed = false;
      try {
        await Promise.all([rentalsPullToLocal(), rentalPaymentsPullToLocal()]);
      } catch {
        pullFailed = true;
      }

      const [updatedRentals, updatedPayments] = await Promise.all([
        rentalsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
        rentalPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      ]);
      setRows(updatedRentals.items);
      setAdvancePaidDateByRentalUuid(buildAdvancePaidDateByRentalUuid(updatedRentals.items, updatedPayments.items));
      setLatestBillByRentalUuid(buildLatestBillByRentalUuid(updatedRentals.items, updatedPayments.items));

      if (pullFailed && localRentals.items.length === 0 && updatedRentals.items.length === 0) {
        notifyError("Unable to load rentals from server. Check connection or login session.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([refresh(), loadLookups()]);
  }, [loadLookups, refresh]);

  useEffect(() => {
    const unsubscribeRentals = subscribeAppEvent("rentals:changed", () => {
      void refresh();
    });
    const onSyncComplete = () => {
      void refresh();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeRentals();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const apartmentLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of apartments) map.set(item.id, item.label);
    return map;
  }, [apartments]);

  const customerLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of customers) map.set(item.id, item.label);
    return map;
  }, [customers]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(emptyRentalForm());
    setShowForm(true);
  }, []);

  const openEdit = useCallback((row: ApartmentRentalRow) => {
    setEditing(row);
    setForm({
      apartment_id: String(row.apartment_id),
      tenant_id: String(row.tenant_id),
      contract_start: toDateInput(row.contract_start),
      contract_end: toDateInput(row.contract_end),
      monthly_rent: String(row.monthly_rent ?? 0),
      advance_months: String(row.advance_months ?? 3),
      initial_advance_paid: "0",
      initial_payment_method: "cash",
      notes: "",
    });
    setShowForm(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyRentalForm());
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;

    const apartmentId = Number(form.apartment_id);
    const tenantId = Number(form.tenant_id);
    const monthlyRent = Number(form.monthly_rent);
    const advanceMonths = Number(form.advance_months);

    if (!apartmentId || !tenantId) {
      notifyError("Apartment and tenant are required.");
      return;
    }
    if (!form.contract_start.trim()) {
      notifyError("Contract start date is required.");
      return;
    }
    if (!editing && !form.contract_end.trim()) {
      notifyError("Contract end date is required.");
      return;
    }
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      notifyError("Monthly rent must be greater than 0.");
      return;
    }
    if (!Number.isFinite(advanceMonths) || advanceMonths <= 0) {
      notifyError("Advance months must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      if (editing?.uuid) {
        const payload: RentalUpdateInput = {
          contract_start: form.contract_start,
          contract_end: form.contract_end || undefined,
          monthly_rent: monthlyRent,
          advance_months: Math.trunc(advanceMonths),
        };
        await rentalUpdate(editing.uuid, payload);
      } else {
        const payload: RentalCreateInput = {
          apartment_id: apartmentId,
          tenant_id: tenantId,
          contract_start: form.contract_start,
          contract_end: form.contract_end,
          monthly_rent: monthlyRent,
          advance_months: Math.trunc(advanceMonths),
          initial_advance_paid: Number(form.initial_advance_paid || 0),
          initial_payment_method: form.initial_payment_method,
          notes: form.notes.trim() || undefined,
        };
        await rentalCreate(payload);
      }
      closeFormModal();
      await Promise.all([refresh(), loadLookups()]);
    } catch {}
    finally {
      setSaving(false);
    }
  }, [closeFormModal, editing?.uuid, form, loadLookups, refresh, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete?.uuid) return;
    try {
      await rentalDelete(pendingDelete.uuid);
      await Promise.all([refresh(), loadLookups()]);
    } catch {}
  }, [loadLookups, pendingDelete?.uuid, refresh]);

  const openBill = useCallback((row: ApartmentRentalRow) => {
    const hasAdvanceRemaining = Number(row.advance_remaining_amount ?? 0) > 0;
    const dueDate = hasAdvanceRemaining ? today() : toDateInput(row.next_due_date) || today();
    setBillForm({
      rental: row,
      payment_type: hasAdvanceRemaining ? "advance" : "monthly",
      amount_due: String(hasAdvanceRemaining ? row.advance_remaining_amount || 0 : row.monthly_rent || 0),
      due_date: dueDate,
      period_month: hasAdvanceRemaining ? "" : dueDate.slice(0, 7),
      notes: "",
      submitting: false,
    });
  }, []);

  const closeBillModal = useCallback(() => {
    setBillForm(emptyBillForm());
  }, []);

  const printGeneratedBill = useCallback((payment: RentalPaymentRow, rental: ApartmentRentalRow) => {
    if (typeof window === "undefined") return;

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const billNo = payment.bill_no || `RBL-${String(payment.uuid || "").slice(0, 8).toUpperCase()}`;
    const tenant = customerLabelById.get(rental.tenant_id) ?? rental.tenant_name ?? `Customer #${rental.tenant_id}`;
    const apartment = apartmentLabelById.get(rental.apartment_id) ?? rental.apartment_code ?? `Apartment #${rental.apartment_id}`;
    const dueDate = toDateLabel(payment.due_date);
    const generatedAt = toDateLabel(payment.bill_generated_at);
    const printedAt = new Date().toLocaleString();

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rental Bill - ${escapeHtml(billNo)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; }
      .title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
      .sub { margin: 0; color: #475569; font-size: 12px; }
      .box { border:1px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:12px; }
      .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
      .label { font-size: 12px; color: #64748b; margin-bottom: 2px; }
      .value { font-size: 14px; font-weight: 600; }
      .footer { margin-top: 18px; font-size: 12px; color: #475569; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <p class="title">Rental Bill</p>
        <p class="sub">Customer copy for finance approval</p>
      </div>
      <div>
        <div class="label">Printed At</div>
        <div class="value">${escapeHtml(printedAt)}</div>
      </div>
    </div>

    <div class="box">
      <div class="grid">
        <div><div class="label">Bill No</div><div class="value">${escapeHtml(billNo)}</div></div>
        <div><div class="label">Generated</div><div class="value">${escapeHtml(generatedAt)}</div></div>
        <div><div class="label">Rental</div><div class="value">${escapeHtml(rental.rental_id || "-")}</div></div>
        <div><div class="label">Customer</div><div class="value">${escapeHtml(tenant)}</div></div>
        <div><div class="label">Apartment</div><div class="value">${escapeHtml(apartment)}</div></div>
        <div><div class="label">Payment Type</div><div class="value">${escapeHtml(payment.payment_type || "monthly")}</div></div>
        <div><div class="label">Period Month</div><div class="value">${escapeHtml(payment.period_month || "-")}</div></div>
        <div><div class="label">Due Date</div><div class="value">${escapeHtml(dueDate)}</div></div>
      </div>
    </div>

    <div class="box">
      <div class="label">Amount Due</div>
      <div class="value">${escapeHtml(money(payment.amount_due || 0))}</div>
    </div>

    <div class="footer">Customer should bring this bill to finance for payment approval.</div>
  </body>
</html>`;

    const popup = window.open("", "_blank", "width=900,height=760");
    if (!popup) {
      notifyError("Unable to open print window. Please allow popups and try again.");
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  }, [apartmentLabelById, customerLabelById]);

  const submitBill = useCallback(async (printAfterGenerate = false) => {
    if (!billForm.rental?.uuid || billForm.submitting) return;

    const amountDue = Number(billForm.amount_due);
    if (!Number.isFinite(amountDue) || amountDue <= 0) {
      notifyError("Bill amount must be greater than 0.");
      return;
    }
    if (!billForm.due_date.trim()) {
      notifyError("Due date is required.");
      return;
    }

    setBillForm((prev) => ({ ...prev, submitting: true }));
    try {
      const payload: RentalBillInput = {
        payment_type: billForm.payment_type,
        amount_due: amountDue,
        due_date: billForm.due_date,
        period_month: billForm.period_month || undefined,
        notes: billForm.notes || undefined,
      };
      const result = await rentalGenerateBill(billForm.rental.uuid, payload);
      if (printAfterGenerate) {
        printGeneratedBill(result.payment, billForm.rental);
      }
      closeBillModal();
      await Promise.all([refresh(), loadLookups()]);
    } catch {}
    finally {
      setBillForm((prev) => ({ ...prev, submitting: false }));
    }
  }, [billForm, closeBillModal, loadLookups, printGeneratedBill, refresh]);

  const handoverKey = useCallback(async (row: ApartmentRentalRow) => {
    if (!row.uuid) return;
    try {
      await rentalHandoverKey(row.uuid);
      await Promise.all([refresh(), loadLookups()]);
    } catch {}
  }, [loadLookups, refresh]);

  const openCloseModal = useCallback((row: ApartmentRentalRow) => {
    setCloseForm({
      rental: row,
      status: "completed",
      termination_reason: "",
      submitting: false,
    });
  }, []);

  const closeCloseModal = useCallback(() => {
    setCloseForm(emptyCloseForm());
  }, []);

  const submitClose = useCallback(async () => {
    if (!closeForm.rental?.uuid || closeForm.submitting) return;
    setCloseForm((prev) => ({ ...prev, submitting: true }));

    try {
      const payload: RentalCloseInput = {
        status: closeForm.status,
        termination_reason: closeForm.termination_reason.trim() || undefined,
      };
      await rentalClose(closeForm.rental.uuid, payload);
      closeCloseModal();
      await Promise.all([refresh(), loadLookups()]);
    } catch {}
    finally {
      setCloseForm((prev) => ({ ...prev, submitting: false }));
    }
  }, [closeCloseModal, closeForm, loadLookups, refresh]);

  const columns = useMemo<Column<ApartmentRentalRow>[]>(
    () => [
      { key: "rental_id", label: "Rental ID", render: (item) => <span className="font-semibold">{item.rental_id || "-"}</span> },
      {
        key: "apartment_id",
        label: "Apartment",
        render: (item) => apartmentLabelById.get(item.apartment_id) ?? item.apartment_code ?? `Apartment #${item.apartment_id}`,
      },
      {
        key: "tenant_id",
        label: "Tenant",
        render: (item) => customerLabelById.get(item.tenant_id) ?? item.tenant_name ?? `Customer #${item.tenant_id}`,
      },
      { key: "monthly_rent", label: "Monthly Rent", render: (item) => money(item.monthly_rent) },
      {
        key: "advance_paid_date",
        label: "Advance Paid Date",
        render: (item) => toDateLabel(advancePaidDateByRentalUuid.get(item.uuid)),
      },
      {
        key: "next_due_date",
        label: "Next Payment Date",
        render: (item) => toDateLabel(item.next_due_date),
      },
      {
        key: "status",
        label: "Status",
        render: (item) => <Badge color={statusColor[item.status] ?? "blue"}>{item.status}</Badge>,
      },
      {
        key: "print_bill",
        label: "Print Bill",
        render: (item) => {
          const bill = latestBillByRentalUuid.get(item.uuid);
          const canPrint = Boolean(bill);
          return (
            <button
              type="button"
              disabled={!canPrint}
              onClick={() => {
                if (!bill) return;
                printGeneratedBill(bill, item);
              }}
              className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canPrint ? "Print Bill" : "No Bill"}
            </button>
          );
        },
      },
      {
        key: "operations",
        label: "Operations",
        render: (item) => {
          const canHandover =
            item.advance_remaining_amount <= 0 &&
            item.key_handover_status !== "handed_over" &&
            !["completed", "terminated", "defaulted", "cancelled"].includes(item.status);
          const canBill = canGenerateBills && !["completed", "terminated", "defaulted", "cancelled"].includes(item.status);
          const canClose = !["completed", "terminated", "defaulted", "cancelled"].includes(item.status);
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canBill}
                onClick={() => openBill(item)}
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Bill
              </button>
              <button
                type="button"
                disabled={!canHandover}
                onClick={() => {
                  void handoverKey(item);
                }}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Handover
              </button>
              <button
                type="button"
                disabled={!canClose}
                onClick={() => openCloseModal(item)}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>
          );
        },
      },
    ],
    [
      advancePaidDateByRentalUuid,
      apartmentLabelById,
      canGenerateBills,
      customerLabelById,
      handoverKey,
      latestBillByRentalUuid,
      openBill,
      openCloseModal,
      printGeneratedBill,
    ]
  );

  const renderExpandedRow = useCallback(
    (item: ApartmentRentalRow) => (
      <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contract</div>
          <div>{`${toDateLabel(item.contract_start)} -> ${toDateLabel(item.contract_end)}`}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advance Months</div>
          <div>{item.advance_months} months</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advance Required</div>
          <div>{money(item.advance_required_amount)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advance Paid</div>
          <div>{money(item.advance_paid_amount)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advance Remaining</div>
          <div className={item.advance_remaining_amount > 0 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
            {money(item.advance_remaining_amount)}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand Total Paid</div>
          <div className="font-semibold text-emerald-700 dark:text-emerald-400">{money(item.total_paid_amount)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advance Paid Date</div>
          <div>{toDateLabel(advancePaidDateByRentalUuid.get(item.uuid))}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Possession</div>
          <div>
            <Badge color={item.key_handover_status === "handed_over" ? "emerald" : "amber"}>{item.key_handover_status}</Badge>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Due</div>
          <div>{toDateLabel(item.next_due_date)}</div>
        </div>
      </div>
    ),
    [advancePaidDateByRentalUuid]
  );

  return (
    <RequirePermission permission="apartments.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Apartment Rentals" subtitle="Manage rental contracts with customizable advance months">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Create Rental
          </button>
        </PageHeader>

        <div className="mt-6">
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            compact
            mobileStack
            noHorizontalScroll
            expandableRows
            renderExpandedRow={renderExpandedRow}
            searchKeys={["rental_id", "status", "apartment_code", "tenant_name", "tenant_phone"]}
            pageSize={TABLE_PAGE_SIZE}
            onEdit={openEdit}
            onDelete={setPendingDelete}
          />
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={closeFormModal}
        title={editing ? `Edit Rental ${editing.rental_id || ""}` : "Create Rental Contract"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Apartment"
              type="select"
              value={form.apartment_id}
              onChange={(value) => setForm((prev) => ({ ...prev, apartment_id: String(value) }))}
              options={apartments
                .filter((item) => editing?.apartment_id === item.id || !item.status || item.status === "available" || item.status === "reserved")
                .map((item) => ({ value: String(item.id), label: `${item.label}${item.status ? ` (${item.status})` : ""}` }))}
              required
            />
            <FormField
              label="Tenant"
              type="select"
              value={form.tenant_id}
              onChange={(value) => setForm((prev) => ({ ...prev, tenant_id: String(value) }))}
              options={customers.map((item) => ({ value: String(item.id), label: item.label }))}
              required
            />
            <FormField
              label="Contract Start"
              type="date"
              value={form.contract_start}
              onChange={(value) => setForm((prev) => ({ ...prev, contract_start: String(value) }))}
              required
            />
            <FormField
              label="Contract End"
              type="date"
              value={form.contract_end}
              onChange={(value) => setForm((prev) => ({ ...prev, contract_end: String(value) }))}
              required={!editing}
            />
            <FormField
              label="Monthly Rent (USD)"
              type="number"
              value={form.monthly_rent}
              onChange={(value) => setForm((prev) => ({ ...prev, monthly_rent: String(value) }))}
              required
            />
            <FormField
              label="Advance Months"
              type="number"
              value={form.advance_months}
              onChange={(value) => setForm((prev) => ({ ...prev, advance_months: String(value) }))}
              required
            />
            {!editing && (
              <FormField
                label="Initial Advance Paid"
                type="number"
                value={form.initial_advance_paid}
                onChange={(value) => setForm((prev) => ({ ...prev, initial_advance_paid: String(value) }))}
              />
            )}
            {!editing && (
              <FormField
                label="Initial Payment Method"
                type="select"
                value={form.initial_payment_method}
                onChange={(value) => setForm((prev) => ({ ...prev, initial_payment_method: String(value) }))}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank", label: "Bank" },
                  { value: "transfer", label: "Transfer" },
                  { value: "cheque", label: "Cheque" },
                ]}
              />
            )}
          </div>
          {!editing && (
            <FormField
              label="Notes"
              value={form.notes}
              onChange={(value) => setForm((prev) => ({ ...prev, notes: String(value) }))}
            />
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeFormModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void handleSave();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editing ? "Update Rental" : "Create Rental"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(billForm.rental)}
        onClose={closeBillModal}
        title={billForm.rental ? `Generate Bill - ${billForm.rental.rental_id}` : "Generate Bill"}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Payment Type"
              type="select"
              value={billForm.payment_type}
              onChange={(value) =>
                setBillForm((prev) => ({
                  ...prev,
                  payment_type: String(value) as BillFormState["payment_type"],
                }))
              }
              options={[
                { value: "advance", label: "Advance" },
                { value: "monthly", label: "Monthly" },
                { value: "late_fee", label: "Late Fee" },
                { value: "adjustment", label: "Adjustment" },
              ]}
              required
            />
            <FormField
              label="Amount Due"
              type="number"
              value={billForm.amount_due}
              onChange={(value) => setBillForm((prev) => ({ ...prev, amount_due: String(value) }))}
              required
            />
            <FormField
              label="Due Date"
              type="date"
              value={billForm.due_date}
              onChange={(value) => setBillForm((prev) => ({ ...prev, due_date: String(value) }))}
              required
            />
            <FormField
              label="Period Month (YYYY-MM)"
              value={billForm.period_month}
              onChange={(value) => setBillForm((prev) => ({ ...prev, period_month: String(value) }))}
            />
          </div>
          <FormField
            label="Notes"
            value={billForm.notes}
            onChange={(value) => setBillForm((prev) => ({ ...prev, notes: String(value) }))}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeBillModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={billForm.submitting}
              onClick={() => {
                void submitBill();
              }}
              className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              {billForm.submitting ? "Generating..." : "Generate Bill"}
            </button>
            <button
              type="button"
              disabled={billForm.submitting}
              onClick={() => {
                void submitBill(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billForm.submitting ? "Generating..." : "Generate & Print Bill"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(closeForm.rental)}
        onClose={closeCloseModal}
        title={closeForm.rental ? `Close Rental - ${closeForm.rental.rental_id}` : "Close Rental"}
        size="sm"
      >
        <div className="space-y-4">
          <FormField
            label="Status"
            type="select"
            value={closeForm.status}
            onChange={(value) =>
              setCloseForm((prev) => ({
                ...prev,
                status: String(value) as CloseFormState["status"],
              }))
            }
            options={[
              { value: "completed", label: "Completed" },
              { value: "terminated", label: "Terminated" },
              { value: "defaulted", label: "Defaulted" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            required
          />
          <FormField
            label="Termination Reason"
            value={closeForm.termination_reason}
            onChange={(value) => setCloseForm((prev) => ({ ...prev, termination_reason: String(value) }))}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCloseModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={closeForm.submitting}
              onClick={() => {
                void submitClose();
              }}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {closeForm.submitting ? "Saving..." : "Close Rental"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete Rental"
        message={`Are you sure you want to delete rental ${pendingDelete?.rental_id ?? ""}?`}
      />
    </RequirePermission>
  );
}
