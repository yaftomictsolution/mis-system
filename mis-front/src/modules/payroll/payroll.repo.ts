import {
  type AccountRow,
  db,
  type EmployeeRow,
  type ExchangeRateRow,
  type SalaryAdvanceDeductionRow,
  type EmployeeSalaryHistoryRow,
  type SalaryAdvanceRow,
  type SalaryPaymentRow,
} from "@/db/localDB";
import { api } from "@/lib/api";
import { convertAmountBetweenCurrencies, normalizeCurrency, roundMoney, roundRate } from "@/lib/currency";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { accountTransactionsPullToLocal, accountsPullToLocal } from "@/modules/accounts/accounts.repo";
import { getOfflineModuleRetentionDays } from "@/modules/offline-policy/offline-policy.repo";
import { enqueueSync } from "@/sync/queue";

const RETENTION_DAYS = 180;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const ADVANCES_CURSOR_KEY = "salary_advances_sync_cursor";
const PAYMENTS_CURSOR_KEY = "salary_payments_sync_cursor";
const HISTORY_CURSOR_KEY = "employee_salary_histories_sync_cursor";
const ADVANCES_CLEANUP_KEY = "salary_advances_last_cleanup_ms";
const PAYMENTS_CLEANUP_KEY = "salary_payments_last_cleanup_ms";
const HISTORY_CLEANUP_KEY = "employee_salary_histories_last_cleanup_ms";
const isValidationError = (status?: number) => status === 409 || status === 422;

type Obj = Record<string, unknown>;

type PayrollLocalQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
};

type PayrollLocalPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type SalaryAdvanceInput = {
  employee_id: number;
  amount: number;
  currency_code?: string | null;
  reason?: string | null;
  status?: string;
  user_id?: number | null;
};

export type SalaryPaymentInput = {
  employee_id: number;
  period: string;
  gross_salary: number;
  salary_currency_code?: string | null;
  advance_deducted?: number;
  tax_percentage?: number;
  tax_deducted?: number;
  other_deductions?: number;
  net_salary?: number;
  status?: string;
  account_id?: number | null;
  user_id?: number | null;
  paid_at?: string | null;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const obj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});
const nowIso = () => new Date().toISOString();

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function lsSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function lsRemove(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function lsNum(key: string): number | null {
  const raw = lsGet(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimText(value: unknown, max = 255): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function trimOrNull(value: unknown, max = 1000): string | null {
  const trimmed = trimText(value, max);
  return trimmed || null;
}

function toTs(value: unknown, fallback = Date.now()): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableTs(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return toTs(value);
}

function toId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
}

function toMoney(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(2));
}

function normalizeAdvanceStatus(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "approved" || normalized === "partial_deducted" || normalized === "deducted" || normalized === "rejected") return normalized;
  return "pending";
}

function normalizePaymentStatus(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "paid" || normalized === "cancelled") return normalized;
  return "draft";
}

function isDeletedRecord(input: unknown): boolean {
  const record = obj(input);
  return record.deleted_at !== null && record.deleted_at !== undefined && String(record.deleted_at).trim() !== "";
}

function deriveIdFromUuid(uuid: string): number {
  let hash = 0;
  for (let index = 0; index < uuid.length; index += 1) {
    hash = (hash * 31 + uuid.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
}

function toRowId(value: unknown, uuid: string): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return deriveIdFromUuid(uuid);
}

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function parsePayload(payload: unknown): { list: Obj[]; hasMore: boolean; serverTime: string } {
  if (Array.isArray(payload)) {
    return { list: payload.map(obj), hasMore: false, serverTime: nowIso() };
  }

  const root = obj(payload);
  const meta = obj(root.meta);
  const topData = root.data;

  if (Array.isArray(topData)) {
    return {
      list: topData.map(obj),
      hasMore: Boolean(meta.has_more),
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  const paged = obj(topData);
  if (Array.isArray(paged.data)) {
    const currentPage = Number(paged.current_page ?? 1);
    const lastPage = Number(paged.last_page ?? 1);
    return {
      list: paged.data.map(obj),
      hasMore: currentPage < lastPage,
      serverTime: String(meta.server_time ?? nowIso()),
    };
  }

  return { list: [], hasMore: false, serverTime: nowIso() };
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

async function removeLatestQueueItem(entity: string, uuid: string, action: "create" | "update"): Promise<void> {
  const items = await db.sync_queue.where("uuid").equals(uuid).toArray();
  const target = items
    .filter((item) => item.entity === entity && item.action === action)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (target?.id !== undefined) {
    await db.sync_queue.delete(target.id);
  }
}

async function getEmployeeSnapshot(employeeId: number): Promise<EmployeeRow | undefined> {
  const direct = await db.employees.filter((item) => Number(item.id) === employeeId).first();
  if (direct) return direct;
  return db.employees.where("updated_at").above(0).filter((item) => Number(item.id) === employeeId).first();
}

async function getEmployeeDecorators(employeeId: number): Promise<{
  employee_uuid: string | null;
  employee_name: string | null;
}> {
  const employee = await getEmployeeSnapshot(employeeId);
  if (!employee) {
    return { employee_uuid: null, employee_name: null };
  }

  const employeeName = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim();
  return {
    employee_uuid: employee.uuid || null,
    employee_name: employeeName || employee.first_name || null,
  };
}

function matchesAdvanceSearch(row: SalaryAdvanceRow, query: string): boolean {
  return [row.employee_name, row.amount, row.deducted_amount, row.remaining_amount, row.reason, row.status, row.user_name].some((value) =>
    String(value ?? "").toLowerCase().includes(query)
  );
}

function matchesPaymentSearch(row: SalaryPaymentRow, query: string): boolean {
  return [
    row.employee_name,
    row.period,
    row.gross_salary,
    row.advance_deducted,
    row.tax_percentage,
    row.tax_deducted,
    row.other_deductions,
    row.net_salary,
    row.status,
    row.user_name,
    row.account_name,
    row.payment_currency_code,
    row.net_salary_account_amount,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function matchesHistorySearch(row: EmployeeSalaryHistoryRow, query: string): boolean {
  return [
    row.employee_name,
    row.previous_salary,
    row.new_salary,
    row.reason,
    row.changed_by_name,
    row.source,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function sanitizeAdvance(input: unknown): SalaryAdvanceRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  const amount = toMoney(record.amount);
  const deductedAmount = Math.min(amount, Math.max(0, toMoney(record.deducted_amount)));
  const remainingAmount = Math.max(0, toMoney(record.remaining_amount, Number((amount - deductedAmount).toFixed(2))));
  return {
    id: toRowId(record.id, uuid),
    uuid,
    employee_id: toId(record.employee_id),
    employee_uuid: trimOrNull(record.employee_uuid, 100),
    employee_name: trimOrNull(record.employee_name, 255),
    amount,
    currency_code: trimOrNull(record.currency_code, 10)?.toUpperCase() || "USD",
    deducted_amount: deductedAmount,
    remaining_amount: remainingAmount,
    user_id: record.user_id === null || record.user_id === undefined ? null : toId(record.user_id),
    user_name: trimOrNull(record.user_name, 255),
    reason: trimOrNull(record.reason, 5000),
    status: normalizeAdvanceStatus(record.status),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizePayment(input: unknown): SalaryPaymentRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  const grossSalary = toMoney(record.gross_salary);
  const advanceDeducted = Math.min(grossSalary, Math.max(0, toMoney(record.advance_deducted)));
  const taxPercentage = Math.min(100, Math.max(0, toMoney(record.tax_percentage)));
  const taxDeducted = Math.min(grossSalary, Math.max(0, toMoney(record.tax_deducted)));
  const otherDeductions = Math.min(grossSalary, Math.max(0, toMoney(record.other_deductions)));
  return {
    id: toRowId(record.id, uuid),
    uuid,
    employee_id: toId(record.employee_id),
    employee_uuid: trimOrNull(record.employee_uuid, 100),
    employee_name: trimOrNull(record.employee_name, 255),
    period: trimText(record.period, 100),
    gross_salary: grossSalary,
    gross_salary_usd:
      record.gross_salary_usd === null || record.gross_salary_usd === undefined ? null : toMoney(record.gross_salary_usd),
    salary_currency_code: trimOrNull(record.salary_currency_code, 10)?.toUpperCase() || "USD",
    salary_exchange_rate_snapshot:
      record.salary_exchange_rate_snapshot === null || record.salary_exchange_rate_snapshot === undefined
        ? null
        : Number(Number(record.salary_exchange_rate_snapshot).toFixed(6)),
    advance_deducted: advanceDeducted,
    advance_deducted_usd:
      record.advance_deducted_usd === null || record.advance_deducted_usd === undefined ? null : toMoney(record.advance_deducted_usd),
    tax_percentage:
      taxPercentage > 0 ? taxPercentage : grossSalary > 0 ? Number(((taxDeducted / grossSalary) * 100).toFixed(2)) : 0,
    tax_deducted: taxDeducted,
    tax_deducted_usd:
      record.tax_deducted_usd === null || record.tax_deducted_usd === undefined ? null : toMoney(record.tax_deducted_usd),
    other_deductions: otherDeductions,
    other_deductions_usd:
      record.other_deductions_usd === null || record.other_deductions_usd === undefined ? null : toMoney(record.other_deductions_usd),
    net_salary: toMoney(record.net_salary, Number((grossSalary - advanceDeducted - taxDeducted - otherDeductions).toFixed(2))),
    net_salary_usd:
      record.net_salary_usd === null || record.net_salary_usd === undefined ? null : toMoney(record.net_salary_usd),
    status: normalizePaymentStatus(record.status),
    account_id: record.account_id === null || record.account_id === undefined ? null : toId(record.account_id),
    account_uuid: trimOrNull(record.account_uuid, 100),
    account_name: trimOrNull(record.account_name, 255),
    account_currency: trimOrNull(record.account_currency, 10),
    account_transaction_uuid: trimOrNull(record.account_transaction_uuid, 100),
    payment_currency_code: trimOrNull(record.payment_currency_code, 10),
    exchange_rate_snapshot:
      record.exchange_rate_snapshot === null || record.exchange_rate_snapshot === undefined
        ? null
        : Number(Number(record.exchange_rate_snapshot).toFixed(6)),
    net_salary_account_amount:
      record.net_salary_account_amount === null || record.net_salary_account_amount === undefined ? null : toMoney(record.net_salary_account_amount),
    user_id: record.user_id === null || record.user_id === undefined ? null : toId(record.user_id),
    user_name: trimOrNull(record.user_name, 255),
    paid_at: toNullableTs(record.paid_at),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function sanitizeSalaryHistory(input: unknown): EmployeeSalaryHistoryRow {
  const record = obj(input);
  const uuid = trimText(record.uuid, 100);
  return {
    id: toRowId(record.id, uuid),
    uuid,
    employee_id: toId(record.employee_id),
    employee_uuid: trimOrNull(record.employee_uuid, 100),
    employee_name: trimOrNull(record.employee_name, 255),
    previous_salary:
      record.previous_salary === null || record.previous_salary === undefined ? null : toMoney(record.previous_salary),
    previous_salary_currency_code: trimOrNull(record.previous_salary_currency_code, 10)?.toUpperCase() || null,
    new_salary:
      record.new_salary === null || record.new_salary === undefined ? null : toMoney(record.new_salary),
    new_salary_currency_code: trimOrNull(record.new_salary_currency_code, 10)?.toUpperCase() || null,
    effective_from: toNullableTs(record.effective_from),
    reason: trimOrNull(record.reason, 5000),
    changed_by: record.changed_by === null || record.changed_by === undefined ? null : toId(record.changed_by),
    changed_by_name: trimOrNull(record.changed_by_name, 255),
    source: trimOrNull(record.source, 50),
    created_at: toTs(record.created_at ?? record.updated_at),
    updated_at: toTs(record.updated_at ?? record.created_at),
  };
}

function getApiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data?.errors && typeof data.errors === "object") {
    for (const key of Object.keys(data.errors)) {
      const value = (data.errors as Obj)[key];
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }

  return "Validation failed on server.";
}

function validateAdvanceInput(input: SalaryAdvanceInput): void {
  if (!Number.isFinite(input.employee_id) || input.employee_id <= 0) {
    throw new Error("Employee is required.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Advance amount must be greater than 0.");
  }
  const advanceCurrency = String(input.currency_code ?? "").trim().toUpperCase();
  if (advanceCurrency && !["USD", "AFN"].includes(advanceCurrency)) {
    throw new Error("Advance currency must be USD or AFN.");
  }
}

function validatePaymentInput(input: SalaryPaymentInput): void {
  if (!Number.isFinite(input.employee_id) || input.employee_id <= 0) {
    throw new Error("Employee is required.");
  }
  if (!input.period.trim()) {
    throw new Error("Salary period is required.");
  }
  if (!Number.isFinite(input.gross_salary) || input.gross_salary < 0) {
    throw new Error("Gross salary must be 0 or greater.");
  }
  const salaryCurrency = String(input.salary_currency_code ?? "").trim().toUpperCase();
  if (salaryCurrency && !["USD", "AFN"].includes(salaryCurrency)) {
    throw new Error("Salary currency must be USD or AFN.");
  }
  if (!Number.isFinite(input.advance_deducted ?? 0) || (input.advance_deducted ?? 0) < 0) {
    throw new Error("Advance deducted must be 0 or greater.");
  }
  if (!Number.isFinite(input.tax_percentage ?? 0) || (input.tax_percentage ?? 0) < 0 || (input.tax_percentage ?? 0) > 100) {
    throw new Error("Tax percentage must be between 0 and 100.");
  }
  if (!Number.isFinite(input.tax_deducted ?? 0) || (input.tax_deducted ?? 0) < 0) {
    throw new Error("Tax deducted must be 0 or greater.");
  }
  if (!Number.isFinite(input.other_deductions ?? 0) || (input.other_deductions ?? 0) < 0) {
    throw new Error("Other deductions must be 0 or greater.");
  }
  const totalDeductions =
    Number(input.advance_deducted ?? 0) +
    Number(input.tax_deducted ?? 0) +
    Number(input.other_deductions ?? 0);
  if (totalDeductions > Number(input.gross_salary)) {
    throw new Error("Total deductions cannot be greater than gross salary.");
  }
  if ((input.status ?? "draft") === "paid" && (!Number.isFinite(input.account_id) || Number(input.account_id) <= 0)) {
    throw new Error("Payment account is required when salary is marked paid.");
  }
}

function toAdvancePayload(input: SalaryAdvanceInput): Obj {
  return {
    employee_id: input.employee_id,
    amount: toMoney(input.amount),
    currency_code: trimText(input.currency_code ?? "USD", 10).toUpperCase() || "USD",
    reason: trimOrNull(input.reason, 5000),
    status: normalizeAdvanceStatus(input.status),
    user_id: input.user_id ?? null,
  };
}

function toPaymentPayload(input: SalaryPaymentInput): Obj {
  const grossSalary = toMoney(input.gross_salary);
  const advanceDeducted = Math.min(grossSalary, Math.max(0, toMoney(input.advance_deducted)));
  const taxPercentage = Math.min(100, Math.max(0, toMoney(input.tax_percentage)));
  const taxDeducted = Math.min(grossSalary, roundToMoney(grossSalary * (taxPercentage / 100)));
  const otherDeductions = Math.min(grossSalary, Math.max(0, toMoney(input.other_deductions)));
  return {
    employee_id: input.employee_id,
    period: trimText(input.period, 100),
    gross_salary: grossSalary,
    salary_currency_code: trimText(input.salary_currency_code ?? "USD", 10).toUpperCase() || "USD",
    advance_deducted: advanceDeducted,
    tax_percentage: taxPercentage,
    tax_deducted: taxDeducted,
    other_deductions: otherDeductions,
    net_salary: Number((grossSalary - advanceDeducted - taxDeducted - otherDeductions).toFixed(2)),
    status: normalizePaymentStatus(input.status),
    account_id: input.account_id ?? null,
    user_id: input.user_id ?? null,
    paid_at: input.paid_at ? new Date(input.paid_at).toISOString() : null,
  };
}

function roundToMoney(value: number): number {
  return Number(value.toFixed(2));
}

async function getActiveExchangeRateSnapshot(): Promise<ExchangeRateRow | null> {
  const rows = await db.exchange_rates.filter((row) => row.is_active).toArray();
  const [active] = rows.sort((left, right) => {
    const leftDate = Number(left.effective_date ?? left.updated_at ?? 0);
    const rightDate = Number(right.effective_date ?? right.updated_at ?? 0);
    return rightDate - leftDate;
  });
  return active ?? null;
}

function deriveAdvanceStatusFromBalances(baseStatus: string, amount: number, deductedAmount: number): string {
  if (amount > 0 && deductedAmount >= amount) return "deducted";
  if (deductedAmount > 0) return "partial_deducted";
  if (baseStatus === "rejected") return "rejected";
  if (baseStatus === "approved") return "approved";
  return "pending";
}

async function getPendingSalaryPaymentQueueUuids(): Promise<Set<string>> {
  const items = await db.sync_queue.where("entity").equals("salary_payments").toArray();
  return new Set(items.map((item) => item.uuid).filter(Boolean));
}

async function getPendingLocalAdvanceDeductions(excludePaymentUuid?: string): Promise<SalaryAdvanceDeductionRow[]> {
  const pendingPaymentUuids = await getPendingSalaryPaymentQueueUuids();
  const rows = await db.salary_advance_deductions.toArray();
  return rows.filter((row) => pendingPaymentUuids.has(row.salary_payment_uuid) && row.salary_payment_uuid !== excludePaymentUuid);
}

function applyPendingAdvanceOverlay(
  advances: SalaryAdvanceRow[],
  deductions: SalaryAdvanceDeductionRow[]
): SalaryAdvanceRow[] {
  const pendingByAdvance = new Map<string, number>();
  for (const deduction of deductions) {
    pendingByAdvance.set(
      deduction.salary_advance_uuid,
      roundToMoney((pendingByAdvance.get(deduction.salary_advance_uuid) ?? 0) + Number(deduction.amount ?? 0))
    );
  }

  return advances.map((advance) => {
    const pendingAmount = pendingByAdvance.get(advance.uuid) ?? 0;
    const amount = roundToMoney(Number(advance.amount ?? 0));
    const deductedAmount = Math.min(amount, roundToMoney(Number(advance.deducted_amount ?? 0) + pendingAmount));
    const remainingAmount = Math.max(0, roundToMoney(amount - deductedAmount));
    return {
      ...advance,
      deducted_amount: deductedAmount,
      remaining_amount: remainingAmount,
      status: deriveAdvanceStatusFromBalances(normalizeAdvanceStatus(advance.status), amount, deductedAmount),
    };
  });
}

async function readAdvancesWithPendingOverlay(excludePaymentUuid?: string): Promise<SalaryAdvanceRow[]> {
  const advances = await db.salary_advances.orderBy("updated_at").reverse().toArray();
  const pendingDeductions = await getPendingLocalAdvanceDeductions(excludePaymentUuid);
  return applyPendingAdvanceOverlay(advances, pendingDeductions);
}

function eligibleAdvanceRowsForEmployee(rows: SalaryAdvanceRow[], employeeId: number): SalaryAdvanceRow[] {
  return rows
    .filter((row) => Number(row.employee_id) === employeeId)
    .filter((row) => ["approved", "partial_deducted"].includes(normalizeAdvanceStatus(row.status)))
    .filter((row) => Number(row.remaining_amount ?? 0) > 0)
    .sort((left, right) => Number(left.created_at ?? left.updated_at ?? 0) - Number(right.created_at ?? right.updated_at ?? 0));
}

async function replaceLocalAdvanceDeductionsForPayment(
  paymentUuid: string,
  employeeId: number,
  requestedDeduction: number,
  paymentCurrency: string
): Promise<void> {
  const existing = await db.salary_advance_deductions
    .where("salary_payment_uuid")
    .equals(paymentUuid)
    .toArray();

  if (existing.length) {
    await db.salary_advance_deductions.bulkDelete(existing.map((item) => item.uuid));
  }

  const normalizedRequested = Math.max(0, roundToMoney(requestedDeduction));
  if (normalizedRequested <= 0) {
    return;
  }

  const normalizedPaymentCurrency = normalizeCurrency(paymentCurrency ?? "USD");
  const activeRate = await getActiveExchangeRateSnapshot();
  const rateSnapshot = Number(activeRate?.rate ?? 0) || null;
  const rows = await readAdvancesWithPendingOverlay(paymentUuid);
  const eligible = eligibleAdvanceRowsForEmployee(rows, employeeId);
  const available = roundToMoney(
    eligible.reduce((sum, row) => {
      const converted = convertAmountBetweenCurrencies(
        Number(row.remaining_amount ?? 0),
        normalizeCurrency(row.currency_code ?? "USD"),
        normalizedPaymentCurrency,
        rateSnapshot
      );
      return sum + Number(converted ?? 0);
    }, 0)
  );

  if (normalizedRequested > available) {
    throw new Error("Advance deducted cannot exceed the employee approved advance balance.");
  }

  const newRows: SalaryAdvanceDeductionRow[] = [];
  let remaining = normalizedRequested;
  for (const advance of eligible) {
    if (remaining <= 0) break;
    const advanceCurrency = normalizeCurrency(advance.currency_code ?? "USD");
    const availableOnAdvance = roundToMoney(
      convertAmountBetweenCurrencies(
        Number(advance.remaining_amount ?? 0),
        advanceCurrency,
        normalizedPaymentCurrency,
        rateSnapshot
      ) ?? 0
    );
    if (availableOnAdvance <= 0) continue;

    const allocation = Math.min(remaining, availableOnAdvance);
    if (allocation <= 0) continue;
    const allocationInAdvanceCurrency = roundToMoney(
      convertAmountBetweenCurrencies(
        allocation,
        normalizedPaymentCurrency,
        advanceCurrency,
        rateSnapshot
      ) ?? 0
    );

    newRows.push({
      uuid: crypto.randomUUID(),
      salary_payment_uuid: paymentUuid,
      salary_advance_uuid: advance.uuid,
      amount: allocationInAdvanceCurrency,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    remaining = roundToMoney(remaining - allocation);
  }

  if (newRows.length) {
    await db.salary_advance_deductions.bulkPut(newRows);
  }
}

async function clearLocalAdvanceDeductionsForPayment(paymentUuid: string): Promise<void> {
  const rows = await db.salary_advance_deductions.where("salary_payment_uuid").equals(paymentUuid).toArray();
  if (rows.length) {
    await db.salary_advance_deductions.bulkDelete(rows.map((item) => item.uuid));
  }
}

async function cleanupSyncedLocalAdvanceDeductions(): Promise<void> {
  const pendingPaymentUuids = await getPendingSalaryPaymentQueueUuids();
  const rows = await db.salary_advance_deductions.toArray();
  const removable = rows
    .filter((row) => !pendingPaymentUuids.has(row.salary_payment_uuid))
    .map((row) => row.uuid);

  if (removable.length) {
    await db.salary_advance_deductions.bulkDelete(removable);
  }
}

export async function getEmployeeApprovedAdvanceBalanceLocal(
  employeeId: number,
  options?: { excludePaymentUuid?: string; targetCurrency?: string | null }
): Promise<number> {
  const targetCurrency = normalizeCurrency(options?.targetCurrency ?? "USD");
  const activeRate = await getActiveExchangeRateSnapshot();
  const rateSnapshot = Number(activeRate?.rate ?? 0) || null;
  const rows = await readAdvancesWithPendingOverlay(options?.excludePaymentUuid);
  return roundToMoney(
    eligibleAdvanceRowsForEmployee(rows, employeeId).reduce((sum, row) => {
      const converted = convertAmountBetweenCurrencies(
        Number(row.remaining_amount ?? 0),
        normalizeCurrency(row.currency_code ?? "USD"),
        targetCurrency,
        rateSnapshot
      );
      return sum + Number(converted ?? 0);
    }, 0)
  );
}

async function decorateAdvance(row: SalaryAdvanceRow): Promise<SalaryAdvanceRow> {
  const decorators = await getEmployeeDecorators(row.employee_id);
  return {
    ...row,
    employee_uuid: row.employee_uuid ?? decorators.employee_uuid,
    employee_name: row.employee_name ?? decorators.employee_name,
  };
}

async function decoratePayment(row: SalaryPaymentRow): Promise<SalaryPaymentRow> {
  const decorators = await getEmployeeDecorators(row.employee_id);
  return {
    ...row,
    employee_uuid: row.employee_uuid ?? decorators.employee_uuid,
    employee_name: row.employee_name ?? decorators.employee_name,
  };
}

export async function salaryAdvancesListLocal(
  query: PayrollLocalQuery = {}
): Promise<PayrollLocalPage<SalaryAdvanceRow>> {
  await salaryAdvancesRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();
  const allRows = await readAdvancesWithPendingOverlay();

  if (!search) {
    const total = allRows.length;
    const items = allRows.slice(offset, offset + pageSize);
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const filtered = allRows.filter((row) => matchesAdvanceSearch(row, search));
  const total = filtered.length;
  const items = filtered.slice(offset, offset + pageSize);
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function salaryPaymentsListLocal(
  query: PayrollLocalQuery = {}
): Promise<PayrollLocalPage<SalaryPaymentRow>> {
  await salaryPaymentsRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await db.salary_payments.count();
    const items = await db.salary_payments.orderBy("updated_at").reverse().offset(offset).limit(pageSize).toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = db.salary_payments.orderBy("updated_at").reverse().filter((row) => matchesPaymentSearch(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function employeeSalaryHistoriesListLocal(
  query: PayrollLocalQuery = {}
): Promise<PayrollLocalPage<EmployeeSalaryHistoryRow>> {
  await employeeSalaryHistoriesRetentionCleanupIfDue();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const search = (query.q ?? "").trim().toLowerCase();

  if (!search) {
    const total = await db.employee_salary_histories.count();
    const items = await db.employee_salary_histories
      .orderBy("updated_at")
      .reverse()
      .offset(offset)
      .limit(pageSize)
      .toArray();
    return { items, page, pageSize, total, hasMore: offset + items.length < total };
  }

  const collection = db.employee_salary_histories
    .orderBy("updated_at")
    .reverse()
    .filter((row) => matchesHistorySearch(row, search));
  const total = await collection.count();
  const items = await collection.offset(offset).limit(pageSize).toArray();
  return { items, page, pageSize, total, hasMore: offset + items.length < total };
}

export async function salaryAdvancesRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("salary_advances", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("salary_advances").toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = await db.salary_advances.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await db.salary_advances.bulkDelete(removable);
  }
  return removable.length;
}

export async function salaryPaymentsRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("salary_payments", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pending = await db.sync_queue.where("entity").equals("salary_payments").toArray();
  const locked = new Set(pending.map((item) => item.uuid));
  const oldRows = await db.salary_payments.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.filter((row) => !locked.has(row.uuid)).map((row) => row.uuid);
  if (removable.length) {
    await db.salary_payments.bulkDelete(removable);
  }
  return removable.length;
}

export async function employeeSalaryHistoriesRetentionCleanup(): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays("employee_salary_histories", RETENTION_DAYS);
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldRows = await db.employee_salary_histories.where("updated_at").below(cutoff).toArray();
  const removable = oldRows.map((row) => row.uuid);
  if (removable.length) {
    await db.employee_salary_histories.bulkDelete(removable);
  }
  return removable.length;
}

export async function salaryAdvancesRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(ADVANCES_CLEANUP_KEY);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await salaryAdvancesRetentionCleanup();
  lsSet(ADVANCES_CLEANUP_KEY, String(now));
  return removed;
}

export async function salaryPaymentsRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(PAYMENTS_CLEANUP_KEY);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await salaryPaymentsRetentionCleanup();
  lsSet(PAYMENTS_CLEANUP_KEY, String(now));
  return removed;
}

export async function employeeSalaryHistoriesRetentionCleanupIfDue(): Promise<number> {
  const now = Date.now();
  const lastRun = lsNum(HISTORY_CLEANUP_KEY);
  if (lastRun !== null && now - lastRun < CLEANUP_INTERVAL_MS) return 0;
  const removed = await employeeSalaryHistoriesRetentionCleanup();
  lsSet(HISTORY_CLEANUP_KEY, String(now));
  return removed;
}

export async function salaryAdvancesPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(ADVANCES_CURSOR_KEY);
  const localCount = await db.salary_advances.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(ADVANCES_CURSOR_KEY);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get("/api/salary-advances", { params });
    const parsed = parsePayload(response.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.salary_advances.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("salary_advances", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizeAdvance)
      .filter((row) => row.uuid && row.employee_id > 0);

    if (rows.length) {
      await db.salary_advances.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(ADVANCES_CURSOR_KEY, serverTime);
  await cleanupSyncedLocalAdvanceDeductions();
  await salaryAdvancesRetentionCleanupIfDue();
  return { pulled };
}

export async function salaryPaymentsPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(PAYMENTS_CURSOR_KEY);
  const localCount = await db.salary_payments.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(PAYMENTS_CURSOR_KEY);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get("/api/salary-payments", { params });
    const parsed = parsePayload(response.data);

    const deletedUuids = parsed.list
      .filter((item) => isDeletedRecord(item))
      .map((item) => String(obj(item).uuid ?? ""))
      .filter(Boolean);

    if (deletedUuids.length) {
      await db.salary_payments.bulkDelete([...new Set(deletedUuids)]);
      await removeQueuedOpsForEntityUuids("salary_payments", deletedUuids);
    }

    const rows = parsed.list
      .filter((item) => !isDeletedRecord(item))
      .map(sanitizePayment)
      .filter((row) => row.uuid && row.employee_id > 0 && row.period);

    if (rows.length) {
      await db.salary_payments.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(PAYMENTS_CURSOR_KEY, serverTime);
  await cleanupSyncedLocalAdvanceDeductions();
  await salaryPaymentsRetentionCleanupIfDue();
  return { pulled };
}

export async function employeeSalaryHistoriesPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const cachedSince = lsGet(HISTORY_CURSOR_KEY);
  const localCount = await db.employee_salary_histories.count();
  const since = localCount > 0 ? cachedSince : null;
  if (localCount === 0 && cachedSince) {
    lsRemove(HISTORY_CURSOR_KEY);
  }
  let page = 1;
  let pulled = 0;
  let serverTime = nowIso();

  while (true) {
    const params: Record<string, string | number> = { offline: 1, page, per_page: PULL_PAGE_SIZE };
    if (since && page === 1) params.since = since;

    const response = await api.get("/api/employee-salary-histories", { params });
    const parsed = parsePayload(response.data);
    const rows = parsed.list
      .map(sanitizeSalaryHistory)
      .filter((row) => row.uuid && row.employee_id > 0);

    if (rows.length) {
      await db.employee_salary_histories.bulkPut(rows);
      pulled += rows.length;
    }

    serverTime = parsed.serverTime;
    if (!parsed.hasMore) break;
    page += 1;
  }

  lsSet(HISTORY_CURSOR_KEY, serverTime);
  await employeeSalaryHistoriesRetentionCleanupIfDue();
  return { pulled };
}

export async function getAccountSnapshot(accountId: number): Promise<AccountRow | undefined> {
  const direct = await db.accounts.filter((item) => Number(item.id) === accountId).first();
  if (direct) return direct;
  return db.accounts.where("updated_at").above(0).filter((item) => Number(item.id) === accountId).first();
}

async function buildPaymentCurrencySnapshot(
  accountId: number | null | undefined,
  netSalary: number,
  salaryCurrencyCode: string
): Promise<Pick<SalaryPaymentRow, "account_uuid" | "account_name" | "account_currency" | "payment_currency_code" | "exchange_rate_snapshot" | "net_salary_account_amount">> {
  if (!accountId || accountId <= 0) {
    return {
      account_uuid: null,
      account_name: null,
      account_currency: null,
      payment_currency_code: null,
      exchange_rate_snapshot: null,
      net_salary_account_amount: null,
    };
  }

  const account = await getAccountSnapshot(accountId);
  if (!account) {
    return {
      account_uuid: null,
      account_name: null,
      account_currency: null,
      payment_currency_code: null,
      exchange_rate_snapshot: null,
      net_salary_account_amount: null,
    };
  }

  const currency = normalizeCurrency(account?.currency ?? "USD");
  const salaryCurrency = normalizeCurrency(salaryCurrencyCode ?? "USD");
  const activeRate = salaryCurrency === currency ? null : await getActiveExchangeRateSnapshot();
  const rateSnapshot = salaryCurrency === currency ? 1 : Number(activeRate?.rate ?? 0) || null;
  const convertedAmount = convertAmountBetweenCurrencies(netSalary, salaryCurrency, currency, rateSnapshot);

  return {
    account_uuid: account?.uuid ?? null,
    account_name: account?.name ?? null,
    account_currency: account?.currency ?? currency,
    payment_currency_code: currency,
    exchange_rate_snapshot: rateSnapshot !== null ? roundRate(rateSnapshot) : null,
    net_salary_account_amount: convertedAmount !== null ? roundMoney(convertedAmount) : null,
  };
}

export async function salaryAdvanceCreate(input: SalaryAdvanceInput): Promise<SalaryAdvanceRow> {
  validateAdvanceInput(input);

  const uuid = crypto.randomUUID();
  const payload = toAdvancePayload(input);
  const decorated = await getEmployeeDecorators(input.employee_id);
  const row = sanitizeAdvance({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...payload,
    ...decorated,
    deducted_amount: 0,
    remaining_amount: toMoney(input.amount),
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  if (!isOnline()) {
    await db.salary_advances.put(row);
    await enqueueSync({
      entity: "salary_advances",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Salary advance saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post("/api/salary-advances", { uuid, ...payload });
    const saved = sanitizeAdvance(obj(response.data).data ?? row);
    await db.salary_advances.put(saved);
    await salaryAdvancesPullToLocal();
    notifySuccess("Salary advance created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.salary_advances.put(row);
    await enqueueSync({
      entity: "salary_advances",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Salary advance saved locally. Server sync will retry later.");
    return row;
  }
}

export async function salaryAdvanceUpdate(uuid: string, input: SalaryAdvanceInput): Promise<SalaryAdvanceRow> {
  validateAdvanceInput(input);

  const existing = (await readAdvancesWithPendingOverlay()).find((row) => row.uuid === uuid) ?? (await db.salary_advances.get(uuid));
  if (!existing) throw new Error("Salary advance not found locally.");
  if (Number(input.amount) < Number(existing.deducted_amount ?? 0)) {
    throw new Error("Advance amount cannot be less than the amount already deducted.");
  }

  const payload = toAdvancePayload(input);
  const updated = await decorateAdvance(
    sanitizeAdvance({
      ...existing,
      ...payload,
      updated_at: Date.now(),
    })
  );

  await db.salary_advances.put(updated);
  await enqueueSync({
    entity: "salary_advances",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Salary advance updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`/api/salary-advances/${uuid}`, payload);
    const saved = sanitizeAdvance(obj(response.data).data ?? updated);
    await db.salary_advances.put(saved);
    await salaryAdvancesPullToLocal();
    notifySuccess("Salary advance updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await db.salary_advances.put(existing);
      await removeLatestQueueItem("salary_advances", uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Salary advance updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function salaryAdvanceDelete(uuid: string): Promise<void> {
  const existing = await db.salary_advances.get(uuid);
  if (!existing) throw new Error("Salary advance not found locally.");

  await db.salary_advances.delete(uuid);
  await enqueueSync({
    entity: "salary_advances",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Salary advance deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/salary-advances/${uuid}`);
    notifySuccess("Salary advance deleted successfully.");
  } catch {
    notifyInfo("Salary advance deleted locally. Server sync will retry later.");
  }
}

export async function salaryPaymentCreate(input: SalaryPaymentInput): Promise<SalaryPaymentRow> {
  validatePaymentInput(input);

  const uuid = crypto.randomUUID();
  const payload = toPaymentPayload(input);
  const decorated = await getEmployeeDecorators(input.employee_id);
  const currencySnapshot = await buildPaymentCurrencySnapshot(
    input.account_id ?? null,
    Number(payload.net_salary ?? 0),
    String(payload.salary_currency_code ?? "USD")
  );
  await replaceLocalAdvanceDeductionsForPayment(
    uuid,
    input.employee_id,
    Number(payload.advance_deducted ?? 0),
    String(payload.salary_currency_code ?? "USD")
  );
  const row = sanitizePayment({
    id: deriveIdFromUuid(uuid),
    uuid,
    ...payload,
    ...decorated,
    ...currencySnapshot,
    created_at: Date.now(),
    updated_at: Date.now(),
  });

  if (!isOnline()) {
    await db.salary_payments.put(row);
    await enqueueSync({
      entity: "salary_payments",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifySuccess("Salary payment saved offline. It will sync when online.");
    return row;
  }

  try {
    const response = await api.post("/api/salary-payments", { uuid, ...payload });
    const saved = sanitizePayment(obj(response.data).data ?? row);
    await clearLocalAdvanceDeductionsForPayment(uuid);
    await db.salary_payments.put(saved);
    await Promise.all([salaryAdvancesPullToLocal(), accountsPullToLocal(), accountTransactionsPullToLocal()]);
    notifySuccess("Salary payment created successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await clearLocalAdvanceDeductionsForPayment(uuid);
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    await db.salary_payments.put(row);
    await enqueueSync({
      entity: "salary_payments",
      uuid,
      localKey: uuid,
      action: "create",
      payload,
    });
    notifyInfo("Salary payment saved locally. Server sync will retry later.");
    return row;
  }
}

export async function salaryPaymentUpdate(uuid: string, input: SalaryPaymentInput): Promise<SalaryPaymentRow> {
  validatePaymentInput(input);

  const existing = await db.salary_payments.get(uuid);
  if (!existing) throw new Error("Salary payment not found locally.");

  const payload = toPaymentPayload(input);
  const currencySnapshot = await buildPaymentCurrencySnapshot(
    input.account_id ?? null,
    Number(payload.net_salary ?? 0),
    String(payload.salary_currency_code ?? "USD")
  );
  await replaceLocalAdvanceDeductionsForPayment(
    uuid,
    input.employee_id,
    Number(payload.advance_deducted ?? 0),
    String(payload.salary_currency_code ?? "USD")
  );
  const updated = await decoratePayment(
    sanitizePayment({
      ...existing,
      ...payload,
      ...currencySnapshot,
      updated_at: Date.now(),
    })
  );

  await db.salary_payments.put(updated);
  await enqueueSync({
    entity: "salary_payments",
    uuid,
    localKey: uuid,
    action: "update",
    payload,
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Salary payment updated offline. It will sync when online.");
    return updated;
  }

  try {
    const response = await api.put(`/api/salary-payments/${uuid}`, payload);
    const saved = sanitizePayment(obj(response.data).data ?? updated);
    await clearLocalAdvanceDeductionsForPayment(uuid);
    await db.salary_payments.put(saved);
    await Promise.all([salaryAdvancesPullToLocal(), accountsPullToLocal(), accountTransactionsPullToLocal()]);
    notifySuccess("Salary payment updated successfully.");
    return saved;
  } catch (error: unknown) {
    if (isValidationError(getApiStatus(error))) {
      await replaceLocalAdvanceDeductionsForPayment(
        uuid,
        Number(existing.employee_id),
        Number(existing.advance_deducted ?? 0),
        String(existing.salary_currency_code ?? "USD")
      );
      await db.salary_payments.put(existing);
      await removeLatestQueueItem("salary_payments", uuid, "update");
      const message = getApiErrorMessage(error);
      notifyError(message);
      throw new Error(message);
    }

    notifyInfo("Salary payment updated locally. Server sync will retry later.");
    return updated;
  }
}

export async function salaryPaymentDelete(uuid: string): Promise<void> {
  const existing = await db.salary_payments.get(uuid);
  if (!existing) throw new Error("Salary payment not found locally.");

  await clearLocalAdvanceDeductionsForPayment(uuid);
  await db.salary_payments.delete(uuid);
  await enqueueSync({
    entity: "salary_payments",
    uuid,
    localKey: uuid,
    action: "delete",
    payload: {},
    rollbackSnapshot: existing,
  });

  if (!isOnline()) {
    notifySuccess("Salary payment deleted offline. It will sync when online.");
    return;
  }

  try {
    await api.delete(`/api/salary-payments/${uuid}`);
    await Promise.all([salaryAdvancesPullToLocal(), accountsPullToLocal(), accountTransactionsPullToLocal()]);
    notifySuccess("Salary payment deleted successfully.");
  } catch {
    notifyInfo("Salary payment deleted locally. Server sync will retry later.");
  }
}
