"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";

import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { REPORT_DEFINITION_MAP } from "@/config/report-nav";
import { db } from "@/db/localDB";
import { notifyError } from "@/lib/notify";
import { loadReportBundle, refreshReportBundleSources } from "@/modules/reports/reports.repo";
import type { ReportFilters, ReportKey, ReportTableColumn, ReportTableRow } from "@/modules/reports/reports.types";
import { formatCellValue, formatDateTimeLabel, toneClasses } from "@/modules/reports/reports.utils";
import { ReportCharts } from "@/components/reports/ReportCharts";
import type { RootState } from "@/store/store";

function readFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    fromDate: searchParams.get("from") ?? "",
    toDate: searchParams.get("to") ?? "",
    search: searchParams.get("q") ?? "",
    accountUuid: searchParams.get("account") ?? "",
    accountLabel: searchParams.get("accountLabel") ?? "",
  };
}

function buildSearchString(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.fromDate.trim()) params.set("from", filters.fromDate.trim());
  if (filters.toDate.trim()) params.set("to", filters.toDate.trim());
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.accountUuid.trim()) params.set("account", filters.accountUuid.trim());
  if (filters.accountLabel.trim()) params.set("accountLabel", filters.accountLabel.trim());
  return params.toString();
}

function statusBadgeColor(value: string): "blue" | "emerald" | "amber" | "red" | "purple" | "slate" {
  const normalized = value.trim().toLowerCase();
  if (["active", "approved", "completed", "paid", "received", "issued", "in", "synced"].includes(normalized)) return "emerald";
  if (["pending", "pending admin approval", "queued", "waiting ref sync", "partial", "draft"].includes(normalized)) return "amber";
  if (["cancelled", "rejected", "failed", "out", "defaulted", "terminated"].includes(normalized)) return "red";
  if (["inactive", "returned"].includes(normalized)) return "purple";
  return "blue";
}

function renderReportCell(row: ReportTableRow, column: ReportTableColumn) {
  if ((column.kind ?? "text") === "status") {
    const value = String(row[column.key] ?? "-");
    return <Badge color={statusBadgeColor(value)}>{value}</Badge>;
  }

  return <span>{formatCellValue(row, column)}</span>;
}

function currentMonthRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { fromDate: format(start), toDate: format(end) };
}

function last30DaysRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { fromDate: format(start), toDate: format(now) };
}

export default function ModuleReportPage({ reportKey }: { reportKey: ReportKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const definition = REPORT_DEFINITION_MAP[reportKey];
  const isAccountsReport = reportKey === "accounts";
  const userName = useSelector((state: RootState) => state.auth.user?.full_name ?? "System User");
  const activeFilters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(activeFilters);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadReportBundle>> | null>(null);
  const [accountOptions, setAccountOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setDraftFilters(activeFilters);
  }, [activeFilters]);

  const loadLocalBundle = useCallback(async () => {
    const next = await loadReportBundle(reportKey, activeFilters);
    setBundle(next);
  }, [activeFilters, reportKey]);

  const loadAccountOptions = useCallback(async () => {
    if (!isAccountsReport) {
      setAccountOptions([]);
      return;
    }

    const rows = await db.accounts.toArray();
    const options = [
      { value: "__all__", label: "All Accounts" },
      ...rows
        .slice()
        .sort((left, right) => {
          const currencyCompare = String(left.currency || "").localeCompare(String(right.currency || ""));
          if (currencyCompare !== 0) return currencyCompare;
          return String(left.name || "").localeCompare(String(right.name || ""));
        })
        .map((row) => {
          const currency = String(row.currency || "USD").toUpperCase();
          const status = String(row.status || "").trim().toLowerCase() === "active" ? "" : ` | ${String(row.status || "inactive")}`;
          return {
            value: row.uuid,
            label: `${row.name} | ${currency}${status}`,
          };
        }),
    ];

    setAccountOptions(options);
  }, [isAccountsReport]);

  const refresh = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      setRefreshing(true);
      setWarning(null);

      try {
        await Promise.all([loadLocalBundle(), loadAccountOptions()]);
        const refreshResult = await refreshReportBundleSources(reportKey);
        if (refreshResult.total > 0 && refreshResult.succeeded === 0) {
          setWarning("Server refresh is unavailable right now. Showing local cached data.");
        }
        await Promise.all([loadLocalBundle(), loadAccountOptions()]);
      } finally {
        if (showLoader) setLoading(false);
        setRefreshing(false);
      }
    },
    [loadAccountOptions, loadLocalBundle, reportKey]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void loadLocalBundle();
      void loadAccountOptions();
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [loadAccountOptions, loadLocalBundle]);

  const tableColumns = useMemo<Column<ReportTableRow>[]>(
    () =>
      (bundle?.table.columns ?? []).map((column) => ({
        key: column.key,
        label: column.label,
        render: (row) => renderReportCell(row, column),
      })),
    [bundle]
  );

  const sectionColumns = useMemo(
    () =>
      (bundle?.sections ?? []).reduce<Record<string, Column<ReportTableRow>[]>>((map, section) => {
        map[section.key] = section.columns.map((column) => ({
          key: column.key,
          label: column.label,
          render: (row) => renderReportCell(row, column),
        }));
        return map;
      }, {}),
    [bundle]
  );

  const topCharts = useMemo(
    () => (isAccountsReport ? (bundle?.charts ?? []).slice(0, 2) : []),
    [bundle, isAccountsReport]
  );

  const lowerCharts = useMemo(
    () => (isAccountsReport ? (bundle?.charts ?? []).slice(2) : bundle?.charts ?? []),
    [bundle, isAccountsReport]
  );

  const applyFilters = useCallback(() => {
    const query = buildSearchString(draftFilters);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [draftFilters, pathname, router]);

  const resetFilters = useCallback(() => {
    setDraftFilters({ fromDate: "", toDate: "", search: "", accountUuid: "", accountLabel: "" });
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const openPrint = useCallback(() => {
    const query = buildSearchString(activeFilters);
    setPrinting(true);
    const target = query ? `/print/reports/${reportKey}?${query}` : `/print/reports/${reportKey}`;
    window.open(target, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setPrinting(false), 600);
  }, [activeFilters, reportKey]);

  const permission = definition.permission;
  const role = definition.role;

  return (
    <RequirePermission permission={permission ?? []} role={role}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title={definition.label} subtitle={definition.description}>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void refresh(true);
              }}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              {refreshing ? "Syncing..." : "Sync Report"}
            </button>
            <button
              type="button"
              onClick={openPrint}
              disabled={printing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {printing ? "Opening..." : "Print Report"}
            </button>
          </div>
        </PageHeader>

        <div
          className="rounded-3xl border border-slate-200 p-6 text-white shadow-[0_20px_80px_rgba(15,23,42,0.16)] dark:border-[#2a2a3e]"
          style={{ background: `linear-gradient(135deg, ${definition.accentFrom}, ${definition.accentTo})` }}
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                MIS Reports
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">{definition.label}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/85">{definition.description}</p>
            </div>
            <div className="grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm backdrop-blur-sm sm:grid-cols-2">
              <div>
                <div className="text-white/70">Scope</div>
                <div className="mt-1 font-semibold">{bundle?.scopeLabel ?? "Loading..."}</div>
              </div>
              <div>
                <div className="text-white/70">Generated</div>
                <div className="mt-1 font-semibold">{bundle ? formatDateTimeLabel(bundle.generatedAt) : "Loading..."}</div>
              </div>
              <div>
                <div className="text-white/70">Mode</div>
                <div className="mt-1 font-semibold">Offline-first cached data</div>
              </div>
              <div>
                <div className="text-white/70">Prepared For</div>
                <div className="mt-1 font-semibold">{userName}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className={`grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 ${isAccountsReport ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
              <FormField
                label="From Date"
                type="date"
                value={draftFilters.fromDate}
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, fromDate: String(value) }))}
              />
              <FormField
                label="To Date"
                type="date"
                value={draftFilters.toDate}
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, toDate: String(value) }))}
              />
              <FormField
                label="Search"
                value={draftFilters.search}
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, search: String(value) }))}
                placeholder="Search this report"
              />
              {isAccountsReport ? (
                <FormField
                  label="Account"
                  type="select"
                  value={draftFilters.accountUuid || "__all__"}
                  onChange={(value) => {
                    const nextValue = String(value);
                    if (nextValue === "__all__") {
                      setDraftFilters((prev) => ({
                        ...prev,
                        accountUuid: "",
                        accountLabel: "",
                      }));
                      return;
                    }
                    const selected = accountOptions.find((option) => option.value === nextValue);
                    setDraftFilters((prev) => ({
                      ...prev,
                      accountUuid: nextValue,
                      accountLabel: selected?.label ?? "",
                    }));
                  }}
                  options={accountOptions}
                  placeholder="Select account"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraftFilters((prev) => ({ ...prev, ...currentMonthRange() }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDraftFilters((prev) => ({ ...prev, ...last30DaysRange() }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
          {warning ? <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{warning}</p> : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(bundle?.metrics ?? []).map((metric) => (
            <div key={metric.label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneClasses(metric.tone)}`} />
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{metric.value}</div>
              {metric.hint ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{metric.hint}</div> : null}
            </div>
          ))}
        </div>

        {topCharts.length ? (
          <div className="mt-8">
            <ReportCharts charts={topCharts} />
          </div>
        ) : null}

        {(bundle?.sections ?? []).length ? (
          <div className="mt-8 grid gap-6">
            {(bundle?.sections ?? []).map((section) => (
              <div key={section.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h2>
                  {section.subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{section.subtitle}</p> : null}
                </div>
                <DataTable
                  columns={sectionColumns[section.key] ?? []}
                  data={section.rows}
                  loading={loading}
                  pageSize={section.pageSize ?? 8}
                  searchKeys={section.searchKeys ?? []}
                  searchable={false}
                  compact
                  mobileStack
                  noHorizontalScroll
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          <ReportCharts charts={lowerCharts} />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{bundle?.table.title ?? "Report Table"}</h2>
            {bundle?.table.subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{bundle.table.subtitle}</p> : null}
          </div>

          <DataTable
            columns={tableColumns}
            data={bundle?.table.rows ?? []}
            loading={loading}
            pageSize={bundle?.table.pageSize ?? 12}
            searchKeys={bundle?.table.searchKeys ?? []}
            searchable={false}
            compact
            mobileStack
            noHorizontalScroll
          />
          {!loading && bundle && bundle.table.rows.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
              {bundle.emptyMessage}
            </div>
          ) : null}
        </div>
      </div>
    </RequirePermission>
  );
}
