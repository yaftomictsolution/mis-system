"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { RentalPaymentRow } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError } from "@/lib/notify";
import { rentalApprovePayment, rentalPaymentsListLocal, rentalPaymentsPullToLocal } from "@/modules/rentals/rentals.repo";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const today = () => new Date().toISOString().slice(0, 10);

type ApproveFormState = {
  payment: RentalPaymentRow | null;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_no: string;
  notes: string;
  submitting: boolean;
};

const emptyApproveForm = (): ApproveFormState => ({
  payment: null,
  amount: "",
  payment_date: today(),
  payment_method: "cash",
  reference_no: "",
  notes: "",
  submitting: false,
});

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

export default function RentalPaymentsPage() {
  const permissions = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const canApprovePayments = permissions.includes("installments.pay");
  const [rows, setRows] = useState<RentalPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveForm, setApproveForm] = useState<ApproveFormState>(emptyApproveForm());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const local = await rentalPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE });
      setRows(local.items);

      try {
        await rentalPaymentsPullToLocal();
      } catch {}

      const updated = await rentalPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE });
      setRows(updated.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const totalPaid = useMemo(() => rows.reduce((sum, item) => sum + (item.amount_paid || 0), 0), [rows]);
  const totalRemaining = useMemo(() => rows.reduce((sum, item) => sum + (item.remaining_amount || 0), 0), [rows]);
  const openApprove = useCallback((payment: RentalPaymentRow) => {
    const remaining = Number(payment.remaining_amount || 0);
    if (remaining <= 0) {
      notifyError("This bill is already fully settled.");
      return;
    }
    setApproveForm({
      payment,
      amount: String(remaining),
      payment_date: today(),
      payment_method: "cash",
      reference_no: "",
      notes: "",
      submitting: false,
    });
  }, []);

  const closeApproveModal = useCallback(() => {
    setApproveForm(emptyApproveForm());
  }, []);

  const submitApproval = useCallback(async () => {
    if (!approveForm.payment?.uuid || approveForm.submitting) return;

    const amount = Number(approveForm.amount);
    const remaining = Number(approveForm.payment.remaining_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      notifyError("Approval amount must be greater than 0.");
      return;
    }
    if (amount > remaining) {
      notifyError("Approval amount cannot be greater than bill remaining amount.");
      return;
    }

    setApproveForm((prev) => ({ ...prev, submitting: true }));
    try {
      await rentalApprovePayment(approveForm.payment.uuid, {
        amount,
        payment_date: approveForm.payment_date || undefined,
        payment_method: approveForm.payment_method || "cash",
        reference_no: approveForm.reference_no || undefined,
        notes: approveForm.notes || undefined,
      });
      closeApproveModal();
      await refresh();
    } catch {}
    finally {
      setApproveForm((prev) => ({ ...prev, submitting: false }));
    }
  }, [approveForm, closeApproveModal, refresh]);

  const printBill = useCallback((item: RentalPaymentRow) => {
    if (typeof window === "undefined") return;

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const billNo = item.bill_no || `BILL-${String(item.uuid || "").slice(0, 8).toUpperCase()}`;
    const tenant = item.tenant_name || "-";
    const tenantPhone = item.tenant_phone || "-";
    const rentalCode = item.rental_code || "-";
    const apartment = item.apartment_code || "-";
    const month = item.period_month || "-";
    const dueDate = toDateLabel(item.due_date);
    const generatedAt = toDateLabel(item.bill_generated_at);
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
      .amounts { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .footer { margin-top: 18px; font-size: 12px; color: #475569; }
      @media print { body { margin: 10mm; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <p class="title">Rental Bill</p>
        <p class="sub">Customer copy for finance payment approval</p>
      </div>
      <div>
        <div class="label">Printed At</div>
        <div class="value">${escapeHtml(printedAt)}</div>
      </div>
    </div>

    <div class="box">
      <div class="grid">
        <div><div class="label">Bill No</div><div class="value">${escapeHtml(billNo)}</div></div>
        <div><div class="label">Bill Generated</div><div class="value">${escapeHtml(generatedAt)}</div></div>
        <div><div class="label">Rental</div><div class="value">${escapeHtml(rentalCode)}</div></div>
        <div><div class="label">Apartment</div><div class="value">${escapeHtml(apartment)}</div></div>
        <div><div class="label">Customer</div><div class="value">${escapeHtml(tenant)}</div></div>
        <div><div class="label">Phone</div><div class="value">${escapeHtml(tenantPhone)}</div></div>
        <div><div class="label">Period Month</div><div class="value">${escapeHtml(month)}</div></div>
        <div><div class="label">Due Date</div><div class="value">${escapeHtml(dueDate)}</div></div>
      </div>
    </div>

    <div class="box">
      <div class="amounts">
        <div><div class="label">Amount Due</div><div class="value">${escapeHtml(money(item.amount_due))}</div></div>
        <div><div class="label">Paid</div><div class="value">${escapeHtml(money(item.amount_paid))}</div></div>
        <div><div class="label">Remaining</div><div class="value">${escapeHtml(money(item.remaining_amount))}</div></div>
      </div>
      <div style="margin-top: 10px;">
        <div class="label">Status</div>
        <div class="value">${escapeHtml(item.status || "pending")}</div>
      </div>
    </div>

    <div class="footer">
      Present this bill to finance for approval and payment processing.
    </div>
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
  }, []);

  const columns = useMemo<Column<RentalPaymentRow>[]>(
    () => [
      { key: "bill_no", label: "Bill", render: (item) => <span className="font-semibold">{item.bill_no || "-"}</span> },
      { key: "tenant_name", label: "Customer", render: (item) => item.tenant_name || "-" },
      { key: "rental_code", label: "Rental", render: (item) => item.rental_code || "-" },
      { key: "period_month", label: "Month", render: (item) => item.period_month || "-" },
      { key: "amount_due", label: "Amount Due", render: (item) => money(item.amount_due) },
      { key: "amount_paid", label: "Paid", render: (item) => <span className="font-semibold text-emerald-700 dark:text-emerald-400">{money(item.amount_paid)}</span> },
      { key: "remaining_amount", label: "Remaining", render: (item) => money(item.remaining_amount) },
      {
        key: "status",
        label: "Status",
        render: (item) => (
          <Badge color={item.status === "paid" ? "emerald" : item.status === "partial" ? "amber" : "red"}>
            {item.status || "-"}
          </Badge>
        ),
      },
      {
        key: "finance_action",
        label: "Finance",
        render: (item) => {
          const canApprove = canApprovePayments && (item.remaining_amount ?? 0) > 0 && !["paid", "waived"].includes(item.status);
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => printBill(item)}
                className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-800"
              >
                Print Bill
              </button>
              <button
                type="button"
                disabled={!canApprove}
                onClick={() => openApprove(item)}
                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          );
        },
      },
    ],
    [canApprovePayments, openApprove, printBill]
  );

  const renderExpandedRow = useCallback(
    (item: RentalPaymentRow) => (
      <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
          <div>{item.tenant_phone || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Apartment</div>
          <div>{item.apartment_code || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due Date</div>
          <div>{toDateLabel(item.due_date)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Generated</div>
          <div>{toDateLabel(item.bill_generated_at)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid Date</div>
          <div>{toDateLabel(item.paid_date)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount Due</div>
          <div>{money(item.amount_due)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Type</div>
          <div>{item.payment_type || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved By</div>
          <div>{item.approved_by_name || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved At</div>
          <div>{toDateLabel(item.approved_at)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
          <div>{item.notes || "-"}</div>
        </div>
      </div>
    ),
    []
  );

  return (
    <RequirePermission permission="apartments.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Rental Bills & Finance Approval" subtitle="Approve customer bill payments and track settlement" />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#161625]">
            <div className="text-sm text-slate-500">Total Paid</div>
            <div className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">{money(totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#161625]">
            <div className="text-sm text-slate-500">Total Remaining</div>
            <div className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-400">{money(totalRemaining)}</div>
          </div>
        </div>

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
            searchKeys={["tenant_name", "tenant_phone", "rental_code", "apartment_code", "period_month", "status"]}
            pageSize={TABLE_PAGE_SIZE}
          />
        </div>
      </div>

      <Modal
        isOpen={Boolean(approveForm.payment)}
        onClose={closeApproveModal}
        title={approveForm.payment?.bill_no ? `Approve Bill ${approveForm.payment.bill_no}` : "Approve Bill Payment"}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Amount"
              type="number"
              value={approveForm.amount}
              onChange={(value) => setApproveForm((prev) => ({ ...prev, amount: String(value) }))}
              required
            />
            <FormField
              label="Payment Date"
              type="date"
              value={approveForm.payment_date}
              onChange={(value) => setApproveForm((prev) => ({ ...prev, payment_date: String(value) }))}
              required
            />
            <FormField
              label="Payment Method"
              type="select"
              value={approveForm.payment_method}
              onChange={(value) => setApproveForm((prev) => ({ ...prev, payment_method: String(value) }))}
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" },
                { value: "transfer", label: "Transfer" },
                { value: "cheque", label: "Cheque" },
              ]}
            />
            <FormField
              label="Reference No"
              value={approveForm.reference_no}
              onChange={(value) => setApproveForm((prev) => ({ ...prev, reference_no: String(value) }))}
            />
          </div>
          <FormField
            label="Notes"
            value={approveForm.notes}
            onChange={(value) => setApproveForm((prev) => ({ ...prev, notes: String(value) }))}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeApproveModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={approveForm.submitting}
              onClick={() => {
                void submitApproval();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {approveForm.submitting ? "Approving..." : "Approve Payment"}
            </button>
          </div>
        </div>
      </Modal>
    </RequirePermission>
  );
}
