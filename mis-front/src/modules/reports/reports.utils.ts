"use client";

import { formatMoney, normalizeCurrency } from "@/lib/currency";
import type {
  ReportFilters,
  ReportMetricTone,
  ReportTableColumn,
  ReportTableRow,
} from "@/modules/reports/reports.types";

export function round2(value: number): number {
  return Number(Number(value || 0).toFixed(2));
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function wholeNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDateLabel(value?: number | string | null): string {
  const timestamp = safeTimestamp(value);
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString();
}

export function formatDateTimeLabel(value?: number | string | null): string {
  const timestamp = safeTimestamp(value);
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString();
}

export function formatCellValue(row: ReportTableRow, column: ReportTableColumn): string {
  const value = row[column.key];
  const kind = column.kind ?? "text";

  if (kind === "money") {
    const currency = column.currencyKey
      ? String(row[column.currencyKey] ?? column.staticCurrency ?? "USD")
      : String(column.staticCurrency ?? "USD");

    return formatMoney(Number(value ?? 0), normalizeCurrency(currency));
  }

  if (kind === "number") {
    return wholeNumber(Number(value ?? 0));
  }

  if (kind === "date") {
    return formatDateLabel(value);
  }

  return String(value ?? "-") || "-";
}

export function toneClasses(tone: ReportMetricTone = "slate"): string {
  switch (tone) {
    case "amber":
      return "from-amber-500 to-orange-500";
    case "blue":
      return "from-blue-500 to-cyan-500";
    case "emerald":
      return "from-emerald-500 to-teal-500";
    case "rose":
      return "from-rose-500 to-pink-500";
    default:
      return "from-slate-600 to-slate-800";
  }
}

export function safeTimestamp(value?: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseDateInputStart(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDateInputEnd(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Date.parse(`${value}T23:59:59.999`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function matchesDateRange(timestamp: number | string | null | undefined, filters: ReportFilters): boolean {
  const ts = safeTimestamp(timestamp);
  if (!ts) return !filters.fromDate && !filters.toDate;

  const from = parseDateInputStart(filters.fromDate);
  const to = parseDateInputEnd(filters.toDate);

  if (from !== null && ts < from) return false;
  if (to !== null && ts > to) return false;
  return true;
}

export function matchesSearch<T extends Record<string, unknown>>(row: T, search: string, keys: string[]): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return keys.some((key) => String(row[key] ?? "").toLowerCase().includes(query));
}

export function monthBucketKey(timestamp: number | null | undefined): string | null {
  const ts = Number(timestamp ?? 0);
  if (!ts) return null;
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function monthBucketLabel(bucketKey: string): string {
  const [yearText, monthText] = bucketKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = new Date(year, Math.max(0, month - 1), 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function buildMonthlySeries<T>(
  rows: T[],
  options: {
    getTimestamp: (row: T) => number | null | undefined;
    reducers: Record<string, (current: number, row: T) => number>;
    limit?: number;
  }
): Array<Record<string, string | number>> {
  const buckets = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const bucket = monthBucketKey(options.getTimestamp(row));
    if (!bucket) continue;

    const current = buckets.get(bucket) ?? {};
    for (const [key, reducer] of Object.entries(options.reducers)) {
      current[key] = reducer(current[key] ?? 0, row);
    }
    buckets.set(bucket, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-(options.limit ?? 6))
    .map(([bucket, values]) => ({
      label: monthBucketLabel(bucket),
      ...values,
    }));
}

export function buildBreakdownSeries<T>(
  rows: T[],
  options: {
    getLabel: (row: T) => string;
    getValue?: (row: T) => number;
    limit?: number;
  }
): Array<Record<string, string | number>> {
  const values = new Map<string, number>();

  for (const row of rows) {
    const label = options.getLabel(row).trim() || "Unknown";
    const value = Number(options.getValue ? options.getValue(row) : 1);
    values.set(label, round2((values.get(label) ?? 0) + value));
  }

  return Array.from(values.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, options.limit ?? 6)
    .map(([label, value]) => ({ label, value }));
}

export function sumRows<T>(rows: T[], selector: (row: T) => number): number {
  return round2(rows.reduce((total, row) => total + Number(selector(row) || 0), 0));
}

export function summarizeCurrencyTotals(entries: Array<{ amount: number; currency: string }>): string {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const currency = String(entry.currency || "USD").toUpperCase();
    totals.set(currency, round2((totals.get(currency) ?? 0) + Number(entry.amount || 0)));
  }

  if (totals.size === 0) {
    return formatMoney(0, "USD");
  }

  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatMoney(amount, normalizeCurrency(currency)))
    .join(" / ");
}

export function buildScopeLabel(filters: ReportFilters): string {
  const from = filters.fromDate.trim();
  const to = filters.toDate.trim();
  const accountLabel = filters.accountLabel.trim();
  const parts: string[] = [];

  if (from && to) {
    parts.push(`From ${from} to ${to}`);
  } else if (from) {
    parts.push(`From ${from}`);
  } else if (to) {
    parts.push(`Until ${to}`);
  } else {
    parts.push("All available dates");
  }

  if (accountLabel) {
    parts.push(`Account: ${accountLabel}`);
  }

  return parts.join(" | ");
}
