"use client";

import { db, type AccountTransactionRow, type InstallmentRow } from "@/db/localDB";
import { REPORT_DEFINITION_MAP } from "@/config/report-nav";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { apartmentSalePullToLocal } from "@/modules/apartment-sales/apartment-sales.repo";
import { accountsPullToLocal, accountTransactionsPullToLocal } from "@/modules/accounts/accounts.repo";
import { crmMessagesList } from "@/modules/crm/crm.repo";
import { customersPullToLocal } from "@/modules/customers/customers.repo";
import { documentsList } from "@/modules/documents/documents.repo";
import { employeePullToLocal } from "@/modules/employees/employees.repo";
import {
  assetRequestsPullToLocal,
  materialRequestsPullToLocal,
} from "@/modules/inventory-workflow/inventory-workflow.repo";
import { installmentsPullToLocal } from "@/modules/installments/installments.repo";
import {
  companyAssetsPullToLocal,
  materialsPullToLocal,
  vendorsPullToLocal,
  warehousesPullToLocal,
} from "@/modules/inventories/inventories.repo";
import {
  employeeSalaryHistoriesPullToLocal,
  salaryPaymentsPullToLocal,
} from "@/modules/payroll/payroll.repo";
import { projectsPullToLocal } from "@/modules/projects/projects.repo";
import { purchaseRequestsPullToLocal } from "@/modules/purchase-requests/purchase-requests.repo";
import {
  rentalPaymentsPullToLocal,
  rentalsPullToLocal,
} from "@/modules/rentals/rentals.repo";
import { stockMovementsPullToLocal } from "@/modules/stock-movements/stock-movements.repo";
import type {
  ReportBundle,
  ReportChart,
  ReportFilters,
  ReportKey,
  ReportMetric,
  ReportSection,
  ReportTable,
} from "@/modules/reports/reports.types";
import {
  buildBreakdownSeries,
  buildMonthlySeries,
  buildScopeLabel,
  compactNumber,
  matchesDateRange,
  matchesSearch,
  parseDateInputEnd,
  parseDateInputStart,
  round2,
  sumRows,
  summarizeCurrencyTotals,
} from "@/modules/reports/reports.utils";

const DEFAULT_TABLE_PAGE_SIZE = 12;

function humanize(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusText(value: string | null | undefined): string {
  return humanize(value);
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function money(value: number, currency: string = "USD"): string {
  return formatMoney(Number(value || 0), normalizeCurrency(currency));
}

function transactionUsdAmount(row: AccountTransactionRow): number {
  if (row.amount_usd !== null && row.amount_usd !== undefined) return Number(row.amount_usd || 0);
  if (String(row.currency_code ?? row.account_currency ?? "USD").toUpperCase() === "USD") {
    return Number(row.amount || 0);
  }
  return 0;
}

type BusinessFlowKind = "revenue" | "cost";

function classifyBusinessTransaction(input: {
  direction?: string | null;
  reference_type?: string | null;
  status?: string | null;
}): BusinessFlowKind | null {
  const status = String(input.status ?? "").trim().toLowerCase();
  if (status !== "posted") return null;

  const direction = String(input.direction ?? "").trim().toLowerCase();
  const referenceType = String(input.reference_type ?? "").trim().toLowerCase();

  if (direction === "in" && ["installment_payment", "rental_payment_receipt"].includes(referenceType)) {
    return "revenue";
  }

  if (direction === "out" && ["salary_payment", "purchase_request_payment", "municipality_receipt"].includes(referenceType)) {
    return "cost";
  }

  return null;
}

function payrollUsdAmount(
  row: {
    gross_salary_usd?: number | null;
    gross_salary?: number | null;
    tax_deducted_usd?: number | null;
    tax_deducted?: number | null;
    net_salary_usd?: number | null;
    net_salary?: number | null;
    salary_currency_code?: string | null;
  },
  key: "gross" | "tax" | "net"
): number {
  if (key === "gross") {
    if (row.gross_salary_usd !== null && row.gross_salary_usd !== undefined) return Number(row.gross_salary_usd || 0);
    return String(row.salary_currency_code ?? "USD").toUpperCase() === "USD" ? Number(row.gross_salary || 0) : 0;
  }
  if (key === "tax") {
    if (row.tax_deducted_usd !== null && row.tax_deducted_usd !== undefined) return Number(row.tax_deducted_usd || 0);
    return String(row.salary_currency_code ?? "USD").toUpperCase() === "USD" ? Number(row.tax_deducted || 0) : 0;
  }
  if (row.net_salary_usd !== null && row.net_salary_usd !== undefined) return Number(row.net_salary_usd || 0);
  return String(row.salary_currency_code ?? "USD").toUpperCase() === "USD" ? Number(row.net_salary || 0) : 0;
}

function requestQuantityTotal(items: Array<{ quantity_requested?: number | null }> | null | undefined): number {
  return round2(safeArray(items).reduce((total, item) => total + Number(item.quantity_requested || 0), 0));
}

function requestIssuedTotal(
  items: Array<{ quantity_issued?: number | null; quantity_allocated?: number | null; quantity_received?: number | null }> | null | undefined,
  key: "issued" | "allocated" | "received"
): number {
  return round2(
    safeArray(items).reduce((total, item) => {
      if (key === "allocated") return total + Number(item.quantity_allocated || 0);
      if (key === "received") return total + Number(item.quantity_received || 0);
      return total + Number(item.quantity_issued || 0);
    }, 0)
  );
}

function finalizeBundle(
  key: ReportKey,
  filters: ReportFilters,
  config: {
    metrics: ReportMetric[];
    sections?: ReportSection[];
    charts: ReportChart[];
    table: ReportTable;
    emptyMessage?: string;
  }
): ReportBundle {
  const definition = REPORT_DEFINITION_MAP[key];
  return {
    key,
    title: definition.label,
    subtitle: definition.description,
    emptyMessage: config.emptyMessage ?? "No records were found for the selected filters.",
    offlineCapable: true,
    generatedAt: Date.now(),
    scopeLabel: buildScopeLabel(filters),
    filters,
    metrics: config.metrics,
    sections: config.sections ?? [],
    charts: config.charts,
    table: config.table,
  };
}

async function refreshDocumentsSeed(): Promise<void> {
  await documentsList({ page: 1, perPage: 200 }).catch(() => undefined);
}

async function refreshCrmSeed(): Promise<void> {
  await crmMessagesList({ page: 1, perPage: 200 }).catch(() => undefined);
}

export type ReportRefreshResult = {
  total: number;
  succeeded: number;
  failed: string[];
};

async function runReportRefreshTasks(tasks: Array<{ label: string; run: () => Promise<unknown> }>): Promise<ReportRefreshResult> {
  const results = await Promise.allSettled(
    tasks.map(async (task) => {
      await task.run();
      return task.label;
    })
  );

  const failed = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    console.warn(`[reports] refresh source failed: ${tasks[index]?.label ?? "unknown"}`, result.reason);
    return [tasks[index]?.label ?? "unknown"];
  });

  return {
    total: tasks.length,
    succeeded: results.length - failed.length,
    failed,
  };
}

export async function refreshReportBundleSources(key: ReportKey): Promise<ReportRefreshResult> {
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

  switch (key) {
    case "apartments":
      tasks.push({ label: "apartments", run: () => apartmentsPullToLocal() });
      break;
    case "customers":
      tasks.push({ label: "customers", run: () => customersPullToLocal() });
      break;
    case "sales":
      tasks.push(
        { label: "apartment-sales", run: () => apartmentSalePullToLocal() },
        { label: "installments", run: () => installmentsPullToLocal() },
        { label: "customers", run: () => customersPullToLocal() },
        { label: "apartments", run: () => apartmentsPullToLocal() }
      );
      break;
    case "installments":
      tasks.push(
        { label: "installments", run: () => installmentsPullToLocal() },
        { label: "apartment-sales", run: () => apartmentSalePullToLocal() },
        { label: "customers", run: () => customersPullToLocal() },
        { label: "apartments", run: () => apartmentsPullToLocal() }
      );
      break;
    case "documents":
      tasks.push({ label: "documents", run: () => refreshDocumentsSeed() });
      break;
    case "crm":
      tasks.push({ label: "crm", run: () => refreshCrmSeed() });
      break;
    case "employees":
      tasks.push({ label: "employees", run: () => employeePullToLocal() });
      break;
    case "payroll":
      tasks.push(
        { label: "salary-payments", run: () => salaryPaymentsPullToLocal() },
        { label: "employees", run: () => employeePullToLocal() },
        { label: "accounts", run: () => accountsPullToLocal() },
        { label: "employee-salary-histories", run: () => employeeSalaryHistoriesPullToLocal() }
      );
      break;
    case "accounts":
      tasks.push(
        { label: "accounts", run: () => accountsPullToLocal() },
        { label: "account-transactions", run: () => accountTransactionsPullToLocal() }
      );
      break;
    case "projects":
      tasks.push(
        { label: "projects", run: () => projectsPullToLocal() },
        { label: "employees", run: () => employeePullToLocal() }
      );
      break;
    case "inventory":
      tasks.push(
        { label: "stock-movements", run: () => stockMovementsPullToLocal() },
        { label: "materials", run: () => materialsPullToLocal() },
        { label: "warehouses", run: () => warehousesPullToLocal() },
        { label: "projects", run: () => projectsPullToLocal() }
      );
      break;
    case "material-requests":
      tasks.push(
        { label: "material-requests", run: () => materialRequestsPullToLocal() },
        { label: "projects", run: () => projectsPullToLocal() },
        { label: "warehouses", run: () => warehousesPullToLocal() },
        { label: "materials", run: () => materialsPullToLocal() }
      );
      break;
    case "purchase-requests":
      tasks.push(
        { label: "purchase-requests", run: () => purchaseRequestsPullToLocal() },
        { label: "warehouses", run: () => warehousesPullToLocal() },
        { label: "vendors", run: () => vendorsPullToLocal() },
        { label: "projects", run: () => projectsPullToLocal() },
        { label: "account-transactions", run: () => accountTransactionsPullToLocal() },
        { label: "accounts", run: () => accountsPullToLocal() }
      );
      break;
    case "asset-requests":
      tasks.push(
        { label: "asset-requests", run: () => assetRequestsPullToLocal() },
        { label: "projects", run: () => projectsPullToLocal() },
        { label: "company-assets", run: () => companyAssetsPullToLocal() }
      );
      break;
    case "rentals":
      tasks.push(
        { label: "rentals", run: () => rentalsPullToLocal() },
        { label: "customers", run: () => customersPullToLocal() },
        { label: "apartments", run: () => apartmentsPullToLocal() }
      );
      break;
    case "rental-payments":
      tasks.push(
        { label: "rental-payments", run: () => rentalPaymentsPullToLocal() },
        { label: "rentals", run: () => rentalsPullToLocal() },
        { label: "accounts", run: () => accountsPullToLocal() },
        { label: "account-transactions", run: () => accountTransactionsPullToLocal() }
      );
      break;
    default:
      break;
  }

  return runReportRefreshTasks(tasks);
}

async function buildApartmentsReport(filters: ReportFilters): Promise<ReportBundle> {
  const apartments = (await db.apartments.toArray()).filter((row) => matchesDateRange(row.updated_at, filters));
  const rows = apartments
    .map((row) => ({
      id: row.uuid,
      apartment_code: row.apartment_code,
      block_number: row.block_number,
      unit_number: row.unit_number,
      usage_type: humanize(row.usage_type),
      status: statusText(row.status),
      total_price: Number(row.total_price || 0),
      price_currency: "USD",
      area_sqm: Number(row.area_sqm || 0),
      updated_at: row.updated_at,
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "apartment_code",
        "block_number",
        "unit_number",
        "usage_type",
        "status",
      ])
    );

  const avgPrice = rows.length ? round2(sumRows(rows, (row) => Number(row.total_price || 0)) / rows.length) : 0;

  return finalizeBundle("apartments", filters, {
    metrics: [
      { label: "Apartments", value: compactNumber(rows.length), tone: "blue" },
      { label: "Available", value: compactNumber(rows.filter((row) => String(row.status).toLowerCase() === "available").length), tone: "emerald" },
      { label: "Reserved / Sold", value: compactNumber(rows.filter((row) => ["reserved", "sold"].includes(String(row.status).toLowerCase())).length), tone: "amber" },
      { label: "Average Price", value: money(avgPrice), hint: "Based on filtered apartments", tone: "rose" },
    ],
    charts: [
      {
        key: "apartment-status",
        title: "Apartment Status",
        subtitle: "Current filtered apartment distribution.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Apartments", color: "#2563eb" }],
      },
      {
        key: "apartment-usage",
        title: "Usage Type Mix",
        subtitle: "Residential and other usage groupings.",
        type: "bar",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.usage_type), limit: 8 }),
        series: [{ key: "value", label: "Count", color: "#14b8a6" }],
      },
    ],
    table: {
      title: "Apartment Records",
      subtitle: "Filtered apartment rows cached on this device.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["apartment_code", "block_number", "unit_number", "usage_type", "status"],
      columns: [
        { key: "apartment_code", label: "Apartment" },
        { key: "block_number", label: "Block" },
        { key: "unit_number", label: "Unit" },
        { key: "usage_type", label: "Usage Type" },
        { key: "status", label: "Status", kind: "status" },
        { key: "total_price", label: "Price", kind: "money", staticCurrency: "USD" },
        { key: "area_sqm", label: "Area (sqm)", kind: "number" },
        { key: "updated_at", label: "Updated", kind: "date" },
      ],
    },
  });
}

async function buildCustomersReport(filters: ReportFilters): Promise<ReportBundle> {
  const customers = (await db.customers.toArray()).filter((row) => matchesDateRange(row.updated_at, filters));
  const rows = customers
    .map((row) => ({
      id: row.uuid,
      name: row.name,
      phone: row.phone,
      email: row.email ?? "-",
      representative_name: row.representative_name ?? "-",
      current_province: row.current_province ?? "-",
      original_province: row.original_province ?? "-",
      has_email: row.email ? "Yes" : "No",
      updated_at: row.updated_at,
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "name",
        "phone",
        "email",
        "representative_name",
        "current_province",
        "original_province",
      ])
    );

  return finalizeBundle("customers", filters, {
    metrics: [
      { label: "Customers", value: compactNumber(rows.length), tone: "blue" },
      { label: "With Representative", value: compactNumber(rows.filter((row) => row.representative_name !== "-").length), tone: "emerald" },
      { label: "With Email", value: compactNumber(rows.filter((row) => row.has_email === "Yes").length), tone: "amber" },
      { label: "Province Coverage", value: compactNumber(new Set(rows.map((row) => row.current_province).filter((value) => value !== "-")).size), tone: "rose" },
    ],
    charts: [
      {
        key: "customer-province",
        title: "Current Province Mix",
        subtitle: "Where customers are currently located.",
        type: "bar",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.current_province), limit: 8 }),
        series: [{ key: "value", label: "Customers", color: "#3b82f6" }],
      },
      {
        key: "customer-updates",
        title: "Customer Updates Trend",
        subtitle: "Monthly updates based on the local customer cache.",
        type: "line",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.updated_at || 0),
          reducers: { customers: (current) => current + 1 },
        }),
        series: [{ key: "customers", label: "Customers", color: "#10b981" }],
      },
    ],
    table: {
      title: "Customer Register",
      subtitle: "Filtered customer records and representative details.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["name", "phone", "email", "representative_name", "current_province", "original_province"],
      columns: [
        { key: "name", label: "Customer" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "representative_name", label: "Representative" },
        { key: "current_province", label: "Current Province" },
        { key: "original_province", label: "Original Province" },
        { key: "updated_at", label: "Updated", kind: "date" },
      ],
    },
  });
}

async function buildSalesReport(filters: ReportFilters): Promise<ReportBundle> {
  const [sales, customers, apartments, installments] = await Promise.all([
    db.apartment_sales.toArray(),
    db.customers.toArray(),
    db.apartments.toArray(),
    db.installments.toArray(),
  ]);

  const customerById = new Map(customers.map((row) => [Number(row.id), row]));
  const apartmentById = new Map(apartments.map((row) => [Number(row.id), row]));
  const installmentBySale = new Map<string, InstallmentRow[]>();

  for (const row of installments) {
    const key = String(row.sale_uuid ?? "");
    if (!key) continue;
    const list = installmentBySale.get(key) ?? [];
    list.push(row);
    installmentBySale.set(key, list);
  }

  const rows = sales
    .filter((sale) => matchesDateRange(sale.sale_date, filters))
    .map((sale) => {
      const saleInstallments = installmentBySale.get(sale.uuid) ?? [];
      const paidTotal = round2(saleInstallments.reduce((total, row) => total + Number(row.paid_amount || 0), 0));
      const netPrice = Number(sale.net_price ?? Number(sale.total_price || 0) - Number(sale.discount || 0));
      const remaining = Math.max(0, round2(netPrice - paidTotal));
      return {
        id: sale.uuid,
        sale_id: sale.sale_id || sale.uuid.slice(0, 8).toUpperCase(),
        customer_name: customerById.get(Number(sale.customer_id))?.name ?? `Customer #${sale.customer_id}`,
        apartment_code: apartmentById.get(Number(sale.apartment_id))?.apartment_code ?? `Apartment #${sale.apartment_id}`,
        sale_date: sale.sale_date,
        payment_type: humanize(sale.payment_type),
        status: statusText(sale.status),
        total_price: Number(sale.total_price || 0),
        discount: Number(sale.discount || 0),
        net_price: netPrice,
        paid_total: paidTotal,
        remaining_total: remaining,
      };
    })
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "sale_id",
        "customer_name",
        "apartment_code",
        "payment_type",
        "status",
      ])
    );

  return finalizeBundle("sales", filters, {
    metrics: [
      { label: "Sales", value: compactNumber(rows.length), tone: "blue" },
      { label: "Net Price", value: money(sumRows(rows, (row) => Number(row.net_price || 0))), tone: "emerald" },
      { label: "Paid Total", value: money(sumRows(rows, (row) => Number(row.paid_total || 0))), tone: "amber" },
      { label: "Customer Remaining", value: money(sumRows(rows, (row) => Number(row.remaining_total || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "sales-monthly",
        title: "Monthly Sales Value",
        subtitle: "Net apartment sale value for the selected period.",
        type: "bar",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.sale_date || 0),
          reducers: {
            net_sales: (current, row) => round2(current + Number(row.net_price || 0)),
          },
        }),
        series: [{ key: "net_sales", label: "Net Sales", color: "#f59e0b" }],
      },
      {
        key: "sales-status",
        title: "Sale Status Mix",
        subtitle: "Approval and lifecycle distribution.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Sales", color: "#2563eb" }],
      },
    ],
    table: {
      title: "Apartment Sales",
      subtitle: "Filtered apartment sale records with payment progress.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["sale_id", "customer_name", "apartment_code", "payment_type", "status"],
      columns: [
        { key: "sale_id", label: "Sale No." },
        { key: "customer_name", label: "Customer" },
        { key: "apartment_code", label: "Apartment" },
        { key: "sale_date", label: "Sale Date", kind: "date" },
        { key: "payment_type", label: "Payment Type" },
        { key: "status", label: "Status", kind: "status" },
        { key: "net_price", label: "Net Price", kind: "money", staticCurrency: "USD" },
        { key: "paid_total", label: "Paid", kind: "money", staticCurrency: "USD" },
        { key: "remaining_total", label: "Remaining", kind: "money", staticCurrency: "USD" },
      ],
    },
  });
}

async function buildInstallmentsReport(filters: ReportFilters): Promise<ReportBundle> {
  const [installments, sales, customers, apartments] = await Promise.all([
    db.installments.toArray(),
    db.apartment_sales.toArray(),
    db.customers.toArray(),
    db.apartments.toArray(),
  ]);

  const saleByUuid = new Map(sales.map((row) => [row.uuid, row]));
  const customerById = new Map(customers.map((row) => [Number(row.id), row]));
  const apartmentById = new Map(apartments.map((row) => [Number(row.id), row]));

  const rows = installments
    .filter((row) => matchesDateRange(row.due_date, filters))
    .map((row) => {
      const sale = saleByUuid.get(String(row.sale_uuid ?? ""));
      const customer = sale ? customerById.get(Number(sale.customer_id)) : undefined;
      const apartment = sale ? apartmentById.get(Number(sale.apartment_id)) : undefined;
      const remaining = Math.max(0, round2(Number(row.amount || 0) - Number(row.paid_amount || 0)));
      return {
        id: row.uuid,
        sale_id: sale?.sale_id || row.sale_id || "-",
        customer_name: customer?.name ?? "-",
        apartment_code: apartment?.apartment_code ?? "-",
        due_date: row.due_date,
        amount: Number(row.amount || 0),
        paid_amount: Number(row.paid_amount || 0),
        remaining_amount: remaining,
        status: statusText(row.status),
      };
    })
    .filter((row) =>
      matchesSearch(row, filters.search, ["sale_id", "customer_name", "apartment_code", "status"])
    );

  const overdueCount = rows.filter((row) => String(row.status).toLowerCase() === "overdue").length;

  return finalizeBundle("installments", filters, {
    metrics: [
      { label: "Installments", value: compactNumber(rows.length), tone: "blue" },
      { label: "Scheduled", value: money(sumRows(rows, (row) => Number(row.amount || 0))), tone: "emerald" },
      { label: "Paid", value: money(sumRows(rows, (row) => Number(row.paid_amount || 0))), tone: "amber" },
      { label: "Overdue", value: compactNumber(overdueCount), tone: "rose" },
    ],
    charts: [
      {
        key: "installments-monthly",
        title: "Installment Schedule",
        subtitle: "Monthly scheduled installment totals.",
        type: "line",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.due_date || 0),
          reducers: {
            scheduled: (current, row) => round2(current + Number(row.amount || 0)),
            paid: (current, row) => round2(current + Number(row.paid_amount || 0)),
          },
        }),
        series: [
          { key: "scheduled", label: "Scheduled", color: "#3b82f6" },
          { key: "paid", label: "Paid", color: "#10b981" },
        ],
      },
      {
        key: "installments-status",
        title: "Installment Status",
        subtitle: "Paid, partial, pending, and overdue counts.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Installments", color: "#8b5cf6" }],
      },
    ],
    table: {
      title: "Installment Ledger",
      subtitle: "Due dates, paid amounts, and remaining balances.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["sale_id", "customer_name", "apartment_code", "status"],
      columns: [
        { key: "sale_id", label: "Sale No." },
        { key: "customer_name", label: "Customer" },
        { key: "apartment_code", label: "Apartment" },
        { key: "due_date", label: "Due Date", kind: "date" },
        { key: "amount", label: "Amount", kind: "money", staticCurrency: "USD" },
        { key: "paid_amount", label: "Paid", kind: "money", staticCurrency: "USD" },
        { key: "remaining_amount", label: "Remaining", kind: "money", staticCurrency: "USD" },
        { key: "status", label: "Status", kind: "status" },
      ],
    },
  });
}

async function buildDocumentsReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.system_documents.toArray())
    .filter((row) => matchesDateRange(row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: String(row.id),
      module_label: row.module_label || humanize(row.module),
      document_type_label: row.document_type_label || humanize(row.document_type),
      reference_label: row.reference_label,
      file_name: row.file_name,
      created_at: row.created_at ? Date.parse(row.created_at) : row.updated_at,
      local_state: row.local_only ? "Queued Offline" : row.awaiting_reference_sync ? "Waiting Ref Sync" : "Synced",
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "module_label",
        "document_type_label",
        "reference_label",
        "file_name",
        "local_state",
      ])
    );

  return finalizeBundle("documents", filters, {
    metrics: [
      { label: "Documents", value: compactNumber(rows.length), tone: "blue" },
      { label: "Queued Offline", value: compactNumber(rows.filter((row) => row.local_state === "Queued Offline").length), tone: "amber" },
      { label: "Apartment Sale Docs", value: compactNumber(rows.filter((row) => row.module_label.toLowerCase().includes("sale")).length), tone: "emerald" },
      { label: "Rental Docs", value: compactNumber(rows.filter((row) => row.module_label.toLowerCase().includes("rental")).length), tone: "rose" },
    ],
    charts: [
      {
        key: "documents-module",
        title: "Documents By Module",
        subtitle: "Which modules are producing the most document records.",
        type: "bar",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.module_label), limit: 8 }),
        series: [{ key: "value", label: "Documents", color: "#0ea5e9" }],
      },
      {
        key: "documents-type",
        title: "Document Types",
        subtitle: "Most common document type labels in the filtered results.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.document_type_label), limit: 8 }),
        series: [{ key: "value", label: "Documents", color: "#22c55e" }],
      },
    ],
    table: {
      title: "Document Register",
      subtitle: "Uploaded and queued file records from local storage.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["module_label", "document_type_label", "reference_label", "file_name", "local_state"],
      columns: [
        { key: "module_label", label: "Module" },
        { key: "document_type_label", label: "Document Type" },
        { key: "reference_label", label: "Reference" },
        { key: "file_name", label: "File Name" },
        { key: "local_state", label: "Sync State", kind: "status" },
        { key: "created_at", label: "Created", kind: "date" },
      ],
    },
  });
}

async function buildCrmReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.crm_messages.toArray())
    .filter((row) => matchesDateRange(row.sent_at ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: String(row.id),
      customer_name: row.customer_name,
      channel: String(row.channel).toUpperCase(),
      message_type: humanize(row.message_type),
      status: statusText(row.status),
      customer_phone: row.customer_phone ?? "-",
      customer_email: row.customer_email ?? "-",
      installment_due_date: row.installment_due_date ?? "-",
      sent_at: row.sent_at ? Date.parse(row.sent_at) : row.created_at ? Date.parse(row.created_at) : row.updated_at,
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "customer_name",
        "channel",
        "message_type",
        "status",
        "customer_phone",
        "customer_email",
      ])
    );

  return finalizeBundle("crm", filters, {
    metrics: [
      { label: "Messages", value: compactNumber(rows.length), tone: "blue" },
      { label: "Sent", value: compactNumber(rows.filter((row) => row.status === "Sent").length), tone: "emerald" },
      { label: "Queued", value: compactNumber(rows.filter((row) => row.status === "Queued").length), tone: "amber" },
      { label: "Failed", value: compactNumber(rows.filter((row) => row.status === "Failed").length), tone: "rose" },
    ],
    charts: [
      {
        key: "crm-channel",
        title: "Channel Split",
        subtitle: "Email and SMS distribution.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.channel), limit: 6 }),
        series: [{ key: "value", label: "Messages", color: "#3b82f6" }],
      },
      {
        key: "crm-monthly",
        title: "CRM Activity Trend",
        subtitle: "Monthly CRM activity from the filtered messages.",
        type: "line",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.sent_at || 0),
          reducers: { messages: (current) => current + 1 },
        }),
        series: [{ key: "messages", label: "Messages", color: "#f97316" }],
      },
    ],
    table: {
      title: "CRM Messages",
      subtitle: "Customer message history currently available offline.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["customer_name", "channel", "message_type", "status", "customer_phone", "customer_email"],
      columns: [
        { key: "customer_name", label: "Customer" },
        { key: "channel", label: "Channel" },
        { key: "message_type", label: "Message Type" },
        { key: "status", label: "Status", kind: "status" },
        { key: "customer_phone", label: "Phone" },
        { key: "customer_email", label: "Email" },
        { key: "sent_at", label: "Sent / Created", kind: "date" },
      ],
    },
  });
}

async function buildEmployeesReport(filters: ReportFilters): Promise<ReportBundle> {
  const employees = (await db.employees.toArray()).filter((row) => matchesDateRange(row.hire_date ?? row.updated_at, filters));
  const rows = employees
    .map((row) => ({
      id: row.uuid,
      employee_name: `${row.first_name}${row.last_name ? ` ${row.last_name}` : ""}`.trim(),
      job_title: row.job_title ?? "-",
      salary_type: humanize(row.salary_type),
      base_salary: Number(row.base_salary || 0),
      salary_currency_code: row.salary_currency_code || "USD",
      phone: row.phone ? String(row.phone) : "-",
      email: row.email ?? "-",
      hire_date: row.hire_date ?? row.updated_at,
      status: statusText(row.status),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, ["employee_name", "job_title", "salary_type", "phone", "email", "status"])
    );

  return finalizeBundle("employees", filters, {
    metrics: [
      { label: "Employees", value: compactNumber(rows.length), tone: "blue" },
      { label: "Active", value: compactNumber(rows.filter((row) => row.status === "Active").length), tone: "emerald" },
      {
        label: "Salary Total",
        value: summarizeCurrencyTotals(
          rows.map((row) => ({
            amount: Number(row.base_salary || 0),
            currency: String(row.salary_currency_code || "USD"),
          }))
        ),
        tone: "amber",
      },
      { label: "Job Titles", value: compactNumber(new Set(rows.map((row) => row.job_title).filter((value) => value !== "-")).size), tone: "rose" },
    ],
    charts: [
      {
        key: "employees-status",
        title: "Employee Status",
        subtitle: "Active and inactive employee counts.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 6 }),
        series: [{ key: "value", label: "Employees", color: "#2563eb" }],
      },
      {
        key: "employees-hiring",
        title: "Hiring Trend",
        subtitle: "Monthly hires based on employee hire dates.",
        type: "bar",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.hire_date || 0),
          reducers: { hires: (current) => current + 1 },
        }),
        series: [{ key: "hires", label: "Hires", color: "#10b981" }],
      },
    ],
    table: {
      title: "Employee Register",
      subtitle: "Salary and contact details for filtered employees.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["employee_name", "job_title", "salary_type", "phone", "email", "status"],
      columns: [
        { key: "employee_name", label: "Employee" },
        { key: "job_title", label: "Job Title" },
        { key: "salary_type", label: "Salary Type" },
        { key: "base_salary", label: "Base Salary", kind: "money", currencyKey: "salary_currency_code" },
        { key: "phone", label: "Phone" },
        { key: "status", label: "Status", kind: "status" },
        { key: "hire_date", label: "Hire Date", kind: "date" },
      ],
    },
  });
}

async function buildPayrollReport(filters: ReportFilters): Promise<ReportBundle> {
  const payments = (await db.salary_payments.toArray()).filter((row) => matchesDateRange(row.paid_at ?? row.created_at ?? row.updated_at, filters));
  const rows = payments
    .map((row) => ({
      id: row.uuid,
      employee_name: row.employee_name || row.employee_uuid || "-",
      period: row.period,
      gross_salary: Number(row.gross_salary || 0),
      tax_deducted: Number(row.tax_deducted || 0),
      net_salary: Number(row.net_salary || 0),
      salary_currency_code: row.salary_currency_code || "USD",
      payment_currency_code: row.payment_currency_code || row.salary_currency_code || "USD",
      account_name: row.account_name || "-",
      status: statusText(row.status),
      paid_at: row.paid_at ?? row.created_at ?? row.updated_at,
      gross_usd: payrollUsdAmount(row, "gross"),
      tax_usd: payrollUsdAmount(row, "tax"),
      net_usd: payrollUsdAmount(row, "net"),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, ["employee_name", "period", "account_name", "status"])
    );

  return finalizeBundle("payroll", filters, {
    metrics: [
      { label: "Payroll Payments", value: compactNumber(rows.length), tone: "blue" },
      { label: "Gross Total (USD)", value: money(sumRows(rows, (row) => Number(row.gross_usd || 0))), tone: "emerald" },
      { label: "Tax Total (USD)", value: money(sumRows(rows, (row) => Number(row.tax_usd || 0))), tone: "amber" },
      { label: "Net Total (USD)", value: money(sumRows(rows, (row) => Number(row.net_usd || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "payroll-monthly",
        title: "Monthly Payroll Trend",
        subtitle: "Gross and net salary paid per month in USD.",
        type: "line",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.paid_at || 0),
          reducers: {
            gross: (current, row) => round2(current + Number(row.gross_usd || 0)),
            net: (current, row) => round2(current + Number(row.net_usd || 0)),
          },
        }),
        series: [
          { key: "gross", label: "Gross", color: "#3b82f6" },
          { key: "net", label: "Net", color: "#10b981" },
        ],
      },
      {
        key: "payroll-status",
        title: "Payroll Status",
        subtitle: "Status distribution for salary payments.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 6 }),
        series: [{ key: "value", label: "Payments", color: "#8b5cf6" }],
      },
    ],
    table: {
      title: "Payroll Ledger",
      subtitle: "Employee salary payments and tax deductions.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["employee_name", "period", "account_name", "status"],
      columns: [
        { key: "employee_name", label: "Employee" },
        { key: "period", label: "Period" },
        { key: "gross_salary", label: "Gross", kind: "money", currencyKey: "salary_currency_code" },
        { key: "tax_deducted", label: "Tax", kind: "money", currencyKey: "salary_currency_code" },
        { key: "net_salary", label: "Net", kind: "money", currencyKey: "payment_currency_code" },
        { key: "account_name", label: "Payment Account" },
        { key: "status", label: "Status", kind: "status" },
        { key: "paid_at", label: "Paid At", kind: "date" },
      ],
    },
  });
}

async function buildAccountsReport(filters: ReportFilters): Promise<ReportBundle> {
  const [accounts, transactions] = await Promise.all([db.accounts.toArray(), db.account_transactions.toArray()]);
  const fromTs = parseDateInputStart(filters.fromDate);
  const toTs = parseDateInputEnd(filters.toDate);
  const selectedAccountUuid = filters.accountUuid.trim();

  const transactionsByAccountId = new Map<number, AccountTransactionRow[]>();
  for (const row of transactions) {
    const accountId = Number(row.account_id || 0);
    if (accountId <= 0) continue;
    const list = transactionsByAccountId.get(accountId) ?? [];
    list.push(row);
    transactionsByAccountId.set(accountId, list);
  }

  const transactionSearchMatches = (row: AccountTransactionRow): boolean =>
    matchesSearch(
      {
        account_name: row.account_name || "-",
        module: humanize(row.module),
        direction: String(row.direction || "").toLowerCase() === "in" ? "In" : "Out",
        status: statusText(row.status),
        description: row.description || "-",
        reference_type: row.reference_type || "-",
      },
      filters.search,
      ["account_name", "module", "direction", "status", "description", "reference_type"]
    );

  const scopedAccounts = selectedAccountUuid
    ? accounts.filter((row) => String(row.uuid) === selectedAccountUuid)
    : accounts;

  const filteredAccounts = scopedAccounts.filter((row) => {
    const accountMatches = matchesSearch(
      {
        name: row.name,
        account_type: row.account_type,
        currency: row.currency,
        status: row.status,
        bank_name: row.bank_name ?? "",
        account_number: row.account_number ?? "",
        notes: row.notes ?? "",
      },
      filters.search,
      ["name", "account_type", "currency", "status", "bank_name", "account_number", "notes"]
    );

    if (accountMatches) return true;
    if (!filters.search.trim()) return true;

    const accountId = Number(row.id || 0);
    const linkedTransactions = transactionsByAccountId.get(accountId) ?? [];
    return linkedTransactions.some((item) => transactionSearchMatches(item));
  });

  const filteredAccountIds = new Set(filteredAccounts.map((row) => Number(row.id || 0)).filter((value) => value > 0));
  const scopedTransactions = transactions.filter((row) => filteredAccountIds.has(Number(row.account_id || 0)));

  const filteredTransactions = scopedTransactions
    .filter((row) => matchesDateRange(row.transaction_date ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: row.uuid,
      transaction_date: row.transaction_date ?? row.created_at ?? row.updated_at,
      account_name: row.account_name || "-",
      module: humanize(row.module),
      direction: String(row.direction || "").toLowerCase() === "in" ? "In" : "Out",
      amount: Number(row.amount || 0),
      amount_currency: row.account_currency || row.currency_code || "USD",
      amount_usd: transactionUsdAmount(row),
      reference_type: String(row.reference_type || "").toLowerCase(),
      status_key: String(row.status || "").toLowerCase(),
      status: statusText(row.status),
      description: row.description || "-",
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, ["account_name", "module", "direction", "status", "description"])
    );

  const profitabilityTransactions = filteredTransactions
    .map((row) => ({
      ...row,
      business_flow: classifyBusinessTransaction({
        direction: row.direction,
        reference_type: row.reference_type,
        status: row.status_key,
      }),
    }))
    .filter((row) => row.business_flow !== null);

  const totalRevenueUsd = round2(
    profitabilityTransactions.reduce(
      (total, row) => total + (row.business_flow === "revenue" ? Number(row.amount_usd || 0) : 0),
      0
    )
  );
  const totalCostUsd = round2(
    profitabilityTransactions.reduce(
      (total, row) => total + (row.business_flow === "cost" ? Number(row.amount_usd || 0) : 0),
      0
    )
  );
  const totalProfitUsd = round2(totalRevenueUsd - totalCostUsd);

  const profitabilitySummaryRows = [
    {
      id: "revenue",
      metric: "Total Revenue",
      amount_usd: totalRevenueUsd,
      source: "Sales receipts and rental receipts",
    },
    {
      id: "cost",
      metric: "Total Cost",
      amount_usd: totalCostUsd,
      source: "Payroll, purchase payments, and municipality payments",
    },
    {
      id: "profit",
      metric: "Total Profit",
      amount_usd: totalProfitUsd,
      source: "Revenue minus cost for the selected period",
    },
  ];

  const balanceRows = filteredAccounts.map((account) => {
    const accountId = Number(account.id || 0);
    const accountTransactions = transactionsByAccountId.get(accountId) ?? [];

    const txBeforeRange = accountTransactions.filter((row) => {
      const timestamp = Number(row.transaction_date ?? row.created_at ?? row.updated_at ?? 0);
      return fromTs !== null && timestamp > 0 && timestamp < fromTs;
    });

    const txInRange = accountTransactions.filter((row) => {
      const timestamp = Number(row.transaction_date ?? row.created_at ?? row.updated_at ?? 0);
      if (!timestamp) return false;
      if (fromTs !== null && timestamp < fromTs) return false;
      if (toTs !== null && timestamp > toTs) return false;
      return true;
    });

    const beforeNet = round2(
      txBeforeRange.reduce((total, row) => {
        const amount = Number(row.amount || 0);
        return total + (String(row.direction || "").toLowerCase() === "in" ? amount : -amount);
      }, 0)
    );
    const openingBalance = round2(Number(account.opening_balance || 0) + beforeNet);
    const periodInflow = round2(
      txInRange.reduce(
        (total, row) => total + (String(row.direction || "").toLowerCase() === "in" ? Number(row.amount || 0) : 0),
        0
      )
    );
    const periodOutflow = round2(
      txInRange.reduce(
        (total, row) => total + (String(row.direction || "").toLowerCase() === "out" ? Number(row.amount || 0) : 0),
        0
      )
    );
    const closingBalance = round2(openingBalance + periodInflow - periodOutflow);

    return {
      id: account.uuid,
      account_name: account.name,
      account_type: humanize(account.account_type),
      currency: account.currency,
      opening_balance: openingBalance,
      period_inflow: periodInflow,
      period_outflow: periodOutflow,
      closing_balance: closingBalance,
      current_balance: Number(account.current_balance || 0),
      status: statusText(account.status),
    };
  });

  const currencyBalanceRows = Array.from(
    balanceRows.reduce<Map<string, {
      id: string;
      currency: string;
      accounts_count: number;
      opening_balance: number;
      period_inflow: number;
      period_outflow: number;
      closing_balance: number;
      current_balance: number;
    }>>((map, row) => {
      const currency = String(row.currency || "USD").toUpperCase();
      const current = map.get(currency) ?? {
        id: currency,
        currency,
        accounts_count: 0,
        opening_balance: 0,
        period_inflow: 0,
        period_outflow: 0,
        closing_balance: 0,
        current_balance: 0,
      };

      current.accounts_count += 1;
      current.opening_balance = round2(current.opening_balance + Number(row.opening_balance || 0));
      current.period_inflow = round2(current.period_inflow + Number(row.period_inflow || 0));
      current.period_outflow = round2(current.period_outflow + Number(row.period_outflow || 0));
      current.closing_balance = round2(current.closing_balance + Number(row.closing_balance || 0));
      current.current_balance = round2(current.current_balance + Number(row.current_balance || 0));
      map.set(currency, current);
      return map;
    }, new Map())
  ).map(([, row]) => row);

  return finalizeBundle("accounts", filters, {
    metrics: [
      { label: "Accounts", value: compactNumber(filteredAccounts.length), tone: "blue" },
      {
        label: "Opening Balance",
        value: summarizeCurrencyTotals(
          currencyBalanceRows.map((row) => ({ amount: Number(row.opening_balance || 0), currency: String(row.currency || "USD") }))
        ),
        hint: "Balance before the selected period starts",
        tone: "emerald",
      },
      {
        label: "Period Inflow",
        value: summarizeCurrencyTotals(
          currencyBalanceRows.map((row) => ({ amount: Number(row.period_inflow || 0), currency: String(row.currency || "USD") }))
        ),
        tone: "blue",
      },
      {
        label: "Period Outflow",
        value: summarizeCurrencyTotals(
          currencyBalanceRows.map((row) => ({ amount: Number(row.period_outflow || 0), currency: String(row.currency || "USD") }))
        ),
        tone: "amber",
      },
      {
        label: "Closing Balance",
        value: summarizeCurrencyTotals(
          currencyBalanceRows.map((row) => ({ amount: Number(row.closing_balance || 0), currency: String(row.currency || "USD") }))
        ),
        hint: "Opening balance + inflow - outflow",
        tone: "rose",
      },
      {
        label: "Total Revenue",
        value: money(totalRevenueUsd),
        hint: "Posted sales and rental cash received in the selected period",
        tone: "emerald",
      },
      {
        label: "Total Cost",
        value: money(totalCostUsd),
        hint: "Posted payroll, purchase, and municipality cash paid in the selected period",
        tone: "amber",
      },
      {
        label: "Total Profit",
        value: money(totalProfitUsd),
        hint: "Cash-based revenue minus cost for the selected period",
        tone: totalProfitUsd >= 0 ? "blue" : "rose",
      },
    ],
    sections: [
      {
        key: "account-profitability-summary",
        title: "Revenue, Cost, and Profit Summary",
        subtitle: "Cash-based USD totals for the selected period using posted business transactions only.",
        rows: profitabilitySummaryRows,
        pageSize: 3,
        columns: [
          { key: "metric", label: "Metric" },
          { key: "amount_usd", label: "Amount", kind: "money", staticCurrency: "USD" },
          { key: "source", label: "Source" },
        ],
      },
      {
        key: "account-balance-by-currency",
        title: "Balance Summary By Currency",
        subtitle: "Opening, movement, and closing balance between the selected dates.",
        rows: currencyBalanceRows,
        pageSize: 6,
        columns: [
          { key: "currency", label: "Currency" },
          { key: "accounts_count", label: "Accounts", kind: "number" },
          { key: "opening_balance", label: "Opening Balance", kind: "money", currencyKey: "currency" },
          { key: "period_inflow", label: "Inflow", kind: "money", currencyKey: "currency" },
          { key: "period_outflow", label: "Outflow", kind: "money", currencyKey: "currency" },
          { key: "closing_balance", label: "Closing Balance", kind: "money", currencyKey: "currency" },
        ],
      },
      {
        key: "account-balance-by-account",
        title: "Balance By Account",
        subtitle: "Per-account opening balance, period movement, and closing balance for the selected range.",
        rows: balanceRows,
        pageSize: DEFAULT_TABLE_PAGE_SIZE,
        searchKeys: ["account_name", "account_type", "currency", "status"],
        columns: [
          { key: "account_name", label: "Account" },
          { key: "account_type", label: "Type" },
          { key: "currency", label: "Currency" },
          { key: "opening_balance", label: "Opening Balance", kind: "money", currencyKey: "currency" },
          { key: "period_inflow", label: "Inflow", kind: "money", currencyKey: "currency" },
          { key: "period_outflow", label: "Outflow", kind: "money", currencyKey: "currency" },
          { key: "closing_balance", label: "Closing Balance", kind: "money", currencyKey: "currency" },
          { key: "status", label: "Status", kind: "status" },
        ],
      },
    ],
    charts: [
      {
        key: "accounts-profit-summary",
        title: "Revenue, Cost, and Profit (USD)",
        subtitle: "Cash-based totals for the selected period.",
        type: "bar",
        categoryKey: "label",
        data: [
          {
            label: "Selected Period",
            revenue: totalRevenueUsd,
            cost: totalCostUsd,
            profit: totalProfitUsd,
          },
        ],
        series: [
          { key: "revenue", label: "Revenue", color: "#10b981" },
          { key: "cost", label: "Cost", color: "#f59e0b" },
          { key: "profit", label: "Profit", color: "#2563eb" },
        ],
      },
      {
        key: "accounts-profit-monthly",
        title: "Monthly Revenue, Cost, and Profit (USD)",
        subtitle: "Profit is calculated as revenue minus cost for each month.",
        type: "line",
        categoryKey: "label",
        data: buildMonthlySeries(profitabilityTransactions, {
          getTimestamp: (row) => Number(row.transaction_date || 0),
          reducers: {
            revenue: (current, row) =>
              round2(current + (row.business_flow === "revenue" ? Number(row.amount_usd || 0) : 0)),
            cost: (current, row) =>
              round2(current + (row.business_flow === "cost" ? Number(row.amount_usd || 0) : 0)),
            profit: (current, row) =>
              round2(
                current +
                  (row.business_flow === "revenue"
                    ? Number(row.amount_usd || 0)
                    : row.business_flow === "cost"
                      ? -Number(row.amount_usd || 0)
                      : 0)
              ),
          },
        }),
        series: [
          { key: "revenue", label: "Revenue", color: "#10b981" },
          { key: "cost", label: "Cost", color: "#f59e0b" },
          { key: "profit", label: "Profit", color: "#2563eb" },
        ],
      },
      {
        key: "accounts-type",
        title: "Account Type Mix",
        subtitle: "Active account distribution by account type.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(filteredAccounts, { getLabel: (row) => humanize(row.account_type), limit: 8 }),
        series: [{ key: "value", label: "Accounts", color: "#0ea5e9" }],
      },
      {
        key: "accounts-monthly",
        title: "Transaction Flow (USD)",
        subtitle: "Monthly inflow and outflow from account transactions.",
        type: "bar",
        categoryKey: "label",
        data: buildMonthlySeries(filteredTransactions, {
          getTimestamp: (row) => Number(row.transaction_date || 0),
          reducers: {
            inflow: (current, row) => round2(current + (row.direction === "In" ? Number(row.amount_usd || 0) : 0)),
            outflow: (current, row) => round2(current + (row.direction === "Out" ? Number(row.amount_usd || 0) : 0)),
          },
        }),
        series: [
          { key: "inflow", label: "Inflow", color: "#10b981" },
          { key: "outflow", label: "Outflow", color: "#ef4444" },
        ],
      },
    ],
    table: {
      title: "Account Transactions",
      subtitle: "Date-filtered transaction history from account-linked modules.",
      rows: filteredTransactions,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["account_name", "module", "direction", "status", "description"],
      columns: [
        { key: "transaction_date", label: "Date", kind: "date" },
        { key: "account_name", label: "Account" },
        { key: "module", label: "Module" },
        { key: "direction", label: "Direction", kind: "status" },
        { key: "amount", label: "Amount", kind: "money", currencyKey: "amount_currency" },
        { key: "amount_usd", label: "USD Value", kind: "money", staticCurrency: "USD" },
        { key: "status", label: "Status", kind: "status" },
      ],
    },
  });
}

async function buildProjectsReport(filters: ReportFilters): Promise<ReportBundle> {
  const projects = (await db.projects.toArray()).filter((row) => matchesDateRange(row.start_date ?? row.updated_at, filters));
  const rows = projects
    .map((row) => {
      const assignedCount = Array.isArray(row.assigned_employees)
        ? row.assigned_employees.filter((item) => item?.name).length
        : Array.isArray(row.assigned_employee_ids)
          ? row.assigned_employee_ids.length
          : 0;

      return {
        id: row.uuid,
        project_name: row.name,
        project_manager_name: row.project_manager_name || "-",
        location: row.location || "-",
        status: statusText(row.status),
        assigned_count: assignedCount,
        start_date: row.start_date ?? row.updated_at,
        end_date: row.end_date ?? null,
        updated_at: row.updated_at,
      };
    })
    .filter((row) =>
      matchesSearch(row, filters.search, ["project_name", "project_manager_name", "location", "status"])
    );

  return finalizeBundle("projects", filters, {
    metrics: [
      { label: "Projects", value: compactNumber(rows.length), tone: "blue" },
      { label: "Active", value: compactNumber(rows.filter((row) => row.status === "Active").length), tone: "emerald" },
      { label: "Completed", value: compactNumber(rows.filter((row) => row.status === "Completed").length), tone: "amber" },
      { label: "Assigned Employees", value: compactNumber(sumRows(rows, (row) => Number(row.assigned_count || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "projects-status",
        title: "Project Status",
        subtitle: "Filtered project lifecycle states.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Projects", color: "#3b82f6" }],
      },
      {
        key: "projects-starts",
        title: "Project Starts",
        subtitle: "Monthly project start trend.",
        type: "bar",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.start_date || 0),
          reducers: { starts: (current) => current + 1 },
        }),
        series: [{ key: "starts", label: "Project Starts", color: "#8b5cf6" }],
      },
    ],
    table: {
      title: "Projects",
      subtitle: "Project timelines, ownership, and assignment coverage.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["project_name", "project_manager_name", "location", "status"],
      columns: [
        { key: "project_name", label: "Project" },
        { key: "project_manager_name", label: "Project Manager" },
        { key: "location", label: "Location" },
        { key: "assigned_count", label: "Assigned", kind: "number" },
        { key: "status", label: "Status", kind: "status" },
        { key: "start_date", label: "Start Date", kind: "date" },
        { key: "end_date", label: "End Date", kind: "date" },
      ],
    },
  });
}

async function buildInventoryReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.stock_movements.toArray())
    .filter((row) => matchesDateRange(row.movement_date, filters))
    .map((row) => ({
      id: row.uuid,
      movement_date: row.movement_date,
      movement_type: humanize(row.movement_type),
      material_name: row.material_name || "-",
      warehouse_name: row.warehouse_name || "-",
      project_name: row.project_name || "-",
      quantity: Number(row.quantity || 0),
      unit: row.material_unit || "",
      reference_no: row.reference_no || "-",
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "movement_type",
        "material_name",
        "warehouse_name",
        "project_name",
        "reference_no",
      ])
    );

  const inboundQty = sumRows(
    rows.filter((row) => ["In", "Transfer In", "Return", "Adjustment"].includes(row.movement_type)),
    (row) => Number(row.quantity || 0)
  );
  const outboundQty = sumRows(
    rows.filter((row) => ["Out", "Transfer Out"].includes(row.movement_type)),
    (row) => Number(row.quantity || 0)
  );

  return finalizeBundle("inventory", filters, {
    metrics: [
      { label: "Movements", value: compactNumber(rows.length), tone: "blue" },
      { label: "Inbound Qty", value: compactNumber(inboundQty), tone: "emerald" },
      { label: "Outbound Qty", value: compactNumber(outboundQty), tone: "amber" },
      { label: "Projects Touched", value: compactNumber(new Set(rows.map((row) => row.project_name).filter((value) => value !== "-")).size), tone: "rose" },
    ],
    charts: [
      {
        key: "inventory-types",
        title: "Movement Type Split",
        subtitle: "Inbound, outbound, transfer, and return counts.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.movement_type), limit: 8 }),
        series: [{ key: "value", label: "Movements", color: "#0ea5e9" }],
      },
      {
        key: "inventory-monthly",
        title: "Monthly Movement Volume",
        subtitle: "In and out quantity trend by month.",
        type: "bar",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.movement_date || 0),
          reducers: {
            inbound: (current, row) =>
              round2(current + (["In", "Transfer In", "Return", "Adjustment"].includes(row.movement_type) ? Number(row.quantity || 0) : 0)),
            outbound: (current, row) =>
              round2(current + (["Out", "Transfer Out"].includes(row.movement_type) ? Number(row.quantity || 0) : 0)),
          },
        }),
        series: [
          { key: "inbound", label: "Inbound", color: "#10b981" },
          { key: "outbound", label: "Outbound", color: "#ef4444" },
        ],
      },
    ],
    table: {
      title: "Movement History",
      subtitle: "Warehouse and project stock flow records.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["movement_type", "material_name", "warehouse_name", "project_name", "reference_no"],
      columns: [
        { key: "movement_date", label: "Date", kind: "date" },
        { key: "movement_type", label: "Type", kind: "status" },
        { key: "material_name", label: "Material" },
        { key: "warehouse_name", label: "Warehouse" },
        { key: "project_name", label: "Project" },
        { key: "quantity", label: "Quantity", kind: "number" },
        { key: "reference_no", label: "Reference" },
      ],
    },
  });
}

async function buildMaterialRequestsReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.material_requests.toArray())
    .filter((row) => matchesDateRange(row.requested_at ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: row.uuid,
      request_no: row.request_no,
      project_name: row.project_name || "-",
      warehouse_name: row.warehouse_name || "-",
      requested_by_name: row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "-",
      requested_at: row.requested_at ?? row.created_at ?? row.updated_at,
      status: statusText(row.status),
      total_requested_qty: requestQuantityTotal(row.items),
      total_issued_qty: requestIssuedTotal(row.items, "issued"),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "request_no",
        "project_name",
        "warehouse_name",
        "requested_by_name",
        "status",
      ])
    );

  return finalizeBundle("material-requests", filters, {
    metrics: [
      { label: "Requests", value: compactNumber(rows.length), tone: "blue" },
      { label: "Pending Approval", value: compactNumber(rows.filter((row) => row.status === "Pending Admin Approval").length), tone: "amber" },
      { label: "Requested Qty", value: compactNumber(sumRows(rows, (row) => Number(row.total_requested_qty || 0))), tone: "emerald" },
      { label: "Issued Qty", value: compactNumber(sumRows(rows, (row) => Number(row.total_issued_qty || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "material-requests-status",
        title: "Request Status",
        subtitle: "Approval and fulfillment progression.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Requests", color: "#f59e0b" }],
      },
      {
        key: "material-requests-projects",
        title: "Requests By Project",
        subtitle: "Which projects are requesting the most material lines.",
        type: "bar",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, {
          getLabel: (row) => String(row.project_name),
          getValue: (row) => Number(row.total_requested_qty || 0),
          limit: 8,
        }),
        series: [{ key: "value", label: "Qty Requested", color: "#10b981" }],
      },
    ],
    table: {
      title: "Material Requests",
      subtitle: "Approval-driven material demand and issue progress.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["request_no", "project_name", "warehouse_name", "requested_by_name", "status"],
      columns: [
        { key: "request_no", label: "Request No." },
        { key: "project_name", label: "Project" },
        { key: "warehouse_name", label: "Warehouse" },
        { key: "requested_by_name", label: "Requested By" },
        { key: "requested_at", label: "Requested At", kind: "date" },
        { key: "status", label: "Status", kind: "status" },
        { key: "total_requested_qty", label: "Qty Requested", kind: "number" },
        { key: "total_issued_qty", label: "Qty Issued", kind: "number" },
      ],
    },
  });
}

async function buildPurchaseRequestsReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.purchase_requests.toArray())
    .filter((row) => matchesDateRange(row.requested_at ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: row.uuid,
      request_no: row.request_no,
      request_type: humanize(row.request_type),
      vendor_name: row.vendor_name || "-",
      warehouse_name: row.warehouse_name || "-",
      project_name: row.project_name || "-",
      requested_at: row.requested_at ?? row.created_at ?? row.updated_at,
      status: statusText(row.status),
      estimated_grand_total: Number(row.estimated_grand_total || 0),
      payment_amount: Number(row.payment_amount || 0),
      received_grand_total: Number(row.received_grand_total || 0),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "request_no",
        "request_type",
        "vendor_name",
        "warehouse_name",
        "project_name",
        "status",
      ])
    );

  return finalizeBundle("purchase-requests", filters, {
    metrics: [
      { label: "Purchase Requests", value: compactNumber(rows.length), tone: "blue" },
      { label: "Estimated Total", value: money(sumRows(rows, (row) => Number(row.estimated_grand_total || 0))), tone: "emerald" },
      { label: "Paid Total", value: money(sumRows(rows, (row) => Number(row.payment_amount || 0))), tone: "amber" },
      { label: "Received Total", value: money(sumRows(rows, (row) => Number(row.received_grand_total || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "purchase-requests-status",
        title: "Purchase Request Status",
        subtitle: "Approval, finance, and receive queue breakdown.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Requests", color: "#ef4444" }],
      },
      {
        key: "purchase-requests-type",
        title: "Request Type Mix",
        subtitle: "Material versus asset purchase requests.",
        type: "bar",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.request_type), limit: 4 }),
        series: [{ key: "value", label: "Requests", color: "#0ea5e9" }],
      },
    ],
    table: {
      title: "Purchase Requests",
      subtitle: "Estimated, paid, and received purchasing totals.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["request_no", "request_type", "vendor_name", "warehouse_name", "project_name", "status"],
      columns: [
        { key: "request_no", label: "Request No." },
        { key: "request_type", label: "Type" },
        { key: "vendor_name", label: "Supplier" },
        { key: "warehouse_name", label: "Warehouse" },
        { key: "status", label: "Status", kind: "status" },
        { key: "requested_at", label: "Requested At", kind: "date" },
        { key: "estimated_grand_total", label: "Estimated", kind: "money", staticCurrency: "USD" },
        { key: "payment_amount", label: "Paid", kind: "money", staticCurrency: "USD" },
      ],
    },
  });
}

async function buildAssetRequestsReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.asset_requests.toArray())
    .filter((row) => matchesDateRange(row.requested_at ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: row.uuid,
      request_no: row.request_no,
      project_name: row.project_name || "-",
      requested_asset_name: row.requested_asset_name || row.requested_asset_code || "-",
      asset_type: row.asset_type || "-",
      quantity_requested: Number(row.quantity_requested || 0),
      quantity_allocated: Number(row.quantity_allocated || 0),
      requested_at: row.requested_at ?? row.created_at ?? row.updated_at,
      status: statusText(row.status),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "request_no",
        "project_name",
        "requested_asset_name",
        "asset_type",
        "status",
      ])
    );

  return finalizeBundle("asset-requests", filters, {
    metrics: [
      { label: "Asset Requests", value: compactNumber(rows.length), tone: "blue" },
      { label: "Pending Approval", value: compactNumber(rows.filter((row) => row.status === "Pending Admin Approval").length), tone: "amber" },
      { label: "Requested Qty", value: compactNumber(sumRows(rows, (row) => Number(row.quantity_requested || 0))), tone: "emerald" },
      { label: "Allocated Qty", value: compactNumber(sumRows(rows, (row) => Number(row.quantity_allocated || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "asset-requests-status",
        title: "Asset Request Status",
        subtitle: "Pending, approved, allocated, and returned states.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Requests", color: "#8b5cf6" }],
      },
      {
        key: "asset-requests-type",
        title: "Asset Types Requested",
        subtitle: "Most requested asset categories.",
        type: "bar",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, {
          getLabel: (row) => String(row.asset_type),
          getValue: (row) => Number(row.quantity_requested || 0),
          limit: 8,
        }),
        series: [{ key: "value", label: "Qty Requested", color: "#3b82f6" }],
      },
    ],
    table: {
      title: "Asset Requests",
      subtitle: "Project demand, requested quantities, and allocations.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["request_no", "project_name", "requested_asset_name", "asset_type", "status"],
      columns: [
        { key: "request_no", label: "Request No." },
        { key: "project_name", label: "Project" },
        { key: "requested_asset_name", label: "Asset" },
        { key: "asset_type", label: "Asset Type" },
        { key: "quantity_requested", label: "Requested", kind: "number" },
        { key: "quantity_allocated", label: "Allocated", kind: "number" },
        { key: "status", label: "Status", kind: "status" },
        { key: "requested_at", label: "Requested At", kind: "date" },
      ],
    },
  });
}

async function buildRentalsReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.rentals.toArray())
    .filter((row) => matchesDateRange(row.contract_start ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: row.uuid,
      rental_id: row.rental_id,
      tenant_name: row.tenant_name || "-",
      apartment_code: row.apartment_code || "-",
      contract_start: row.contract_start,
      contract_end: row.contract_end,
      monthly_rent: Number(row.monthly_rent || 0),
      rent_currency: "USD",
      advance_months: Number(row.advance_months || 0),
      status: statusText(row.status),
      key_handover_status: statusText(row.key_handover_status),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, ["rental_id", "tenant_name", "apartment_code", "status", "key_handover_status"])
    );

  return finalizeBundle("rentals", filters, {
    metrics: [
      { label: "Rental Contracts", value: compactNumber(rows.length), tone: "blue" },
      { label: "Active", value: compactNumber(rows.filter((row) => row.status === "Active").length), tone: "emerald" },
      { label: "Waiting Approval", value: compactNumber(rows.filter((row) => row.status === "Pending Admin Approval" || row.status === "Pending").length), tone: "amber" },
      { label: "Monthly Rent Total", value: money(sumRows(rows, (row) => Number(row.monthly_rent || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "rentals-status",
        title: "Rental Status",
        subtitle: "Contract state distribution.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.status), limit: 8 }),
        series: [{ key: "value", label: "Contracts", color: "#10b981" }],
      },
      {
        key: "rentals-monthly",
        title: "Rental Contract Starts",
        subtitle: "Monthly rental contract start trend.",
        type: "bar",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.contract_start || 0),
          reducers: { contracts: (current) => current + 1 },
        }),
        series: [{ key: "contracts", label: "Contracts", color: "#0ea5e9" }],
      },
    ],
    table: {
      title: "Rental Contracts",
      subtitle: "Tenant occupancy, rent, and handover visibility.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["rental_id", "tenant_name", "apartment_code", "status", "key_handover_status"],
      columns: [
        { key: "rental_id", label: "Rental No." },
        { key: "tenant_name", label: "Tenant" },
        { key: "apartment_code", label: "Apartment" },
        { key: "contract_start", label: "Start", kind: "date" },
        { key: "contract_end", label: "End", kind: "date" },
        { key: "monthly_rent", label: "Monthly Rent", kind: "money", staticCurrency: "USD" },
        { key: "status", label: "Status", kind: "status" },
        { key: "key_handover_status", label: "Key Handover", kind: "status" },
      ],
    },
  });
}

async function buildRentalPaymentsReport(filters: ReportFilters): Promise<ReportBundle> {
  const rows = (await db.rental_payments.toArray())
    .filter((row) => matchesDateRange(row.paid_date ?? row.bill_generated_at ?? row.due_date ?? row.created_at ?? row.updated_at, filters))
    .map((row) => ({
      id: row.uuid,
      bill_no: row.bill_no || "-",
      rental_code: row.rental_code || "-",
      tenant_name: row.tenant_name || "-",
      apartment_code: row.apartment_code || "-",
      payment_type: humanize(row.payment_type),
      amount_due: Number(row.amount_due || 0),
      amount_paid: Number(row.amount_paid || 0),
      remaining_amount: Number(row.remaining_amount || 0),
      due_date: row.due_date,
      paid_date: row.paid_date ?? row.bill_generated_at ?? row.created_at ?? row.updated_at,
      status: statusText(row.status),
    }))
    .filter((row) =>
      matchesSearch(row, filters.search, [
        "bill_no",
        "rental_code",
        "tenant_name",
        "apartment_code",
        "payment_type",
        "status",
      ])
    );

  return finalizeBundle("rental-payments", filters, {
    metrics: [
      { label: "Rental Bills", value: compactNumber(rows.length), tone: "blue" },
      { label: "Amount Due", value: money(sumRows(rows, (row) => Number(row.amount_due || 0))), tone: "amber" },
      { label: "Amount Paid", value: money(sumRows(rows, (row) => Number(row.amount_paid || 0))), tone: "emerald" },
      { label: "Remaining", value: money(sumRows(rows, (row) => Number(row.remaining_amount || 0))), tone: "rose" },
    ],
    charts: [
      {
        key: "rental-payments-type",
        title: "Payment Type Mix",
        subtitle: "Advance, monthly, late fee, and adjustment counts.",
        type: "pie",
        categoryKey: "label",
        data: buildBreakdownSeries(rows, { getLabel: (row) => String(row.payment_type), limit: 8 }),
        series: [{ key: "value", label: "Bills", color: "#06b6d4" }],
      },
      {
        key: "rental-payments-monthly",
        title: "Monthly Collections",
        subtitle: "Amount paid by month for the filtered bills.",
        type: "line",
        categoryKey: "label",
        data: buildMonthlySeries(rows, {
          getTimestamp: (row) => Number(row.paid_date || 0),
          reducers: { paid: (current, row) => round2(current + Number(row.amount_paid || 0)) },
        }),
        series: [{ key: "paid", label: "Amount Paid", color: "#10b981" }],
      },
    ],
    table: {
      title: "Rental Payments",
      subtitle: "Bills, collected rent, and outstanding balances.",
      rows,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      searchKeys: ["bill_no", "rental_code", "tenant_name", "apartment_code", "payment_type", "status"],
      columns: [
        { key: "bill_no", label: "Bill No." },
        { key: "rental_code", label: "Rental No." },
        { key: "tenant_name", label: "Tenant" },
        { key: "payment_type", label: "Type" },
        { key: "amount_due", label: "Amount Due", kind: "money", staticCurrency: "USD" },
        { key: "amount_paid", label: "Paid", kind: "money", staticCurrency: "USD" },
        { key: "remaining_amount", label: "Remaining", kind: "money", staticCurrency: "USD" },
        { key: "status", label: "Status", kind: "status" },
        { key: "paid_date", label: "Paid / Created", kind: "date" },
      ],
    },
  });
}

export async function loadReportBundle(key: ReportKey, filters: ReportFilters): Promise<ReportBundle> {
  switch (key) {
    case "apartments":
      return buildApartmentsReport(filters);
    case "customers":
      return buildCustomersReport(filters);
    case "sales":
      return buildSalesReport(filters);
    case "installments":
      return buildInstallmentsReport(filters);
    case "documents":
      return buildDocumentsReport(filters);
    case "crm":
      return buildCrmReport(filters);
    case "employees":
      return buildEmployeesReport(filters);
    case "payroll":
      return buildPayrollReport(filters);
    case "accounts":
      return buildAccountsReport(filters);
    case "projects":
      return buildProjectsReport(filters);
    case "inventory":
      return buildInventoryReport(filters);
    case "material-requests":
      return buildMaterialRequestsReport(filters);
    case "purchase-requests":
      return buildPurchaseRequestsReport(filters);
    case "asset-requests":
      return buildAssetRequestsReport(filters);
    case "rentals":
      return buildRentalsReport(filters);
    case "rental-payments":
      return buildRentalPaymentsReport(filters);
    default:
      return finalizeBundle("apartments", filters, {
        metrics: [],
        charts: [],
        table: {
          title: "Unavailable Report",
          columns: [],
          rows: [],
        },
      });
  }
}
