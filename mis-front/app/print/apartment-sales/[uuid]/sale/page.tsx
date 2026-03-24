"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ApartmentSaleSummaryPrintView from "@/components/apartment-sales/ApartmentSaleSummaryPrintView";
import {
  loadApartmentSalePrintBundle,
  type ApartmentSalePrintBundle,
} from "@/components/apartment-sales/apartment-sale-print-loader";

export default function ApartmentSaleSummaryPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");

  const [state, setState] = useState<ApartmentSalePrintBundle>({
    sale: null,
    customer: null,
    apartment: null,
  });
  const [loading, setLoading] = useState(() => Boolean(uuid));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const next = await loadApartmentSalePrintBundle(uuid);
      if (!cancelled) {
        setState(next);
        setLoading(false);
      }
    };

    if (uuid) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [uuid]);

  useEffect(() => {
    if (!state.sale) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state.sale]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading sale summary...
      </div>
    );
  }

  if (!state.sale) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-red-600">
        Sale record not found in local storage.
      </div>
    );
  }

  return <ApartmentSaleSummaryPrintView sale={state.sale} customer={state.customer} apartment={state.apartment} />;
}
