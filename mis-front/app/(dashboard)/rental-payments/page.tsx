"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AccountRow, RentalPaymentRow } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError } from "@/lib/notify";
import { hasAnyRole } from "@/lib/permissions";
import { accountsListLocal, accountsPullToLocal } from "@/modules/accounts/accounts.repo";
import {
  rentalApprovePayment,
  rentalPaymentsListLocal,
  rentalPaymentsPullToLocal,
  rentalProcessPayment,
  rentalRejectPayment,
} from "@/modules/rentals/rentals.repo";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const today = () => new Date().toISOString().slice(0, 10);

type AccountOption = {
  id: number;
  label: string;
};

type ProcessFormState = {
  payment: RentalPaymentRow | null;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_no: string;
  account_id: string;
  notes: string;
  submitting: boolean;
};

const emptyProcessForm = (): ProcessFormState => ({
  payment: null,
  amount: "",
  payment_date: today(),
  payment_method: "cash",
  reference_no: "",
  account_id: "",
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

const normalizePaymentStatus = (value: string | null | undefined): string => {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "pending") return "pending_admin_approval";
  return status || "pending_admin_approval";
};

const isPendingAdminApprovalStatus = (value: string | null | undefined): boolean =>
  normalizePaymentStatus(value) === "pending_admin_approval";

const isReadyForProcessingStatus = (value: string | null | undefined): boolean =>
  ["approved_for_payment", "partial"].includes(normalizePaymentStatus(value));

const statusLabel = (value: string | null | undefined): string => {
  const status = normalizePaymentStatus(value);
  if (status === "pending_admin_approval") return "Pending Admin Approval";
  if (status === "approved_for_payment") return "Approved For Payment";
  if (status === "partial") return "Partial";
  if (status === "paid") return "Paid";
  if (status === "rejected") return "Rejected";
  if (status === "waived") return "Waived";
  return status ? status.replace(/_/g, " ") : "-";
};

const statusColor = (value: string | null | undefined): "amber" | "blue" | "emerald" | "red" | "slate" => {
  const status = normalizePaymentStatus(value);
  if (status === "paid") return "emerald";
  if (status === "approved_for_payment") return "blue";
  if (status === "partial" || status === "pending_admin_approval") return "amber";
  if (status === "rejected") return "red";
  return "slate";
};

export default function RentalPaymentsPage() {
  const permissions = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const roles = useSelector((s: RootState) => s.auth.user?.roles ?? []);
  const isAdmin = hasAnyRole(roles, "Admin");
  const canReviewPayments = isAdmin || permissions.includes("sales.approve");
  const canProcessPayments =
    isAdmin ||
    permissions.includes("installments.pay") ||
    permissions.includes("accounts.view") ||
    hasAnyRole(roles, ["Accountant", "Finance", "FinanceManager", "Finance Manager"]);

  const [rows, setRows] = useState<RentalPaymentRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningUuid, setActioningUuid] = useState<string | null>(null);
  const [processForm, setProcessForm] = useState<ProcessFormState>(emptyProcessForm());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [local, accountPage] = await Promise.all([
        rentalPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
        accountsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      ]);
      setRows(local.items);
      setAccounts(
        accountPage.items
          .filter((item: AccountRow) => Number(item.id) > 0 && item.status === "active")
          .map((item: AccountRow) => ({
            id: Number(item.id),
            label: `${item.name} (${item.currency}) - ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: String(item.currency || "USD").toUpperCase(),
              maximumFractionDigits: 2,
            }).format(Number(item.current_balance ?? 0))}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );

      try {
        await Promise.all([rentalPaymentsPullToLocal(), accountsPullToLocal()]);
      } catch {}

      const [updated, refreshedAccounts] = await Promise.all([
        rentalPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
        accountsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      ]);
      setRows(updated.items);
      setAccounts(
        refreshedAccounts.items
          .filter((item: AccountRow) => Number(item.id) > 0 && item.status === "active")
          .map((item: AccountRow) => ({
            id: Number(item.id),
            label: `${item.name} (${item.currency}) - ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: String(item.currency || "USD").toUpperCase(),
              maximumFractionDigits: 2,
            }).format(Number(item.current_balance ?? 0))}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
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

  const openProcess = useCallback((payment: RentalPaymentRow) => {
    const remaining = Number(payment.remaining_amount || 0);
    const status = normalizePaymentStatus(payment.status);
    if (remaining <= 0) {
      notifyError("This bill is already fully settled.");
      return;
    }
    if (!isReadyForProcessingStatus(status)) {
      notifyError("Admin approval is required before payment processing.");
      return;
    }
    setProcessForm({
      payment,
      amount: String(remaining),
      payment_date: today(),
      payment_method: "cash",
      reference_no: "",
      account_id: "",
      notes: "",
      submitting: false,
    });
  }, []);

  const closeProcessModal = useCallback(() => {
    setProcessForm(emptyProcessForm());
  }, []);

  const submitProcessing = useCallback(async () => {
    if (!processForm.payment?.uuid || processForm.submitting) return;

    const amount = Number(processForm.amount);
    const remaining = Number(processForm.payment.remaining_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      notifyError("Processing amount must be greater than 0.");
      return;
    }
    if (amount > remaining) {
      notifyError("Processed amount cannot be greater than bill remaining amount.");
      return;
    }
    const accountId = Number(processForm.account_id);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      notifyError("Payment account is required.");
      return;
    }

    setProcessForm((prev) => ({ ...prev, submitting: true }));
    try {
      await rentalProcessPayment(processForm.payment.uuid, {
        amount,
        payment_date: processForm.payment_date || undefined,
        payment_method: processForm.payment_method || "cash",
        reference_no: processForm.reference_no || undefined,
        account_id: accountId,
        notes: processForm.notes || undefined,
      });
      closeProcessModal();
      await refresh();
    } catch {
    } finally {
      setProcessForm((prev) => ({ ...prev, submitting: false }));
    }
  }, [closeProcessModal, processForm, refresh]);

  const approveRequest = useCallback(
    async (payment: RentalPaymentRow) => {
      if (!payment.uuid || actioningUuid === payment.uuid) return;
      setActioningUuid(payment.uuid);
      try {
        await rentalApprovePayment(payment.uuid);
        await refresh();
      } catch {
      } finally {
        setActioningUuid((current) => (current === payment.uuid ? null : current));
      }
    },
    [actioningUuid, refresh]
  );

  const rejectRequest = useCallback(
    async (payment: RentalPaymentRow) => {
      if (!payment.uuid || actioningUuid === payment.uuid) return;
      if (typeof window !== "undefined") {
        const confirmed = window.confirm(
          `Reject bill ${payment.bill_no || payment.uuid}? Finance will not be able to process it until a new bill is created.`
        );
        if (!confirmed) return;
      }
      setActioningUuid(payment.uuid);
      try {
        await rentalRejectPayment(payment.uuid);
        await refresh();
      } catch {
      } finally {
        setActioningUuid((current) => (current === payment.uuid ? null : current));
      }
    },
    [actioningUuid, refresh]
  );

  const printBill = useCallback((item: RentalPaymentRow) => {
    if (typeof window === "undefined") return;
    if (!item.uuid || !item.rental_uuid) {
      notifyError("Unable to locate this rental bill for printing.");
      return;
    }

    const url = `/print/rentals/${encodeURIComponent(item.rental_uuid)}/bill/${encodeURIComponent(item.uuid)}`;
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      notifyError("Unable to open print window. Please allow popups and try again.");
    }
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
        render: (item) => <Badge color={statusColor(item.status)}>{statusLabel(item.status)}</Badge>,
      },
      {
        key: "workflow_action",
        label: "Workflow",
        render: (item) => {
          const normalizedStatus = normalizePaymentStatus(item.status);
          const isBusy =
            actioningUuid === item.uuid ||
            (processForm.submitting && processForm.payment?.uuid === item.uuid);
          const canApprove = canReviewPayments && isPendingAdminApprovalStatus(normalizedStatus);
          const canReject = canReviewPayments && isPendingAdminApprovalStatus(normalizedStatus);
          const canProcess =
            canProcessPayments &&
            isReadyForProcessingStatus(normalizedStatus) &&
            Number(item.remaining_amount ?? 0) > 0 &&
            !["paid", "waived", "rejected"].includes(normalizedStatus);

          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => printBill(item)}
                className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-800"
              >
                Print Bill
              </button>
              {canApprove ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    void approveRequest(item);
                  }}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>
              ) : null}
              {canReject ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    void rejectRequest(item);
                  }}
                  className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>
              ) : null}
              {canProcess ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => openProcess(item)}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Process Payment
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      actioningUuid,
      approveRequest,
      canProcessPayments,
      canReviewPayments,
      openProcess,
      printBill,
      processForm.payment?.uuid,
      processForm.submitting,
      rejectRequest,
    ]
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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Processed Date</div>
          <div>{toDateLabel(item.paid_date)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow Status</div>
          <div>{statusLabel(item.status)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Type</div>
          <div>{item.payment_type || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Processed By</div>
          <div>{item.approved_by_name || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Processed At</div>
          <div>{toDateLabel(item.approved_at)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount Due</div>
          <div>{money(item.amount_due)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid</div>
          <div>{money(item.amount_paid)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining</div>
          <div>{money(item.remaining_amount)}</div>
        </div>
        <div className="md:col-span-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
          <div>{item.notes || "-"}</div>
        </div>
      </div>
    ),
    []
  );

  return (
    <RequirePermission
      permission={["installments.pay", "sales.approve", "accounts.view", "apartments.view"]}
      role={["Admin", "Accountant", "Finance", "FinanceManager", "Finance Manager"]}
    >
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Rental Bills & Payment Workflow"
          subtitle="Approved rentals and approved bills arrive here for finance payment processing."
        />

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
            searchKeys={["tenant_name", "tenant_phone", "rental_code", "apartment_code", "period_month", "status", "bill_no"]}
            pageSize={TABLE_PAGE_SIZE}
          />
        </div>
      </div>

      <Modal
        isOpen={Boolean(processForm.payment)}
        onClose={closeProcessModal}
        title={processForm.payment?.bill_no ? `Process Bill ${processForm.payment.bill_no}` : "Process Bill Payment"}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Amount"
              type="number"
              value={processForm.amount}
              onChange={(value) => setProcessForm((prev) => ({ ...prev, amount: String(value) }))}
              required
            />
            <FormField
              label="Payment Date"
              type="date"
              value={processForm.payment_date}
              onChange={(value) => setProcessForm((prev) => ({ ...prev, payment_date: String(value) }))}
              required
            />
            <FormField
              label="Payment Method"
              type="select"
              value={processForm.payment_method}
              onChange={(value) => setProcessForm((prev) => ({ ...prev, payment_method: String(value) }))}
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" },
                { value: "transfer", label: "Transfer" },
                { value: "cheque", label: "Cheque" },
              ]}
            />
            <FormField
              label="Reference No"
              value={processForm.reference_no}
              onChange={(value) => setProcessForm((prev) => ({ ...prev, reference_no: String(value) }))}
            />
            <FormField
              label="Payment Account"
              type="select"
              value={processForm.account_id}
              onChange={(value) => setProcessForm((prev) => ({ ...prev, account_id: String(value) }))}
              options={accounts.map((item) => ({ value: String(item.id), label: item.label }))}
              required
            />
          </div>
          <FormField
            label="Notes"
            value={processForm.notes}
            onChange={(value) => setProcessForm((prev) => ({ ...prev, notes: String(value) }))}
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeProcessModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={processForm.submitting}
              onClick={() => {
                void submitProcessing();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processForm.submitting ? "Processing..." : "Process Payment"}
            </button>
          </div>
        </div>
      </Modal>
    </RequirePermission>
  );
}
