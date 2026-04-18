"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import ModuleReportPrintView from "@/components/reports/ModuleReportPrintView";
import { loadReportBundle } from "@/modules/reports/reports.repo";
import type { ReportBundle, ReportFilters, ReportKey } from "@/modules/reports/reports.types";
import { isReportKey } from "@/modules/reports/reports.types";

function readFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    fromDate: searchParams.get("from") ?? "",
    toDate: searchParams.get("to") ?? "",
    search: searchParams.get("q") ?? "",
    accountUuid: searchParams.get("account") ?? "",
    accountLabel: searchParams.get("accountLabel") ?? "",
  };
}

export default function PrintReportPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const rawSlug = String(params?.slug ?? "");
  const reportKey: ReportKey = isReportKey(rawSlug) ? rawSlug : "sales";
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      const next = await loadReportBundle(reportKey, filters);
      if (!active) return;
      setBundle(next);
      setLoading(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [filters, reportKey]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading report print view...
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Report not available offline</div>
          <p className="mt-2 text-sm text-slate-500">
            Open this report page online once so the local report cache can refresh before printing.
          </p>
        </div>
      </div>
    );
  }

  return <ModuleReportPrintView bundle={bundle} />;
}
