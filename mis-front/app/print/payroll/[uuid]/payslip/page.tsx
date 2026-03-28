"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PayrollPayslipPrintView from "@/components/payroll/PayrollPayslipPrintView";
import {
  loadPayrollPayslipBundle,
  type PayrollPayslipBundle,
} from "@/components/payroll/payroll-payslip-loader";

const EMPTY_STATE: PayrollPayslipBundle = {
  payment: null,
  employee: null,
};

export default function PayrollPayslipPrintPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = String(params?.uuid ?? "");
  const [state, setState] = useState<PayrollPayslipBundle>(EMPTY_STATE);
  const [loading, setLoading] = useState(() => Boolean(uuid));

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!uuid) {
        setLoading(false);
        return;
      }

      const next = await loadPayrollPayslipBundle(uuid);
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
    if (loading || !state.payment) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, state.payment]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading payslip...
      </div>
    );
  }

  if (!state.payment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Payslip not available offline</div>
          <p className="mt-2 text-sm text-slate-500">
            Open the payroll page online once so this salary payment can be cached locally before printing.
          </p>
        </div>
      </div>
    );
  }

  return <PayrollPayslipPrintView payment={state.payment} employee={state.employee} />;
}
