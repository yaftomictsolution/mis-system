"use client";

import type { EmployeeRow, SalaryPaymentRow } from "@/db/localDB";

type Props = {
  payment: SalaryPaymentRow;
  employee?: EmployeeRow | null;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}

export default function PayrollPayslipPrintView({ payment, employee }: Props) {
  const slipLabel = `PS-${payment.uuid.slice(0, 8).toUpperCase()}`;
  const employeeName = payment.employee_name || [employee?.first_name, employee?.last_name].filter(Boolean).join(" ").trim() || "Employee";
  const phoneLabel =
    employee?.phone !== null && employee?.phone !== undefined && String(employee.phone).trim()
      ? String(employee.phone)
      : "-";
  const preparedBy = payment.user_name || "System";

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 14mm;
        }

        html,
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 py-6 text-slate-950 print:bg-white print:py-0">
        <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3 px-4 print:hidden">
          <div>
            <div className="text-lg font-bold text-slate-900">Payslip</div>
            <div className="text-sm text-slate-500">{employeeName}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 px-8 py-8 print:px-0 print:pt-0">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Salary Payslip</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Printable payroll summary generated from the locally cached salary payment data.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-5 py-4 text-right text-white">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-300">Slip ID</div>
                <div className="mt-1 text-lg font-bold">{slipLabel}</div>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-8 py-8 print:px-0">
            <section>
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Employee</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Full Name" value={employeeName} />
                <Field label="Job Title" value={employee?.job_title || "-"} />
                <Field label="Email" value={employee?.email || "-"} />
                <Field label="Phone" value={phoneLabel} />
              </div>
            </section>

            <section>
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Payment Details</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Period" value={payment.period || "-"} />
                <Field label="Status" value={payment.status || "-"} />
                <Field label="Paid At" value={dateLabel(payment.paid_at)} />
                <Field label="Prepared By" value={preparedBy} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Salary Breakdown</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gross Salary</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{money(payment.gross_salary)}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Advance Deducted</div>
                  <div className="mt-2 text-2xl font-bold text-amber-800">{money(payment.advance_deducted)}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Net Salary</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-800">{money(payment.net_salary)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Notes</div>
              <p className="text-sm leading-6 text-slate-600">
                This payslip reflects the salary payment record stored in the payroll module. If a salary advance was
                approved and deducted, it is already included in the net salary amount shown above.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
