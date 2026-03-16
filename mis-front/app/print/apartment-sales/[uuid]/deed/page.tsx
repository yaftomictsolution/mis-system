"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ApartmentSaleDeedPrintView from "@/components/apartment-sales/ApartmentSaleDeedPrintView";
import { db, type ApartmentRow, type ApartmentSaleRow, type CustomerRow } from "@/db/localDB";

type LoadState = {
  sale: ApartmentSaleRow | null;
  customer: CustomerRow | null;
  apartment: ApartmentRow | null;
};

async function loadSaleBundle(uuid: string): Promise<LoadState> {
  const sale = await db.apartment_sales.get(uuid);
  if (!sale) {
    return { sale: null, customer: null, apartment: null };
  }

  const [customer, apartment] = await Promise.all([
    db.customers.filter((item) => Number(item.id) === Number(sale.customer_id)).first(),
    db.apartments.filter((item) => Number(item.id) === Number(sale.apartment_id)).first(),
  ]);

  return {
    sale,
    customer: customer ?? null,
    apartment: apartment ?? null,
  };
}

export default function ApartmentSaleDeedPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");

  const [state, setState] = useState<LoadState>({
    sale: null,
    customer: null,
    apartment: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const next = await loadSaleBundle(uuid);
      if (!cancelled) {
        setState(next);
        setLoading(false);
      }
    };

    if (uuid) {
      void load();
    } else {
      setLoading(false);
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
    return <div className="flex min-h-screen items-center justify-center bg-stone-100 text-sm text-slate-600">Loading deed...</div>;
  }

  if (!state.sale) {
    return <div className="flex min-h-screen items-center justify-center bg-stone-100 text-sm text-red-600">Sale record not found in local storage.</div>;
  }

  return <ApartmentSaleDeedPrintView sale={state.sale} customer={state.customer} apartment={state.apartment} />;
}
