"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AccountRow, EmployeeRow, ExchangeRateRow, SalaryAdvanceRow, SalaryPaymentRow } from "@/db/localDB";
import { convertAmountBetweenCurrencies, convertCurrencyToUsd, formatExchangeRate, formatMoney, normalizeCurrency } from "@/lib/currency";
import { employeePullToLocal, employeesListLocal } from "@/modules/employees/employees.repo";
import { accountsListLocal, accountsPullToLocal } from "@/modules/accounts/accounts.repo";
import { exchangeRatesPullToLocal, getActiveExchangeRateLocal } from "@/modules/exchange-rates/exchange-rates.repo";
import {
  employeeSalaryHistoriesPullToLocal,
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
  salaryCurrency: string;
};

type AccountOption = {
  id: number;
  uuid: string;
  label: string;
  currency: string;
  currentBalance: number;
};

type AdvanceFormState = {
  employee_id: string;
  amount: string;
  reason: string;
  status: "pending" | "approved" | "partial_deducted" | "deducted" | "rejected";
};

type PaymentFormState = {
  employee_id: string;
  period: string;
  gross_salary: string;
  salary_currency_code: "USD" | "AFN";
  advance_deducted: string;
  tax_percentage: string;
  other_deductions: string;
  status: "draft" | "paid" | "cancelled";
  account_id: string;
  paid_at: string;
};

type SyncCompleteDetail = {
  syncedAny?: boolean;
  cleaned?: boolean;
  entities?: string[];
};

type PayrollSyncEntity = "employees" | "salary_advances" | "salary_payments" | "accounts" | "exchange_rates";

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const PAYROLL_SYNC_ENTITIES = new Set<PayrollSyncEntity>(["salary_advances", "salary_payments", "employees", "accounts", "exchange_rates"]);
const today = () => new Date().toISOString().slice(0, 10);
const monthValue = () => today().slice(0, 7);

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function money(value: number, currency: string = "USD"): string {
  return formatMoney(value, normalizeCurrency(currency));
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
    salary_currency_code: "USD",
    advance_deducted: "0",
    tax_percentage: "0",
    other_deductions: "0",
    status: "draft",
    account_id: "",
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
    salary_currency_code: normalizeCurrency(row.salary_currency_code ?? "USD"),
    advance_deducted: String(row.advance_deducted ?? 0),
    tax_percentage: String(
      row.tax_percentage ?? (Number(row.gross_salary ?? 0) > 0 ? Number((((row.tax_deducted ?? 0) / Number(row.gross_salary ?? 0)) * 100).toFixed(2)) : 0)
    ),
    other_deductions: String(row.other_deductions ?? 0),
    status: (row.status as PaymentFormState["status"]) || "draft",
    account_id: row.account_id ? String(row.account_id) : "",
    paid_at: row.paid_at ? new Date(row.paid_at).toISOString().slice(0, 10) : today(),
  };
}

export default function PayrollPage() {
  const [tab, setTab] = useState<PayrollTab>("payments");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [activeExchangeRate, setActiveExchangeRate] = useState<ExchangeRateRow | null>(null);
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
    const [employeePage, accountPage, activeRate, advancePage, paymentPage] = await Promise.all([
      employeesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      accountsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      getActiveExchangeRateLocal(),
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
        salaryCurrency: normalizeCurrency(item.salary_currency_code ?? "USD"),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const accountOptions = accountPage.items
      .filter((item: AccountRow) => Number(item.id) > 0)
      .map((item: AccountRow) => ({
        id: Number(item.id),
        uuid: item.uuid,
        label: `${item.name} (${item.currency})`,
        currency: item.currency,
        currentBalance: Number(item.current_balance ?? 0),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setEmployees(employeeOptions);
    setAccounts(accountOptions);
    setActiveExchangeRate(activeRate);
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
    const entitiesToPull = options?.entitiesToPull ?? ["employees", "accounts", "exchange_rates", "salary_advances", "salary_payments"];

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
        if (entitiesToPull.includes("accounts")) {
          tasks.push(accountsPullToLocal());
        }
        if (entitiesToPull.includes("exchange_rates")) {
          tasks.push(exchangeRatesPullToLocal());
        }
        if (entitiesToPull.includes("salary_advances")) {
          tasks.push(salaryAdvancesPullToLocal());
        }
        if (entitiesToPull.includes("salary_payments")) {
          tasks.push(salaryPaymentsPullToLocal());
        }
        tasks.push(employeeSalaryHistoriesPullToLocal());
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

      const nextEntities = new Set<PayrollSyncEntity>(touchedPayrollData);
      if (nextEntities.has("salary_payments")) {
        nextEntities.add("accounts");
      }

      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: Array.from(nextEntities) });
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

  const accountOptions = useMemo(
    () => accounts.map((item) => ({ value: String(item.id), label: item.label })),
    [accounts]
  );

  const advanceSummary = useMemo(() => {
    const approved = advances.filter((row) => row.status === "approved");
    const pending = advances.filter((row) => row.status === "pending");
    return {
      approvedCount: approved.length,
      approvedAmountUsd: approved.reduce(
        (sum, row) =>
          sum +
          Number(
            convertCurrencyToUsd(
              Number(row.amount ?? 0),
              normalizeCurrency(row.currency_code ?? "USD"),
              Number(activeExchangeRate?.rate ?? 0) || null
            ) ?? 0
          ),
        0
      ),
      pendingCount: pending.length,
    };
  }, [activeExchangeRate, advances]);

  const paymentSummary = useMemo(() => {
    const paid = payments.filter((row) => row.status === "paid");
    return {
      paidCount: paid.length,
      totalNetUsd: paid.reduce((sum, row) => sum + Number(row.net_salary_usd ?? convertCurrencyToUsd(Number(row.net_salary ?? 0), normalizeCurrency(row.salary_currency_code ?? "USD"), Number(activeExchangeRate?.rate ?? 0) || null) ?? 0), 0),
      totalGrossUsd: paid.reduce((sum, row) => sum + Number(row.gross_salary_usd ?? convertCurrencyToUsd(Number(row.gross_salary ?? 0), normalizeCurrency(row.salary_currency_code ?? "USD"), Number(activeExchangeRate?.rate ?? 0) || null) ?? 0), 0),
    };
  }, [activeExchangeRate, payments]);

  const currentNetSalary = useMemo(() => {
    const gross = Number(paymentForm.gross_salary || 0);
    const advanceDeducted = Math.min(gross, Math.max(0, Number(paymentForm.advance_deducted || 0)));
    const taxDeducted = Math.min(gross, Number((gross * (Math.min(100, Math.max(0, Number(paymentForm.tax_percentage || 0))) / 100)).toFixed(2)));
    const otherDeductions = Math.min(gross, Math.max(0, Number(paymentForm.other_deductions || 0)));
    return Math.max(0, gross - advanceDeducted - taxDeducted - otherDeductions);
  }, [paymentForm.advance_deducted, paymentForm.gross_salary, paymentForm.other_deductions, paymentForm.tax_percentage]);

  const currentTaxDeducted = useMemo(() => {
    const gross = Number(paymentForm.gross_salary || 0);
    const taxPercentage = Math.min(100, Math.max(0, Number(paymentForm.tax_percentage || 0)));
    return Math.min(gross, Number((gross * (taxPercentage / 100)).toFixed(2)));
  }, [paymentForm.gross_salary, paymentForm.tax_percentage]);

  const selectedEmployee = useMemo(
    () => employees.find((item) => String(item.id) === paymentForm.employee_id) ?? null,
    [employees, paymentForm.employee_id]
  );

  const selectedAdvanceEmployee = useMemo(
    () => employees.find((item) => String(item.id) === advanceForm.employee_id) ?? null,
    [advanceForm.employee_id, employees]
  );

  const selectedSalaryCurrency = useMemo(
    () => normalizeCurrency(paymentForm.salary_currency_code || selectedEmployee?.salaryCurrency || "USD"),
    [paymentForm.salary_currency_code, selectedEmployee]
  );

  const selectedAccount = useMemo(
    () => accounts.find((item) => String(item.id) === paymentForm.account_id) ?? null,
    [accounts, paymentForm.account_id]
  );

  const selectedAccountCurrency = useMemo(
    () => normalizeCurrency(selectedAccount?.currency ?? "USD"),
    [selectedAccount]
  );

  const selectedAccountRateSnapshot = useMemo(() => {
    if (!selectedAccount) return null;
    if (selectedAccountCurrency === selectedSalaryCurrency) return 1;
    const rate = Number(activeExchangeRate?.rate ?? 0);
    return rate > 0 ? rate : null;
  }, [activeExchangeRate, selectedAccount, selectedAccountCurrency, selectedSalaryCurrency]);

  const selectedAccountPaymentAmount = useMemo(() => {
    if (!selectedAccount) return null;
    return convertAmountBetweenCurrencies(currentNetSalary, selectedSalaryCurrency, selectedAccountCurrency, selectedAccountRateSnapshot);
  }, [currentNetSalary, selectedAccount, selectedAccountCurrency, selectedAccountRateSnapshot, selectedSalaryCurrency]);

  const editingPaymentRestoredAccountAmount = useMemo(() => {
    if (!editingPayment || editingPayment.status !== "paid" || !selectedAccount) return 0;
    if (Number(editingPayment.account_id ?? 0) !== Number(selectedAccount.id)) return 0;

    if (editingPayment.net_salary_account_amount !== null && editingPayment.net_salary_account_amount !== undefined) {
      return Number(editingPayment.net_salary_account_amount ?? 0);
    }

    const previousAccountCurrency = normalizeCurrency(editingPayment.payment_currency_code ?? editingPayment.account_currency ?? selectedAccount.currency);
    const previousSalaryCurrency = normalizeCurrency(editingPayment.salary_currency_code ?? "USD");
    const previousRate =
      previousAccountCurrency === previousSalaryCurrency
        ? 1
        : Number(editingPayment.exchange_rate_snapshot ?? editingPayment.salary_exchange_rate_snapshot ?? activeExchangeRate?.rate ?? 0) || null;
    return (
      convertAmountBetweenCurrencies(Number(editingPayment.net_salary ?? 0), previousSalaryCurrency, previousAccountCurrency, previousRate) ?? 0
    );
  }, [activeExchangeRate, editingPayment, selectedAccount]);

  const effectiveSelectedAccountBalance = useMemo(() => {
    if (!selectedAccount) return 0;

    const editingUsesSamePaidAccount =
      Boolean(editingPayment) &&
      editingPayment?.status === "paid" &&
      Number(editingPayment.account_id ?? 0) === Number(selectedAccount.id);

    if (!editingUsesSamePaidAccount) {
      return Number(selectedAccount.currentBalance ?? 0);
    }

    return Number((Number(selectedAccount.currentBalance ?? 0) + editingPaymentRestoredAccountAmount).toFixed(2));
  }, [editingPayment, editingPaymentRestoredAccountAmount, selectedAccount]);

  const missingExchangeRateForSelectedAccount = useMemo(() => {
    return paymentForm.status === "paid" && Boolean(selectedAccount) && selectedAccountCurrency !== selectedSalaryCurrency && selectedAccountRateSnapshot === null;
  }, [paymentForm.status, selectedAccount, selectedAccountCurrency, selectedAccountRateSnapshot, selectedSalaryCurrency]);

  const accountBalanceInsufficient = useMemo(() => {
    if (paymentForm.status !== "paid" || !selectedAccount) return false;
    if (selectedAccountPaymentAmount === null) return false;
    return effectiveSelectedAccountBalance < selectedAccountPaymentAmount;
  }, [effectiveSelectedAccountBalance, paymentForm.status, selectedAccount, selectedAccountPaymentAmount]);

  const availableAdvanceBalance = useMemo(() => {
    if (!selectedEmployee) return 0;
    const rateSnapshot = Number(activeExchangeRate?.rate ?? 0) || null;
    return advances
      .filter((item) => Number(item.employee_id) === Number(selectedEmployee.id))
      .filter((item) => ["approved", "partial_deducted"].includes(String(item.status)))
      .reduce((sum, item) => {
        const converted = convertAmountBetweenCurrencies(
          Number(item.remaining_amount ?? 0),
          normalizeCurrency(item.currency_code ?? selectedEmployee.salaryCurrency ?? "USD"),
          selectedSalaryCurrency,
          rateSnapshot
        );
        return sum + Number(converted ?? 0);
      }, 0);
  }, [activeExchangeRate, advances, selectedEmployee, selectedSalaryCurrency]);

  const suggestedAdvanceDeduction = useMemo(() => {
    const gross = Number(paymentForm.gross_salary || 0);
    const taxDeducted = currentTaxDeducted;
    const otherDeductions = Math.max(0, Number(paymentForm.other_deductions || 0));
    const maxAllowed = Math.max(0, gross - taxDeducted - otherDeductions);
    return Math.min(availableAdvanceBalance, maxAllowed);
  }, [availableAdvanceBalance, currentTaxDeducted, paymentForm.gross_salary, paymentForm.other_deductions]);

  useEffect(() => {
    if (!paymentFormOpen || editingPayment || !selectedEmployee) return;
    setPaymentForm((prev) => {
      const currentGross = Number(prev.gross_salary || 0);
      if (currentGross > 0) return prev;
      return {
        ...prev,
        gross_salary: String(selectedEmployee.baseSalary || 0),
        salary_currency_code: normalizeCurrency(selectedEmployee.salaryCurrency || "USD"),
      };
    });
  }, [editingPayment, paymentFormOpen, selectedEmployee]);

  useEffect(() => {
    if (!paymentFormOpen || editingPayment || !selectedEmployee) return;
    setPaymentForm((prev) => {
      const currentAdvance = Number(prev.advance_deducted || 0);
      if (currentAdvance > 0) return prev;
      return {
        ...prev,
        advance_deducted: String(Number(suggestedAdvanceDeduction.toFixed(2))),
      };
    });
  }, [editingPayment, paymentFormOpen, selectedEmployee, suggestedAdvanceDeduction]);

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
        currency_code: editingAdvance?.currency_code || selectedAdvanceEmployee?.salaryCurrency || "USD",
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
  }, [advanceForm, closeAdvanceForm, editingAdvance?.currency_code, editingAdvance?.uuid, loadLocal, saving, selectedAdvanceEmployee?.salaryCurrency]);

  const submitPayment = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setPaymentFormError(null);
    try {
      if (paymentForm.status === "paid" && selectedAccount && missingExchangeRateForSelectedAccount) {
        throw new Error("No active USD to AFN exchange rate is available for the selected payment account.");
      }

      if (
        paymentForm.status === "paid" &&
        selectedAccount &&
        selectedAccountPaymentAmount !== null &&
        effectiveSelectedAccountBalance < selectedAccountPaymentAmount
      ) {
        throw new Error("Selected account balance is smaller than the converted salary payment amount.");
      }

      const payload: SalaryPaymentInput = {
        employee_id: Number(paymentForm.employee_id),
        period: paymentForm.period,
        gross_salary: Number(paymentForm.gross_salary),
        advance_deducted: Number(paymentForm.advance_deducted),
        tax_percentage: Number(paymentForm.tax_percentage),
        tax_deducted: currentTaxDeducted,
        other_deductions: Number(paymentForm.other_deductions),
        net_salary: currentNetSalary,
        salary_currency_code: selectedSalaryCurrency,
        status: paymentForm.status,
        account_id: paymentForm.account_id ? Number(paymentForm.account_id) : null,
        paid_at: paymentForm.status === "paid" ? paymentForm.paid_at : null,
      };
      if (editingPayment?.uuid) {
        await salaryPaymentUpdate(editingPayment.uuid, payload);
      } else {
        await salaryPaymentCreate(payload);
      }
      closePaymentForm();
      await salaryAdvancesPullToLocal();
      await loadLocal();
    } catch (error: unknown) {
      setPaymentFormError(error instanceof Error ? error.message : "Unable to save salary payment.");
    } finally {
      setSaving(false);
    }
  }, [
    closePaymentForm,
    currentNetSalary,
    currentTaxDeducted,
    editingPayment?.uuid,
    effectiveSelectedAccountBalance,
    loadLocal,
    missingExchangeRateForSelectedAccount,
    paymentForm,
    saving,
    selectedAccount,
    selectedAccountPaymentAmount,
    selectedSalaryCurrency,
  ]);

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
      { key: "deducted_amount", label: "Deducted", render: (item) => money(Number(item.deducted_amount ?? 0)) },
      { key: "remaining_amount", label: "Remaining", render: (item) => <span className="font-semibold">{money(Number(item.remaining_amount ?? 0))}</span> },
      { key: "reason", label: "Reason", render: (item) => <span>{item.reason || "-"}</span> },
      {
        key: "status",
        label: "Status",
        render: (item) => (
          <Badge color={item.status === "approved" ? "emerald" : item.status === "partial_deducted" ? "blue" : item.status === "deducted" ? "purple" : item.status === "rejected" ? "red" : "amber"}>
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
      { key: "gross_salary", label: "Gross", render: (item) => money(Number(item.gross_salary ?? 0), item.salary_currency_code || "USD") },
      { key: "advance_deducted", label: "Advance", render: (item) => money(Number(item.advance_deducted ?? 0), item.salary_currency_code || "USD") },
      { key: "tax_deducted", label: "Tax", render: (item) => `${Number(item.tax_percentage ?? 0).toFixed(2)}% (${money(Number(item.tax_deducted ?? 0), item.salary_currency_code || "USD")})` },
      { key: "other_deductions", label: "Other", render: (item) => money(Number(item.other_deductions ?? 0), item.salary_currency_code || "USD") },
      { key: "net_salary", label: "Net", render: (item) => <span className="font-semibold text-emerald-700 dark:text-emerald-400">{money(Number(item.net_salary ?? 0), item.salary_currency_code || "USD")}</span> },
      {
        key: "net_salary_account_amount",
        label: "Payout",
        render: (item) =>
          item.net_salary_account_amount !== null && item.net_salary_account_amount !== undefined
            ? money(Number(item.net_salary_account_amount ?? 0), item.payment_currency_code || item.account_currency || "USD")
            : "-",
      },
      {
        key: "account_name",
        label: "Paid From",
        render: (item) => <span>{item.account_name ? `${item.account_name} (${item.payment_currency_code || item.account_currency || "USD"})` : "-"}</span>,
      },
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
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(advanceSummary.approvedAmountUsd, "USD")}</div>
            <div className="mt-1 text-xs text-slate-500">{advanceSummary.approvedCount} approved, {advanceSummary.pendingCount} pending (USD eq.)</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Paid Salary</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(paymentSummary.totalNetUsd, "USD")}</div>
            <div className="mt-1 text-xs text-slate-500">{paymentSummary.paidCount} paid records, gross {money(paymentSummary.totalGrossUsd, "USD")} (USD eq.)</div>
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
                { value: "partial_deducted", label: "Partial Deducted" },
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
              onChange={(value) => {
                const nextEmployeeId = String(value);
                const nextEmployee = employees.find((item) => String(item.id) === nextEmployeeId) ?? null;
                setPaymentForm((prev) => ({
                  ...prev,
                  employee_id: nextEmployeeId,
                  gross_salary: !editingPayment && nextEmployee ? String(nextEmployee.baseSalary || 0) : prev.gross_salary,
                  salary_currency_code: !editingPayment && nextEmployee ? normalizeCurrency(nextEmployee.salaryCurrency || "USD") : prev.salary_currency_code,
                  advance_deducted: !editingPayment ? "0" : prev.advance_deducted,
                }));
              }}
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
              label={`Gross Salary (${selectedSalaryCurrency})`}
              type="number"
              value={paymentForm.gross_salary}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, gross_salary: String(value) }))}
              required
            />
            <FormField
              label={`Advance Deducted (${selectedSalaryCurrency})`}
              type="number"
              value={paymentForm.advance_deducted}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, advance_deducted: String(value) }))}
            />
            <FormField
              label="Tax Percentage (%)"
              type="number"
              value={paymentForm.tax_percentage}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, tax_percentage: String(value) }))}
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
              label="Payment Account"
              type="select"
              value={paymentForm.account_id}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, account_id: String(value) }))}
              options={accountOptions}
              placeholder="Select account"
            />
            <FormField
              label="Paid At"
              type="date"
              value={paymentForm.paid_at}
              onChange={(value) => setPaymentForm((prev) => ({ ...prev, paid_at: String(value) }))}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-200">
            Salary currency for this payroll record: <span className="font-semibold">{selectedSalaryCurrency}</span>
          </div>
          {selectedAccount && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-200">
              Selected account balance: <span className="font-semibold">{money(selectedAccount.currentBalance, selectedAccount.currency)}</span>
              <span className="ml-2 text-slate-500">({selectedAccount.currency})</span>
            </div>
          )}
          {selectedAccount && selectedAccountCurrency !== selectedSalaryCurrency && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              Official rate in use: <span className="font-semibold">{formatExchangeRate(selectedAccountRateSnapshot)}</span>
            </div>
          )}
          {selectedAccount && paymentForm.status === "paid" && missingExchangeRateForSelectedAccount && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              No active official USD to AFN rate is cached. Create or sync today&apos;s rate before paying from an AFN account.
            </div>
          )}
          {selectedAccount && paymentForm.status === "paid" && selectedAccountPaymentAmount !== null && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              This payment will post as <span className="font-semibold">{money(selectedAccountPaymentAmount, selectedAccount.currency)}</span> from the selected account.
              <span className="ml-2 text-blue-700/80 dark:text-blue-200/80">Base payroll amount remains {money(currentNetSalary, selectedSalaryCurrency)}.</span>
            </div>
          )}
          {selectedAccount && paymentForm.status === "paid" && accountBalanceInsufficient && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              Insufficient account balance. Available for this payment:{" "}
              <span className="font-semibold">{money(effectiveSelectedAccountBalance, selectedAccount.currency)}</span>. Required converted payout:{" "}
              <span className="font-semibold">{money(selectedAccountPaymentAmount ?? 0, selectedAccount.currency)}</span>.
            </div>
          )}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            Net salary will be saved as <span className="font-semibold">{money(currentNetSalary, selectedSalaryCurrency)}</span>
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
