"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { EmployeeRow, SalaryAdvanceRow, SalaryPaymentRow } from "@/db/localDB";
import { employeePullToLocal, employeesListLocal } from "@/modules/employees/employees.repo";
import {
  salaryAdvanceCreate,
  salaryAdvanceDelete,
  salaryAdvanceUpdate,
  salaryAdvancesListLocal,
  salaryAdvancesPullToLocal,
  salaryPaymentCreate,
  salaryPaymentDelete,
  salaryPaymentUpdate,
  salaryPaymentsListLocal,
  salaryPaymentsPullToLocal,
  type SalaryAdvanceInput,
  type SalaryPaymentInput,
} from "@/modules/payroll/payroll.repo";
import { notifyError } from "@/lib/notify";

type PayrollTab = "payments" | "advances";

type EmployeeOption = {
  id: number;
  uuid: string;
  label: string;
  baseSalary: number;
};

type AdvanceFormState = {
  employee_id: string;
  amount: string;
  reason: string;
  status: "pending" | "approved" | "deducted" | "rejected";
};

type PaymentFormState = {
  employee_id: string;
  period: string;
  gross_salary: string;
  advance_deducted: string;
  status: "draft" | "paid" | "cancelled";
  paid_at: string;
};

type SyncCompleteDetail = {
  syncedAny?: boolean;
  cleaned?: boolean;
  entities?: string[];
};

type PayrollSyncEntity = "employees" | "salary_advances" | "salary_payments";

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const PAYROLL_SYNC_ENTITIES = new Set<PayrollSyncEntity>(["salary_advances", "salary_payments", "employees"]);
const today = () => new Date().toISOString().slice(0, 10);
const monthValue = () => today().slice(0, 7);

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function createEmptyAdvanceForm(): AdvanceFormState {
  return {
    employee_id: "",
    amount: "",
    reason: "",
    status: "pending",
  };
}

function createEmptyPaymentForm(): PaymentFormState {
  return {
    employee_id: "",
    period: monthValue(),
    gross_salary: "0",
    advance_deducted: "0",
    status: "draft",
    paid_at: today(),
  };
}

function normalizeAdvanceForm(row: SalaryAdvanceRow): AdvanceFormState {
  return {
    employee_id: String(row.employee_id),
    amount: String(row.amount ?? 0),
    reason: row.reason ?? "",
    status: (row.status as AdvanceFormState["status"]) || "pending",
  };
}

function normalizePaymentForm(row: SalaryPaymentRow): PaymentFormState {
  return {
    employee_id: String(row.employee_id),
    period: row.period || monthValue(),
    gross_salary: String(row.gross_salary ?? 0),
    advance_deducted: String(row.advance_deducted ?? 0),
    status: (row.status as PaymentFormState["status"]) || "draft",
    paid_at: row.paid_at ? new Date(row.paid_at).toISOString().slice(0, 10) : today(),
  };
}

export default function PayrollPage() {
  const [tab, setTab] = useState<PayrollTab>("payments");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvanceRow[]>([]);
  const [payments, setPayments] = useState<SalaryPaymentRow[]>([]);
  const [advanceFormOpen, setAdvanceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [advanceFormError, setAdvanceFormError] = useState<string | null>(null);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvanceRow | null>(null);
  const [editingPayment, setEditingPayment] = useState<SalaryPaymentRow | null>(null);
  const [advanceForm, setAdvanceForm] = useState<AdvanceFormState>(createEmptyAdvanceForm());
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(createEmptyPaymentForm());
  const [pendingDelete, setPendingDelete] = useState<{ type: PayrollTab; row: SalaryAdvanceRow | SalaryPaymentRow } | null>(null);

  const loadLocal = useCallback(async () => {
    const [employeePage, advancePage, paymentPage] = await Promise.all([
      employeesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      salaryAdvancesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      salaryPaymentsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
    ]);

    const employeeOptions = employeePage.items
      .filter((item) => Number(item.id) > 0)
      .map((item: EmployeeRow) => ({
        id: Number(item.id),
        uuid: item.uuid,
        label: [item.first_name, item.last_name].filter(Boolean).join(" ").trim() || item.email,
        baseSalary: Number(item.base_salary ?? 0),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setEmployees(employeeOptions);
    setAdvances(advancePage.items);
    setPayments(paymentPage.items);
  }, []);

  const refresh = useCallback(async (options?: {
    showLoader?: boolean;
    showFailureToast?: boolean;
    entitiesToPull?: PayrollSyncEntity[];
  }) => {
    const showLoader = options?.showLoader ?? true;
    const showFailureToast = options?.showFailureToast ?? true;
    const entitiesToPull = options?.entitiesToPull ?? ["employees", "salary_advances", "salary_payments"];

    if (showLoader) {
      setLoading(true);
    }
    try {
      await loadLocal();
      if (!entitiesToPull.length) {
        return;
      }

      let pullFailed = false;
      try {
        const tasks: Promise<unknown>[] = [];
        if (entitiesToPull.includes("employees")) {
          tasks.push(employeePullToLocal());
        }
        if (entitiesToPull.includes("salary_advances")) {
          tasks.push(salaryAdvancesPullToLocal());
        }
        if (entitiesToPull.includes("salary_payments")) {
          tasks.push(salaryPaymentsPullToLocal());
        }
        await Promise.all(tasks);
      } catch {
        pullFailed = true;
      }
      await loadLocal();
      if (showFailureToast && pullFailed && advances.length === 0 && payments.length === 0) {
        notifyError("Unable to refresh payroll data from server. Using local data only.");
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [advances.length, loadLocal, payments.length]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<SyncCompleteDetail>).detail;
      if (detail?.cleaned) {
        void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: [] });
        return;
      }

      const entities = Array.isArray(detail?.entities) ? detail.entities : [];
      const touchedPayrollData = entities.filter(
        (entity): entity is PayrollSyncEntity => PAYROLL_SYNC_ENTITIES.has(entity as PayrollSyncEntity)
      );
      if (!touchedPayrollData.length) {
        return;
      }

      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: touchedPayrollData });
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const employeeOptions = useMemo(
    () => employees.map((item) => ({ value: String(item.id), label: item.label })),
    [employees]
  );

  const advanceSummary = useMemo(() => {
    const approved = advances.filter((row) => row.status === "approved");
    const pending = advances.filter((row) => row.status === "pending");
    return {
      approvedCount: approved.length,
      approvedAmount: approved.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      pendingCount: pending.length,
    };
  }, [advances]);

  const paymentSummary = useMemo(() => {
    const paid = payments.filter((row) => row.status === "paid");
    return {
      paidCount: paid.length,
      totalNet: paid.reduce((sum, row) => sum + Number(row.net_salary ?? 0), 0),
      totalGross: paid.reduce((sum, row) => sum + Number(row.gross_salary ?? 0), 0),
    };
  }, [payments]);

  const currentNetSalary = useMemo(() => {
    const gross = Number(paymentForm.gross_salary || 0);
    const advanceDeducted = Math.min(gross, Math.max(0, Number(paymentForm.advance_deducted || 0)));
    return Math.max(0, gross - advanceDeducted);
  }, [paymentForm.advance_deducted, paymentForm.gross_salary]);

  const selectedEmployee = useMemo(
    () => employees.find((item) => String(item.id) === paymentForm.employee_id) ?? null,
    [employees, paymentForm.employee_id]
  );

  useEffect(() => {
    if (!paymentFormOpen || editingPayment || !selectedEmployee) return;
    setPaymentForm((prev) => {
      const currentGross = Number(prev.gross_salary || 0);
      if (currentGross > 0) return prev;
      return {
        ...prev,
        gross_salary: String(selectedEmployee.baseSalary || 0),
      };
    });
  }, [editingPayment, paymentFormOpen, selectedEmployee]);

  const openAdvanceCreate = useCallback(() => {
    setEditingAdvance(null);
    setAdvanceForm(createEmptyAdvanceForm());
    setAdvanceFormError(null);
    setAdvanceFormOpen(true);
  }, []);

  const openPaymentCreate = useCallback(() => {
    setEditingPayment(null);
    setPaymentForm(createEmptyPaymentForm());
    setPaymentFormError(null);
    setPaymentFormOpen(true);
  }, []);

  const closeAdvanceForm = useCallback(() => {
    setAdvanceFormOpen(false);
    setEditingAdvance(null);
    setAdvanceFormError(null);
    setAdvanceForm(createEmptyAdvanceForm());
  }, []);

  const closePaymentForm = useCallback(() => {
    setPaymentFormOpen(false);
    setEditingPayment(null);
    setPaymentFormError(null);
    setPaymentForm(createEmptyPaymentForm());
  }, []);

  const openAdvanceEdit = useCallback((row: SalaryAdvanceRow) => {
    setEditingAdvance(row);
    setAdvanceForm(normalizeAdvanceForm(row));
    setAdvanceFormError(null);
    setAdvanceFormOpen(true);
  }, []);

  const openPaymentEdit = useCallback((row: SalaryPaymentRow) => {
    setEditingPayment(row);
    setPaymentForm(normalizePaymentForm(row));
    setPaymentFormError(null);
    setPaymentFormOpen(true);
  }, []);

  const openPayslipPrintPage = useCallback((row: SalaryPaymentRow) => {
    if (!row.uuid) return;
    window.open(`/print/payroll/${row.uuid}/payslip`, "_blank", "noopener,noreferrer");
  }, []);

  const submitAdvance = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setAdvanceFormError(null);
    try {
      const payload: SalaryAdvanceInput = {
        employee_id: Number(advanceForm.employee_id),
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason,
        status: advanceForm.status,
      };
      if (editingAdvance?.uuid) {
        await salaryAdvanceUpdate(editingAdvance.uuid, payload);
      } else {
        await salaryAdvanceCreate(payload);
      }
      closeAdvanceForm();
      await loadLocal();
    } catch (error: unknown) {
      setAdvanceFormError(error instanceof Error ? error.message : "Unable to save salary advance.");
    } finally {
      setSaving(false);
    }
  }, [advanceForm, closeAdvanceForm, editingAdvance?.uuid, loadLocal, saving]);

  const submitPayment = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setPaymentFormError(null);
    try {
      const payload: SalaryPaymentInput = {
        employee_id: Number(paymentForm.employee_id),
        period: paymentForm.period,
        gross_salary: Number(paymentForm.gross_salary),
        advance_deducted: Number(paymentForm.advance_deducted),
        net_salary: currentNetSalary,
        status: paymentForm.status,
        paid_at: paymentForm.status === "paid" ? paymentForm.paid_at : null,
      };
      if (editingPayment?.uuid) {
        await salaryPaymentUpdate(editingPayment.uuid, payload);
      } else {
        await salaryPaymentCreate(payload);
      }
      closePaymentForm();
      await loadLocal();
    } catch (error: unknown) {
      setPaymentFormError(error instanceof Error ? error.message : "Unable to save salary payment.");
    } finally {
      setSaving(false);
    }
  }, [closePaymentForm, currentNetSalary, editingPayment?.uuid, loadLocal, paymentForm, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === "advances") {
        await salaryAdvanceDelete((pendingDelete.row as SalaryAdvanceRow).uuid);
      } else {
        await salaryPaymentDelete((pendingDelete.row as SalaryPaymentRow).uuid);
      }
      setPendingDelete(null);
      await loadLocal();
    } catch (error) {
      console.error("Payroll delete failed", error);
    }
  }, [loadLocal, pendingDelete]);

  const advanceColumns = useMemo<Column<SalaryAdvanceRow>[]>(
    () => [
      { key: "employee_name", label: "Employee", render: (item) => <span className="font-semibold">{item.employee_name || "-"}</span> },
      { key: "amount", label: "Amount", render: (item) => money(Number(item.amount ?? 0)) },
      { key: "reason", label: "Reason", render: (item) => <span>{item.reason || "-"}</span> },
      {
        key: "status",
        label: "Status",
        render: (item) => (
          <Badge color={item.status === "approved" ? "emerald" : item.status === "deducted" ? "blue" : item.status === "rejected" ? "red" : "amber"}>
            {item.status}
          </Badge>
        ),
      },
      { key: "updated_at", label: "Updated", render: (item) => toDateLabel(item.updated_at) },
    ],
    []
  );

  const paymentColumns = useMemo<Column<SalaryPaymentRow>[]>(
    () => [
      { key: "employee_name", label: "Employee", render: (item) => <span className="font-semibold">{item.employee_name || "-"}</span> },
      { key: "period", label: "Period", render: (item) => <span>{item.period || "-"}</span> },
      { key: "gross_salary", label: "Gross", render: (item) => money(Number(item.gross_salary ?? 0)) },
      { key: "advance_deducted", label: "Advance", render: (item) => money(Number(item.advance_deducted ?? 0)) },
      { key: "net_salary", label: "Net", render: (item) => <span className="font-semibold text-emerald-700 dark:text-emerald-400">{money(Number(item.net_salary ?? 0))}</span> },
      {
        key: "status",
        label: "Status",
        render: (item) => (
          <Badge color={item.status === "paid" ? "emerald" : item.status === "cancelled" ? "red" : "blue"}>{item.status}</Badge>
        ),
      },
      { key: "paid_at", label: "Paid At", render: (item) => toDateLabel(item.paid_at) },
      {
        key: "payslip",
        label: "Payslip",
        render: (item) => (
          <button
            type="button"
            onClick={() => openPayslipPrintPage(item)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
          >
            Print Payslip
          </button>
        ),
      },
    ],
    [openPayslipPrintPage]
  );

  return (
    <RequirePermission permission="payroll.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Payroll" subtitle="Manage salary payments and salary advances with online and offline sync">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("payments")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "payments" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"}`}
            >
              Salary Payments
            </button>
            <button
              type="button"
              onClick={() => setTab("advances")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "advances" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"}`}
            >
              Salary Advances
            </button>
            <button
              type="button"
              onClick={() => {
                if (tab === "payments") {
                  openPaymentCreate();
                } else {
                  openAdvanceCreate();
                }
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              {tab === "payments" ? "Create Salary Payment" : "Create Salary Advance"}
            </button>
          </div>
        </PageHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Employees Cached</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{employees.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Approved Advances</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(advanceSummary.approvedAmount)}</div>
            <div className="mt-1 text-xs text-slate-500">{advanceSummary.approvedCount} approved, {advanceSummary.pendingCount} pending</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Paid Salary</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(paymentSummary.totalNet)}</div>
            <div className="mt-1 text-xs text-slate-500">{paymentSummary.paidCount} paid records, gross {money(paymentSummary.totalGross)}</div>
          </div>
        </div>

        <div className="mt-6">
          {tab === "payments" ? (
            <DataTable
              columns={paymentColumns}
              data={payments}
              loading={loading}
              onEdit={openPaymentEdit}
              onDelete={(row) => setPendingDelete({ type: "payments", row })}
              searchKeys={["employee_name", "period", "status", "user_name"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          ) : (
            <DataTable
              columns={advanceColumns}
              data={advances}
              loading={loading}
              onEdit={openAdvanceEdit}
              onDelete={(row) => setPendingDelete({ type: "advances", row })}
              searchKeys={["employee_name", "reason", "status", "user_name"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
            />
          )}
        </div>
      </div>

      <Modal
        isOpen={advanceFormOpen}
        onClose={closeAdvanceForm}
        title={editingAdvance ? "Edit Salary Advance" : "Create Salary Advance"}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Employee"
              type="select"
              value={advanceForm.employee_id}
              onChange={(value) => setAdvanceForm((prev) => ({ ...prev, employee_id: String(value) }))}
              options={employeeOptions}
              required
            />
            <FormField
              label="Amount"
              type="number"
              value={advanceForm.amount}
              onChange={(value) => setAdvanceForm((prev) => ({ ...prev, amount: String(value) }))}
              required
            />
            <FormField
              label="Status"
              type="select"
              value={advanceForm.status}
              onChange={(value) =>
                setAdvanceForm((prev) => ({
                  ...prev,
                  status: String(value) as AdvanceFormState["status"],
                }))
              }
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "deducted", label: "Deducted" },
                { value: "rejected", label: "Rejected" },
              ]}
              required
            />
          </div>
          <FormField
            label="Reason"
            type="textarea"
            value={advanceForm.reason}
            onChange={(value) => setAdvanceForm((prev) => ({ ...prev, reason: String(value) }))}
            placeholder="Advance reason"
            rows={4}
          />
          {advanceFormError && <p className="text-sm text-red-600">{advanceFormError}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeAdvanceForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void submitAdvance();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editingAdvance ? "Update Advance" : "Create Advance"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={paymentFormOpen}
        onClose={closePaymentForm}
        title={editingPayment ? "Edit Salary Payment" : "Create Salary Payment"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              label="Employee"
              type="select"
              value={paymentForm.employee_id}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, employee_id: String(value) }))}
              options={employeeOptions}
              required
            />
            <FormField
              label="Period"
              value={paymentForm.period}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, period: String(value) }))}
              placeholder="YYYY-MM"
              required
            />
            <FormField
              label="Gross Salary"
              type="number"
              value={paymentForm.gross_salary}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, gross_salary: String(value) }))}
              required
            />
            <FormField
              label="Advance Deducted"
              type="number"
              value={paymentForm.advance_deducted}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, advance_deducted: String(value) }))}
            />
            <FormField
              label="Status"
              type="select"
              value={paymentForm.status}
              onChange={(value) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  status: String(value) as PaymentFormState["status"],
                }))
              }
              options={[
                { value: "draft", label: "Draft" },
                { value: "paid", label: "Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              required
            />
            <FormField
              label="Paid At"
              type="date"
              value={paymentForm.paid_at}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, paid_at: String(value) }))}
            />
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            Net salary will be saved as <span className="font-semibold">{money(currentNetSalary)}</span>
          </div>
          {paymentFormError && <p className="text-sm text-red-600">{paymentFormError}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closePaymentForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void submitPayment();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editingPayment ? "Update Payment" : "Create Payment"}
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
        title={pendingDelete?.type === "payments" ? "Delete Salary Payment" : "Delete Salary Advance"}
        message={`Are you sure you want to delete this ${pendingDelete?.type === "payments" ? "salary payment" : "salary advance"}?`}
      />
    </RequirePermission>
  );
}
