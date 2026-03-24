"use client";

import type { ApartmentRow, ApartmentSaleRow, CustomerRow } from "@/db/localDB";
import {
  customerRemainingAmount,
  toCurrency,
  toDateLabel,
} from "@/components/apartment-sales/apartment-sale.page-helpers";

type Props = {
  sale: ApartmentSaleRow;
  customer?: CustomerRow | null;
  apartment?: ApartmentRow | null;
};

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}

export default function ApartmentSaleSummaryPrintView({ sale, customer, apartment }: Props) {
  const saleLabel = String(sale.sale_id ?? "").trim() || sale.uuid.slice(0, 8).toUpperCase();
  const netPrice = Number(sale.net_price ?? Number(sale.total_price) - Number(sale.discount));
  const paidTotal = Number(sale.installments_paid_total ?? 0);
  const remaining = customerRemainingAmount(sale, new Map([[sale.uuid, paidTotal]]));
  const customDates = sale.custom_dates ?? [];

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
            <div className="text-lg font-bold text-slate-900">Apartment Sale Summary</div>
            <div className="text-sm text-slate-500">{`Sale ${saleLabel}`}</div>
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
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Apartment Sale Summary</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Printable snapshot of the apartment sale, customer details, and payment progress.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-5 py-4 text-right text-white">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-300">Sale ID</div>
                <div className="mt-1 text-lg font-bold">{saleLabel}</div>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-8 py-8 print:px-0">
            <section>
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Overview</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Sale Date" value={toDateLabel(sale.sale_date)} />
                <Field label="Status" value={String(sale.status ?? "-")} />
                <Field label="Payment Type" value={String(sale.payment_type ?? "full")} />
                <Field label="Deed Status" value={String(sale.deed_status ?? "not_issued")} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Customer</div>
                <div className="space-y-3 text-sm text-slate-700">
                  <div><span className="font-semibold text-slate-900">Name:</span> {customer?.name || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Father Name:</span> {customer?.fname || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Grandfather Name:</span> {customer?.gname || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Phone:</span> {customer?.phone || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Alternate Phone:</span> {customer?.phone1 || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Address:</span> {customer?.address || "-"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Apartment</div>
                <div className="space-y-3 text-sm text-slate-700">
                  <div><span className="font-semibold text-slate-900">Apartment Code:</span> {apartment?.apartment_code || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Block:</span> {apartment?.block_number || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Unit:</span> {apartment?.unit_number || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Floor:</span> {apartment?.floor_number || "-"}</div>
                  <div><span className="font-semibold text-slate-900">Bedrooms:</span> {String(apartment?.bedrooms ?? "-")}</div>
                  <div><span className="font-semibold text-slate-900">Area:</span> {apartment?.area_sqm ? `${apartment.area_sqm} sqm` : "-"}</div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Financial Summary</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Total Price" value={toCurrency(Number(sale.total_price ?? 0))} />
                <Field label="Discount" value={toCurrency(Number(sale.discount ?? 0))} />
                <Field label="Net Price" value={toCurrency(netPrice)} />
                <Field label="Remaining" value={toCurrency(remaining)} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Installment Plan</div>
              {sale.payment_type === "installment" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Frequency" value={String(sale.frequency_type ?? "monthly")} />
                    <Field label="Installment Count" value={String(sale.installment_count ?? sale.installments_count ?? "-")} />
                    <Field label="First Due Date" value={toDateLabel(sale.first_due_date)} />
                    <Field label="Paid Total" value={toCurrency(paidTotal)} />
                  </div>

                  {customDates.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Installment</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Due Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {customDates.map((item) => (
                            <tr key={`${item.installment_no}-${item.due_date}`}>
                              <td className="px-4 py-3">{item.installment_no}</td>
                              <td className="px-4 py-3">{toDateLabel(item.due_date)}</td>
                              <td className="px-4 py-3">{toCurrency(Number(item.amount ?? 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-600">This sale uses full payment. No installment schedule is attached.</div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
