"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PurchasePaymentSlipPrintView from "@/components/purchase-requests/PurchasePaymentSlipPrintView";
import {
  loadPurchasePaymentSlipBundle,
  type PurchasePaymentSlipBundle,
} from "@/components/purchase-requests/purchase-payment-slip-loader";

const EMPTY_STATE: PurchasePaymentSlipBundle = {
  request: null,
  account: null,
  vendor: null,
  warehouse: null,
  project: null,
};

export default function PurchasePaymentSlipPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");
  const [state, setState] = useState<PurchasePaymentSlipBundle>(EMPTY_STATE);
  const [loading, setLoading] = useState(() => Boolean(uuid));

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!uuid) {
        setLoading(false);
        return;
      }

      const next = await loadPurchasePaymentSlipBundle(uuid);
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
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, state.request]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading purchase payment slip...
      </div>
    );
  }

  if (!state.request) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Purchase payment slip not available offline</div>
          <p className="mt-2 text-sm text-slate-500">
            Open the purchase requests page online once so this payment slip can be cached locally before printing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PurchasePaymentSlipPrintView
      request={state.request}
      account={state.account}
      vendor={state.vendor}
      warehouse={state.warehouse}
      project={state.project}
    />
  );
}
