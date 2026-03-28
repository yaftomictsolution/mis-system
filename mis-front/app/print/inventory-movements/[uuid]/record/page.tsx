"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StockMovementRecordPrintView from "@/components/inventory-movements/StockMovementRecordPrintView";
import {
  loadStockMovementPrintBundle,
  type StockMovementPrintBundle,
} from "@/components/inventory-movements/stock-movement-print-loader";

const EMPTY_STATE: StockMovementPrintBundle = {
  anchor: null,
  movements: [],
  request: null,
  warehouse: null,
  employee: null,
  project: null,
};

export default function StockMovementRecordPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");
  const [state, setState] = useState<StockMovementPrintBundle>(EMPTY_STATE);
  const [loading, setLoading] = useState(() => Boolean(uuid));

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!uuid) {
        setLoading(false);
        return;
      }

      const next = await loadStockMovementPrintBundle(uuid);
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
    if (loading || !state.anchor) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, state.anchor]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading movement record...
      </div>
    );
  }

  if (!state.anchor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Movement record not available offline</div>
          <p className="mt-2 text-sm text-slate-500">
            Open the movement history page online once so this record can be cached locally before printing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StockMovementRecordPrintView
      anchor={state.anchor}
      movements={state.movements}
      request={state.request}
      warehouse={state.warehouse}
      employee={state.employee}
      project={state.project}
    />
  );
}
