"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { db, type EmployeeRow, type EmployeeSalaryHistoryRow, type SalaryAdvanceRow, type SalaryPaymentRow } from "@/db/localDB";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { employeeGetLocal, employeePullToLocal } from "@/modules/employees/employees.repo";
import {
  employeeSalaryHistoriesPullToLocal,
  salaryAdvancesPullToLocal,
  salaryPaymentsPullToLocal,
} from "@/modules/payroll/payroll.repo";

function money(value: number, currency: string = "USD"): string {
  return formatMoney(value, normalizeCurrency(currency));
}

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

export default function EmployeeProfilePage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<EmployeeSalaryHistoryRow[]>([]);
  const [payments, setPayments] = useState<SalaryPaymentRow[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvanceRow[]>([]);

  const loadLocal = useCallback(async () => {
    const localEmployee = await employeeGetLocal(uuid);
    setEmployee(localEmployee ?? null);

    if (!localEmployee?.id) {
      setSalaryHistory([]);
      setPayments([]);
      setAdvances([]);
      return;
    }

    const employeeId = Number(localEmployee.id);
    const [historyRows, paymentRows, advanceRows] = await Promise.all([
      db.employee_salary_histories.where("employee_id").equals(employeeId).toArray(),
      db.salary_payments.where("employee_id").equals(employeeId).toArray(),
      db.salary_advances.where("employee_id").equals(employeeId).toArray(),
    ]);

    setSalaryHistory(historyRows.sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0)));
    setPayments(paymentRows.sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0)));
    setAdvances(advanceRows.sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0)));
  }, [uuid]);

  const refresh = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      try {
        await Promise.all([
          employeePullToLocal(),
          employeeSalaryHistoriesPullToLocal(),
          salaryPaymentsPullToLocal(),
          salaryAdvancesPullToLocal(),
        ]);
      } catch {
        // Keep local data.
      }
      await loadLocal();
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh(false);
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const historyColumns = useMemo<Column<EmployeeSalaryHistoryRow>[]>(
    () => [
      { key: "effective_from", label: "Effective From", render: (item) => <span>{toDateLabel(item.effective_from)}</span> },
      {
        key: "previous_salary",
        label: "Previous",
        render: (item) => (
          <span>{item.previous_salary === null ? "-" : money(Number(item.previous_salary), item.previous_salary_currency_code || "USD")}</span>
        ),
      },
      {
        key: "new_salary",
        label: "New Salary",
        render: (item) => (
          <span className="font-semibold">{item.new_salary === null ? "-" : money(Number(item.new_salary), item.new_salary_currency_code || "USD")}</span>
        ),
      },
      { key: "reason", label: "Reason", render: (item) => <span>{item.reason || "-"}</span> },
      { key: "source", label: "Source", render: (item) => <Badge color={item.source === "initial" ? "blue" : "emerald"}>{item.source || "manual"}</Badge> },
    ],
    []
  );

  const paymentColumns = useMemo<Column<SalaryPaymentRow>[]>(
    () => [
      { key: "period", label: "Period", render: (item) => <span className="font-semibold">{item.period}</span> },
      { key: "gross_salary", label: "Gross", render: (item) => money(Number(item.gross_salary ?? 0), item.salary_currency_code || "USD") },
      { key: "tax_deducted", label: "Tax", render: (item) => `${Number(item.tax_percentage ?? 0).toFixed(2)}% (${money(Number(item.tax_deducted ?? 0), item.salary_currency_code || "USD")})` },
      { key: "other_deductions", label: "Other", render: (item) => money(Number(item.other_deductions ?? 0), item.salary_currency_code || "USD") },
      { key: "net_salary", label: "Net", render: (item) => <span className="font-semibold">{money(Number(item.net_salary ?? 0), item.salary_currency_code || "USD")}</span> },
      {
        key: "net_salary_account_amount",
        label: "Payout",
        render: (item) =>
          item.net_salary_account_amount !== null && item.net_salary_account_amount !== undefined
            ? formatMoney(Number(item.net_salary_account_amount ?? 0), normalizeCurrency(item.payment_currency_code ?? item.account_currency ?? "USD"))
            : "-",
      },
      {
        key: "account_name",
        label: "Paid From",
        render: (item) => <span>{item.account_name ? `${item.account_name} (${item.payment_currency_code || item.account_currency || "USD"})` : "-"}</span>,
      },
      { key: "status", label: "Status", render: (item) => <Badge color={item.status === "paid" ? "emerald" : item.status === "cancelled" ? "red" : "blue"}>{item.status}</Badge> },
      { key: "paid_at", label: "Paid At", render: (item) => <span>{toDateLabel(item.paid_at)}</span> },
    ],
    []
  );

  const advanceColumns = useMemo<Column<SalaryAdvanceRow>[]>(
    () => [
      { key: "amount", label: "Amount", render: (item) => <span className="font-semibold">{money(Number(item.amount ?? 0), item.currency_code || "USD")}</span> },
      { key: "deducted_amount", label: "Deducted", render: (item) => <span>{money(Number(item.deducted_amount ?? 0), item.currency_code || "USD")}</span> },
      { key: "remaining_amount", label: "Remaining", render: (item) => <span className="font-semibold">{money(Number(item.remaining_amount ?? 0), item.currency_code || "USD")}</span> },
      { key: "reason", label: "Reason", render: (item) => <span>{item.reason || "-"}</span> },
      { key: "status", label: "Status", render: (item) => <Badge color={item.status === "approved" ? "emerald" : item.status === "partial_deducted" ? "blue" : item.status === "deducted" ? "purple" : item.status === "rejected" ? "red" : "amber"}>{item.status}</Badge> },
      { key: "updated_at", label: "Updated", render: (item) => <span>{toDateLabel(item.updated_at)}</span> },
    ],
    []
  );

  const paidSummary = useMemo(
    () => payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.net_salary_usd ?? 0), 0),
    [payments]
  );
  const approvedAdvances = useMemo(
    () => advances.filter((item) => item.status === "approved").length,
    [advances]
  );

  return (
    <RequirePermission permission="employees.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title={employee ? [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || employee.first_name : "Employee Profile"}
          subtitle="Employee overview, salary history, advances, and payroll activity"
        >
          <Link
            href="/employees"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
          >
            Back to Employees
          </Link>
        </PageHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Current Base Salary</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(Number(employee?.base_salary ?? 0), employee?.salary_currency_code || "USD")}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Total Paid Salary (USD Eq.)</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(paidSummary, "USD")}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Approved Advances</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{approvedAdvances}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Status</div>
            <div className="mt-3">
              <Badge color={employee?.status === "resign" ? "purple" : "emerald"}>{employee?.status || "unknown"}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job Title</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{employee?.job_title || "-"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salary Type</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{employee?.salary_type || "-"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salary Currency</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{employee?.salary_currency_code || "USD"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{employee?.email || "-"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{employee?.phone || "-"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hire Date</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{toDateLabel(employee?.hire_date)}</div>
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-white">{employee?.address || "-"}</div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <PageHeader title="Salary History" subtitle="Every recorded base-salary change for this employee" />
          <DataTable columns={historyColumns} data={salaryHistory} loading={loading} searchKeys={["reason", "source", "changed_by_name"]} pageSize={10} compact />
        </div>

        <div className="mt-8">
          <PageHeader title="Salary Payments" subtitle="Payroll payments made for this employee" />
          <DataTable columns={paymentColumns} data={payments} loading={loading} searchKeys={["period", "status", "account_name"]} pageSize={10} compact />
        </div>

        <div className="mt-8">
          <PageHeader title="Salary Advances" subtitle="Advance requests and deductions history" />
          <DataTable columns={advanceColumns} data={advances} loading={loading} searchKeys={["reason", "status"]} pageSize={10} compact />
        </div>
      </div>
    </RequirePermission>
  );
}
