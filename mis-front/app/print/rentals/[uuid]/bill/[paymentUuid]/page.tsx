"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RentalBillPrintView from "@/components/rentals/RentalBillPrintView";
import {
  loadRentalBillPrintBundle,
  type RentalBillPrintBundle,
} from "@/components/rentals/rental-bill-print-loader";

const EMPTY_STATE: RentalBillPrintBundle = {
  rental: null,
  payment: null,
  apartment: null,
  customer: null,
};

export default function RentalBillPrintPage() {
  const params = useParams<{ uuid: string; paymentUuid: string }>();
  const rentalUuid = String(params?.uuid ?? "");
  const paymentUuid = String(params?.paymentUuid ?? "");
  const [state, setState] = useState<RentalBillPrintBundle>(EMPTY_STATE);
  const [loading, setLoading] = useState(() => Boolean(rentalUuid && paymentUuid));

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!rentalUuid || !paymentUuid) {
        setLoading(false);
        return;
      }

      const next = await loadRentalBillPrintBundle(rentalUuid, paymentUuid);
      if (!active) return;
      setState(next);
      setLoading(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [paymentUuid, rentalUuid]);

  useEffect(() => {
    if (loading || !state.rental || !state.payment) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, state.payment, state.rental]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading rental bill...
      </div>
    );
  }

  if (!state.rental || !state.payment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Rental bill not available offline</div>
          <p className="mt-2 text-sm text-slate-500">
            Open the rentals page online once so the bill can be cached locally before printing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RentalBillPrintView
      rental={state.rental}
      payment={state.payment}
      apartment={state.apartment}
      customer={state.customer}
    />
  );
}
