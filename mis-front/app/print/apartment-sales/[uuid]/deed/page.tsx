"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ApartmentSaleDeedPrintView from "@/components/apartment-sales/ApartmentSaleDeedPrintView";
import {
  loadApartmentSaleDeedPrintBundle,
} from "@/components/apartment-sales/apartment-sale-print-loader";

type ApartmentSaleDeedBundle = Awaited<ReturnType<typeof loadApartmentSaleDeedPrintBundle>>;

const EMPTY_BUNDLE: ApartmentSaleDeedBundle = {
  sale: null,
  customer: null,
  apartment: null,
  financial: null,
  customerDocuments: [],
};

export default function ApartmentSaleDeedPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");
  const [state, setState] = useState<ApartmentSaleDeedBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(() => Boolean(uuid));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const next = await loadApartmentSaleDeedPrintBundle(uuid);
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
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state.sale]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading deed...
      </div>
    );
  }

  if (!state.sale) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-red-600">
        Deed data is not available in local storage.
      </div>
    );
  }

  return (
    <ApartmentSaleDeedPrintView
      sale={state.sale}
      customer={state.customer}
      apartment={state.apartment}
      financial={state.financial}
      customerDocuments={state.customerDocuments}
    />
  );
}
