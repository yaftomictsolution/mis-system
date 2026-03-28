"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MaterialIssueReceiptPrintView from "@/components/inventory-workflow/MaterialIssueReceiptPrintView";
import {
  loadMaterialIssuePrintBundle,
  type MaterialIssuePrintBundle,
} from "@/components/inventory-workflow/material-issue-print-loader";

const EMPTY_STATE: MaterialIssuePrintBundle = {
  request: null,
  warehouse: null,
  employee: null,
  project: null,
  movements: [],
};

export default function MaterialIssueReceiptPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");
  const [state, setState] = useState<MaterialIssuePrintBundle>(EMPTY_STATE);
  const [loading, setLoading] = useState(() => Boolean(uuid));

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!uuid) {
        setLoading(false);
        return;
      }

      const next = await loadMaterialIssuePrintBundle(uuid);
      if (!active) return;
      setState(next);
      setLoading(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [uuid]);

  useEffect(() => {
    if (loading || !state.request) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, state.request]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading material receipt...
      </div>
    );
  }

  if (!state.request) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Material receipt not available offline</div>
          <p className="mt-2 text-sm text-slate-500">
            Open the material requests page online once so this request can be cached locally before printing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MaterialIssueReceiptPrintView
      request={state.request}
      warehouse={state.warehouse}
      employee={state.employee}
      project={state.project}
      movements={state.movements}
    />
  );
}
