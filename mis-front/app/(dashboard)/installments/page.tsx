"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import type { InstallmentRow } from "@/db/localDB";
import type { RootState } from "@/store/store";
import { accountsListLocal, accountsPullToLocal } from "@/modules/accounts/accounts.repo";
import {
  installmentPay,
  installmentsListLocal,
  installmentsPullToLocal,
} from "@/modules/installments/installments.repo";

const LOCAL_LIST_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;

const money = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
};

const toDate = (value: number | null | undefined): string => {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
};

const normalizeStatus = (value: string): "pending" | "paid" | "overdue" | "cancelled" => {
  const status = value.trim().toLowerCase();
  if (status === "paid" || status === "overdue" || status === "cancelled") return status;
  return "pending";
};

const normalizeSaleStatus = (value: string | undefined): "pending" | "approved" | "active" | "completed" | "cancelled" | "terminated" | "defaulted" => {
  const status = String(value ?? "").trim().toLowerCase();
  if (
    status === "pending" ||
    status === "approved" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "terminated" ||
    status === "defaulted"
  ) {
    return status;
  }
  return "active";
};

const installmentRemaining = (row: InstallmentRow): number => {
  const explicitRemaining = Number(row.remaining_amount);
  if (Number.isFinite(explicitRemaining)) {
    return Math.max(0, Number(explicitRemaining.toFixed(2)));
  }
  return Math.max(0, Number((row.amount - row.paid_amount).toFixed(2)));
};

const dueDateTone = (row: InstallmentRow): "neutral" | "soon" | "overdue" => {
  const status = normalizeStatus(row.status);
  if (status === "paid" || status === "cancelled") return "neutral";

  const dueTs = Number(row.due_date ?? 0);
  if (!Number.isFinite(dueTs) || dueTs <= 0) return "neutral";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dueTs < today.getTime() || status === "overdue") return "overdue";

  const inThreeDays = today.getTime() + 3 * 24 * 60 * 60 * 1000;
  if (dueTs <= inThreeDays) return "soon";

  return "neutral";
};


const statusColor = {
  pending: "amber",
  paid: "emerald",
  overdue: "red",
  cancelled: "purple",
} as const;

type AccountOption = {
  id: number;
  label: string;
};

type PayFormState = {
  installment: InstallmentRow | null;
  amount: string;
  paidDate: string;
  accountId: string;
  error: string | null;
  submitting: boolean;
};

const emptyPayState = (): PayFormState => ({
  installment: null,
  amount: "",
  paidDate: new Date().toISOString().slice(0, 10),
  accountId: "",
  error: null,
  submitting: false,
});

export default function InstallmentsPage() {
  const permissions = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const canPayInstallments = permissions.includes("installments.pay");
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [payForm, setPayForm] = useState<PayFormState>(emptyPayState());

  const loadLocal = useCallback(async () => {
    const [local, accountPage] = await Promise.all([
      installmentsListLocal({ page: 1, pageSize: LOCAL_LIST_PAGE_SIZE }),
      accountsListLocal({ page: 1, pageSize: LOCAL_LIST_PAGE_SIZE }),
    ]);
    setRows(local.items.map((item) => ({ ...item })));
    setAccounts(
      accountPage.items
        .filter((item) => item.id && item.status === "active")
        .map((item) => ({
          id: Number(item.id),
          label: `${item.name} (${item.currency}) - ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: String(item.currency || "USD").toUpperCase(),
            maximumFractionDigits: 2,
          }).format(Number(item.current_balance ?? 0))}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadLocal();
      try {
        await Promise.all([installmentsPullToLocal(), accountsPullToLocal()]);
      } catch {
        // Keep local list as fallback.
      }
      await loadLocal();
    } finally {
      setLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const openPayForm = useCallback((row: InstallmentRow) => {
    const remaining = installmentRemaining(row);
    setPayForm({
      installment: row,
      amount: remaining > 0 ? String(remaining) : "",
      paidDate: new Date().toISOString().slice(0, 10),
      accountId: "",
      error: null,
      submitting: false,
    });
  }, []);

  const closePayForm = useCallback(() => {
    setPayForm(emptyPayState());
  }, []);

  const handlePay = useCallback(async () => {
    const installment = payForm.installment;
    if (!installment?.uuid) return;

    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayForm((prev) => ({ ...prev, error: "Payment amount must be greater than 0." }));
      return;
    }
    const accountId = Number(payForm.accountId);
    if (!Number.isFinite(accountId) || accountId <= 0) {
      setPayForm((prev) => ({ ...prev, error: "Payment account is required." }));
      return;
    }

    setPayForm((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await installmentPay(installment.uuid, {
        amount,
        paid_date: payForm.paidDate,
        account_id: accountId,
      });
      closePayForm();
      await refresh();
    } catch (error: unknown) {
      setPayForm((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Payment failed.",
      }));
    } finally {
      setPayForm((prev) => ({ ...prev, submitting: false }));
    }
  }, [closePayForm, payForm.accountId, payForm.amount, payForm.installment, payForm.paidDate, refresh]);

  const totalDue = useMemo(
    () => rows.reduce((sum, row) => sum + installmentRemaining(row), 0),
    [rows]
  );
  const overdueCount = useMemo(
    () => rows.filter((row) => normalizeStatus(row.status) === "overdue").length,
    [rows]
  );
  const paidCount = useMemo(() => rows.filter((row) => normalizeStatus(row.status) === "paid").length, [rows]);

  const columns = useMemo<Column<InstallmentRow>[]>(
    () => [
      {
        key: "installment_no",
        label: "#",
        render: (item) => <span className="font-semibold">{item.installment_no}</span>,
      },
      {
        key: "sale_id",
        label: "Sale ID",
        render: (item) => <span>{item.sale_id || item.sale_uuid || item.apartment_sale_id}</span>,
      },
      {
        key: "due_date",
        label: "Due Date",
        render: (item) => {
          const tone = dueDateTone(item);
          const toneClass =
            tone === "overdue"
              ? "border-red-200 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
              : tone === "soon"
                ? "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300"
                : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200";

          return (
            <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
              {toDate(item.due_date)}
            </span>
          );
        },
      },
      {
        key: "amount",
        label: "Amount",
        render: (item) => <span>{money(item.amount)}</span>,
      },
      {
        key: "paid_amount",
        label: "Paid",
        render: (item) => <span>{money(item.paid_amount)}</span>,
      },
      {
        key: "remaining",
        label: "Remaining",
        render: (item) => <span>{money(installmentRemaining(item))}</span>,
      },
      {
        key: "status",
        label: "Status",
        render: (item) => {
          const status = normalizeStatus(item.status);
          return <Badge color={statusColor[status]}>{status}</Badge>;
        },
      },
      {
        key: "pay_action",
        label: "Action",
        render: (item) => {
          const normalized = normalizeStatus(item.status);
          const saleStatus = normalizeSaleStatus(item.sale_status);
          const pendingApproval = saleStatus === "pending";
          const saleBlocked = saleStatus === "cancelled" || saleStatus === "terminated" || saleStatus === "defaulted";
          const disabled =
            normalized === "paid" ||
            normalized === "cancelled" ||
            pendingApproval ||
            saleBlocked ||
            !canPayInstallments;
          const actionLabel = pendingApproval
            ? "Awaiting Approval"
            : saleStatus === "cancelled"
              ? "Sale Cancelled"
              : saleBlocked
                ? "Sale Closed"
                : canPayInstallments
                  ? "Pay"
                  : "View Only";
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={() => openPayForm(item)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLabel}
            </button>
          );
        },
      },
    ],
    [canPayInstallments, openPayForm]
  );

  return (
    <RequirePermission permission={["installments.pay", "sales.create", "sales.approve"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Installments" subtitle="Track pending dues and record installment payments" />

        <Modal
          isOpen={Boolean(payForm.installment)}
          onClose={closePayForm}
          title={payForm.installment ? `Pay Installment #${payForm.installment.installment_no}` : "Pay Installment"}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="Payment Amount"
                type="number"
                value={payForm.amount}
                onChange={(value) => setPayForm((prev) => ({ ...prev, amount: String(value) }))}
                required
              />
              <FormField
                label="Paid Date"
                type="date"
                value={payForm.paidDate}
                onChange={(value) => setPayForm((prev) => ({ ...prev, paidDate: String(value) }))}
                required
              />
              <FormField
                label="Payment Account"
                type="select"
                value={payForm.accountId}
                onChange={(value) => setPayForm((prev) => ({ ...prev, accountId: String(value) }))}
                options={accounts.map((item) => ({ value: String(item.id), label: item.label }))}
                required
              />
            </div>
            {payForm.error && <p className="text-sm text-red-600">{payForm.error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closePayForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payForm.submitting}
                onClick={() => {
                  void handlePay();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {payForm.submitting ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </Modal>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm text-slate-500">Remaining Balance</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{money(totalDue)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm text-slate-500">Overdue Installments</div>
            <div className="mt-2 text-2xl font-semibold text-red-600">{overdueCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm text-slate-500">Paid Installments</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">{paidCount}</div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchKeys={["sale_id", "sale_uuid", "apartment_sale_id", "installment_no", "status", "customer_id", "apartment_id"]}
          pageSize={TABLE_PAGE_SIZE}
        />
      </div>
    </RequirePermission>
  );
}

