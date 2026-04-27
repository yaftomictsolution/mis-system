"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSelector } from "react-redux";

import { REPORT_DEFINITIONS } from "@/config/report-nav";
import { hasAccess, shouldHideForRole } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import type { RootState } from "@/store/store";

export default function ReportsOverviewPage() {
  const permissions = useSelector((state: RootState) => state.auth.user?.permissions ?? []);
  const roles = useSelector((state: RootState) => state.auth.user?.roles ?? []);

  const reports = useMemo(
    () =>
      REPORT_DEFINITIONS.filter((definition) => {
        if (shouldHideForRole(roles, definition.hideForRole)) return false;
        return hasAccess(permissions, roles, definition.permission, definition.role);
      }),
    [permissions, roles]
  );

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="MIS Reports"
        subtitle="Offline-first report hub with per-module pages, date filtering, graphs, and branded print views."
      />

      <div className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_38%),linear-gradient(135deg,_#0f172a,_#111827_58%,_#1e293b)] p-6 text-white shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
            Offline First
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Every module now has its own reporting route.</h2>
          <p className="mt-3 text-sm leading-7 text-white/80">
            Open any report to filter by `from` and `to` date, review dashboard-style charts, inspect the filtered data table,
            and print the report with the same branded letterhead structure used in your receipt pages.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((definition) => (
          <Link
            key={definition.key}
            href={definition.path}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-[#2a2a3e] dark:bg-[#12121a]"
          >
            <div
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${definition.accentFrom}, ${definition.accentTo})` }}
            >
              <definition.icon size={20} />
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{definition.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{definition.description}</p>
            </div>
            <div className="mt-4 text-sm font-semibold text-blue-600 transition-colors group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
              Open report
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
