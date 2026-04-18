export type ReportKey =
  | "apartments"
  | "customers"
  | "sales"
  | "installments"
  | "documents"
  | "crm"
  | "employees"
  | "payroll"
  | "accounts"
  | "projects"
  | "inventory"
  | "material-requests"
  | "purchase-requests"
  | "asset-requests"
  | "rentals"
  | "rental-payments";

export type ReportFilters = {
  fromDate: string;
  toDate: string;
  search: string;
  accountUuid: string;
  accountLabel: string;
};

export type ReportMetricTone = "amber" | "blue" | "emerald" | "rose" | "slate";

export type ReportMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: ReportMetricTone;
};

export type ReportChartType = "bar" | "line" | "pie";

export type ReportChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type ReportChart = {
  key: string;
  title: string;
  subtitle?: string;
  type: ReportChartType;
  categoryKey: string;
  data: Array<Record<string, string | number>>;
  series: ReportChartSeries[];
};

export type ReportTableColumnKind = "text" | "number" | "money" | "date" | "status";

export type ReportTableColumn = {
  key: string;
  label: string;
  kind?: ReportTableColumnKind;
  currencyKey?: string;
  staticCurrency?: string;
};

export type ReportTableRow = {
  id: string;
  [key: string]: string | number | null | undefined;
};

export type ReportTable = {
  title: string;
  subtitle?: string;
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  searchKeys?: string[];
  pageSize?: number;
};

export type ReportSection = ReportTable & {
  key: string;
};

export type ReportBundle = {
  key: ReportKey;
  title: string;
  subtitle: string;
  emptyMessage: string;
  offlineCapable: boolean;
  generatedAt: number;
  scopeLabel: string;
  filters: ReportFilters;
  metrics: ReportMetric[];
  sections?: ReportSection[];
  charts: ReportChart[];
  table: ReportTable;
};

export function isReportKey(value: string): value is ReportKey {
  return [
    "apartments",
    "customers",
    "sales",
    "installments",
    "documents",
    "crm",
    "employees",
    "payroll",
    "accounts",
    "projects",
    "inventory",
    "material-requests",
    "purchase-requests",
    "asset-requests",
    "rentals",
    "rental-payments",
  ].includes(value);
}
