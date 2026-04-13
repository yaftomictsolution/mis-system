"use client";

import type { ApartmentRow, ApartmentSaleRow, CustomerRow, InstallmentRow } from "@/db/localDB";
import { toCurrency, toDateLabel } from "@/components/apartment-sales/apartment-sale.page-helpers";
import SecureQrCode from "@/components/qr/SecureQrCode";

type Props = {
  sale: ApartmentSaleRow;
  customer?: CustomerRow | null;
  apartment?: ApartmentRow | null;
  installments?: InstallmentRow[];
};

type PaymentRowView = {
  key: string;
  label: string;
  dueDate: number | null;
  paidDate: number | null;
  amount: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "pending" | "overdue";
};

const LETTERHEAD_SRC = "/Letterhead01.jpg";

function buildPaymentRows(
  sale: ApartmentSaleRow,
  installments: InstallmentRow[],
  netPrice: number,
  fallbackPaidTotal: number,
  fallbackRemaining: number
): PaymentRowView[] {
  if (installments.length > 0) {
    return installments.map((row) => {
      const amount = Number(row.amount ?? 0);
      const paid = Number(row.paid_amount ?? 0);
      const remaining = Math.max(0, Number((amount - paid).toFixed(2)));
      const rowStatus = String(row.status ?? "").trim().toLowerCase();
      const status: PaymentRowView["status"] =
        paid >= amount
          ? "paid"
          : paid > 0
            ? "partial"
            : rowStatus === "overdue"
              ? "overdue"
              : "pending";

      return {
        key: row.uuid,
        label: sale.payment_type === "installment" ? `Installment ${row.installment_no}` : "Full Payment",
        dueDate: Number.isFinite(Number(row.due_date)) ? Number(row.due_date) : null,
        paidDate: Number.isFinite(Number(row.paid_date)) ? Number(row.paid_date) : null,
        amount,
        paid,
        remaining,
        status,
      };
    });
  }

  const fallbackStatus: PaymentRowView["status"] =
    fallbackPaidTotal >= netPrice ? "paid" : fallbackPaidTotal > 0 ? "partial" : "pending";

  return [
    {
      key: `${sale.uuid}-receipt`,
      label: sale.payment_type === "installment" ? "Sale Payment" : "Full Payment",
      dueDate: Number.isFinite(Number(sale.first_due_date ?? sale.sale_date)) ? Number(sale.first_due_date ?? sale.sale_date) : null,
      paidDate: fallbackPaidTotal > 0 && Number.isFinite(Number(sale.sale_date)) ? Number(sale.sale_date) : null,
      amount: netPrice,
      paid: fallbackPaidTotal,
      remaining: fallbackRemaining,
      status: fallbackStatus,
    },
  ];
}

function statusLabel(status: PaymentRowView["status"]): string {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "overdue") return "Overdue";
  return "Pending";
}

export default function ApartmentSaleSummaryPrintView({
  sale,
  customer,
  apartment,
  installments = [],
}: Props) {
  const saleLabel = String(sale.sale_id ?? "").trim() || sale.uuid.slice(0, 8).toUpperCase();
  const normalizedInstallments = [...installments].sort((a, b) => {
    if (a.installment_no !== b.installment_no) return a.installment_no - b.installment_no;
    return Number(a.due_date ?? 0) - Number(b.due_date ?? 0);
  });
  const netPrice = Number(sale.net_price ?? Number(sale.total_price) - Number(sale.discount));
  const fallbackPaidTotal =
    normalizedInstallments.length > 0
      ? Number(normalizedInstallments.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0).toFixed(2))
      : sale.payment_type !== "installment" && String(sale.status ?? "").trim().toLowerCase() === "completed"
        ? netPrice
        : Number(sale.installments_paid_total ?? 0);
  const fallbackRemaining =
    String(sale.status ?? "").trim().toLowerCase() === "terminated" ||
    String(sale.status ?? "").trim().toLowerCase() === "defaulted"
      ? Math.max(0, Number(sale.remaining_debt_after_termination ?? 0))
      : Math.max(0, Number((netPrice - fallbackPaidTotal).toFixed(2)));

  const paymentRows = buildPaymentRows(sale, normalizedInstallments, netPrice, fallbackPaidTotal, fallbackRemaining);
  const paidTotal = Number(paymentRows.reduce((sum, row) => sum + row.paid, 0).toFixed(2));
  const remaining =
    String(sale.status ?? "").trim().toLowerCase() === "terminated" ||
    String(sale.status ?? "").trim().toLowerCase() === "defaulted"
      ? Math.max(0, Number(sale.remaining_debt_after_termination ?? 0))
      : Math.max(0, Number((netPrice - paidTotal).toFixed(2)));
  const latestPaymentDate = paymentRows.reduce((latest, row) => Math.max(latest, Number(row.paidDate ?? 0)), 0);
  const issueDate = latestPaymentDate || sale.sale_date || 0;
  const propertyLabel = apartment ? `${apartment.apartment_code} - Unit ${apartment.unit_number}` : `Apartment #${sale.apartment_id}`;
  const customerName = customer?.name || `Customer #${sale.customer_id}`;
  const paymentType = sale.payment_type === "installment" ? "Installment" : "Full";
  const qrAccessToken = String(apartment?.qr_access_token ?? "").trim() || null;
  const summaryNote =
    remaining <= 0
      ? "Customer payment is fully settled."
      : paidTotal > 0
        ? "Customer payment is partially settled."
        : "No customer payment is recorded yet.";

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: "Times New Roman", Calibri, serif;
        }
      `}</style>

      <div className="min-h-screen bg-[#ece7df] p-6 print:bg-white print:p-0">
        <div className="mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-3 print:hidden">
          <div>
            <div className="text-lg font-bold text-slate-900">Apartment Sale Payment Receipt</div>
            <div className="text-sm text-slate-500">{`Receipt ${saleLabel}`}</div>
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

        <div
          className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white bg-cover bg-no-repeat text-black shadow-[0_15px_60px_rgba(15,23,42,0.16)] print:max-w-none print:shadow-none"
          style={{ backgroundImage: `url('${LETTERHEAD_SRC}')`, backgroundPosition: "center top" }}
        >
          <div className="min-h-[297mm] px-[14mm] pb-[22mm] pt-[38mm]">
            <div className="mt-10 flex items-start justify-between gap-6">
              <div className="w-[60%]">
                <p className="text-[16px] font-bold">Customer Name: <span className="font-normal">{customerName}</span></p>
                <p className="mt-2 text-[16px] font-bold">Apartment / Unit: <span className="font-normal">{propertyLabel}</span></p>
                <div className="mt-3">
                  <table className="w-full border-collapse text-[13px]">
                    <tbody>
                      <tr>
                        <th className="w-[28%] border border-black px-2 py-2 text-left">Phone No:</th>
                        <td className="border border-black px-2 py-2">{customer?.phone || "-"}</td>
                      </tr>
                      <tr>
                        <th className="w-[28%] border border-black px-2 py-2 text-left">Alt Phone:</th>
                        <td className="border border-black px-2 py-2">{customer?.phone1 || "-"}</td>
                      </tr>
                      <tr>
                        <th className="w-[28%] border border-black px-2 py-2 text-left">Address:</th>
                        <td className="border border-black px-2 py-2">{customer?.address || "-"}</td>
                      </tr>
                      <tr>
                        <th className="w-[28%] border border-black px-2 py-2 text-left">Sale Status:</th>
                        <td className="border border-black px-2 py-2">{String(sale.status ?? "-")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="w-[32%] text-[14px]">
                <div className="space-y-3 border border-black bg-white/70 px-3 py-3">
                  <p><span className="font-bold">Receipt Type:</span> Apartment Sale Payment</p>
                  <p><span className="font-bold">Payment Type:</span> {paymentType}</p>
                  <p><span className="font-bold">Deed Status:</span> {String(sale.deed_status ?? "not_issued")}</p>
                  <div className="mt-4 border-t border-black pt-3 text-[13px]">
                    <p><span className="font-bold">Date:</span> {toDateLabel(issueDate)}</p>
                    <p className="mt-2"><span className="font-bold">S.No:</span> {saleLabel}</p>
                  </div>
                  {qrAccessToken ? (
                    <div className="mt-4 flex justify-center border-t border-black pt-3">
                      <SecureQrCode
                        token={qrAccessToken}
                        size={104}
                        label="Scan for secure apartment details"
                        captionClassName="max-w-[28mm] text-[10px] leading-4 text-slate-700"
                        frameClassName="border-black shadow-none"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="w-[6%] border border-black px-2 py-2 text-center">Item</th>
                    <th className="w-[32%] border border-black px-2 py-2 text-left">Description</th>
                    <th className="w-[12%] border border-black px-2 py-2 text-center">Due Date</th>
                    <th className="w-[14%] border border-black px-2 py-2 text-center">Amount</th>
                    <th className="w-[14%] border border-black px-2 py-2 text-center">Paid</th>
                    <th className="w-[14%] border border-black px-2 py-2 text-center">Balance</th>
                    <th className="w-[8%] border border-black px-2 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((row, index) => (
                    <tr key={row.key}>
                      <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
                      <td className="border border-black px-2 py-2">{`${row.label} for ${propertyLabel}`}</td>
                      <td className="border border-black px-2 py-2 text-center">{row.dueDate ? toDateLabel(row.dueDate) : "-"}</td>
                      <td className="border border-black px-2 py-2 text-center">{toCurrency(row.amount)}</td>
                      <td className="border border-black px-2 py-2 text-center">{toCurrency(row.paid)}</td>
                      <td className="border border-black px-2 py-2 text-center">{toCurrency(row.remaining)}</td>
                      <td className="border border-black px-2 py-2 text-center">{statusLabel(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  <tr>
                    <td rowSpan={6} className="w-[63%] border border-black align-top px-3 py-3">
                      <div className="font-bold">Note or Special Comments:</div>
                      <div className="mt-2 leading-6">
                        {summaryNote} This printout is generated from the recorded apartment sale payment data for sale <span className="font-semibold">{saleLabel}</span>.
                      </div>
                    </td>
                    <th className="w-[17%] border border-black px-2 py-2 text-center">Total Price</th>
                    <td className="w-[20%] border border-black px-2 py-2 text-center">{toCurrency(Number(sale.total_price ?? 0))}</td>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-2 text-center">Discount</th>
                    <td className="border border-black px-2 py-2 text-center">{toCurrency(Number(sale.discount ?? 0))}</td>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-2 text-center">Net Price</th>
                    <td className="border border-black px-2 py-2 text-center">{toCurrency(netPrice)}</td>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-2 text-center">Received</th>
                    <td className="border border-black px-2 py-2 text-center">{toCurrency(paidTotal)}</td>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-2 text-center">Balance</th>
                    <td className="border border-black px-2 py-2 text-center">{toCurrency(remaining)}</td>
                  </tr>
                  <tr>
                    <th className="border border-black px-2 py-2 text-center">Payment Type</th>
                    <td className="border border-black px-2 py-2 text-center">{paymentType}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-12 flex justify-evenly text-[12px] font-semibold">
              <div className="min-w-[45mm] text-center">
                <div className="border-b border-black pb-6" />
                <p className="mt-3">Prepared By</p>
              </div>
              <div className="min-w-[45mm] text-center">
                <div className="border-b border-black pb-6" />
                <p className="mt-3">Customer Signature</p>
              </div>
              <div className="min-w-[45mm] text-center">
                <div className="border-b border-black pb-6" />
                <p className="mt-3">Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

