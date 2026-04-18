"use client";

import type { ApartmentRow, ApartmentRentalRow, CustomerRow, RentalPaymentRow } from "@/db/localDB";
import LetterheadPrintShell from "@/components/print/LetterheadPrintShell";

type Props = {
  rental: ApartmentRentalRow;
  payment: RentalPaymentRow;
  apartment: ApartmentRow | null;
  customer: CustomerRow | null;
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

function paymentTypeLabel(value?: string | null): string {
  const type = String(value ?? "").trim().toLowerCase();
  if (type === "advance") return "Advance";
  if (type === "late_fee") return "Late Fee";
  if (type === "adjustment") return "Adjustment";
  return "Monthly";
}

function statusLabel(value?: string | null): string {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "pending" || status === "pending_admin_approval") return "Pending Admin Approval";
  if (status === "approved_for_payment") return "Approved For Payment";
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

export default function RentalBillPrintView({
  rental,
  payment,
  apartment,
  customer,
}: Props) {
  const billLabel = String(payment.bill_no ?? "").trim() || `RBL-${payment.uuid.slice(0, 8).toUpperCase()}`;
  const rentalLabel = String(rental.rental_id ?? "").trim() || rental.uuid.slice(0, 8).toUpperCase();
  const customerName = customer?.name || rental.tenant_name || `Customer #${rental.tenant_id}`;
  const propertyLabel = apartment
    ? `${apartment.apartment_code} - Unit ${apartment.unit_number}`
    : rental.apartment_code || `Apartment #${rental.apartment_id}`;
  const issueDate = payment.bill_generated_at ?? payment.created_at ?? payment.updated_at;
  const balance = Math.max(
    0,
    Number(
      payment.remaining_amount ??
        Math.max(0, Number(payment.amount_due ?? 0) - Number(payment.amount_paid ?? 0))
    )
  );
  const note =
    payment.notes ||
    "This bill must be approved by admin before finance or admin can process payment and continue the rental workflow.";

  return (
    <LetterheadPrintShell title="Apartment Rental Bill" subtitle={`Bill ${billLabel}`}>
      <div className="mt-6 flex flex-col gap-6 print:mt-10 print:flex-row print:items-start print:justify-between">
        <div className="w-full print:w-[60%]">
          <p className="text-[16px] font-bold">
            Customer Name: <span className="font-normal">{customerName}</span>
          </p>
          <p className="mt-2 text-[16px] font-bold">
            Apartment / Unit: <span className="font-normal">{propertyLabel}</span>
          </p>
          <div className="mt-3 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[320px] border-collapse text-[13px] print:min-w-0">
              <tbody>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Rental No:</th>
                  <td className="border border-black px-2 py-2">{rentalLabel}</td>
                </tr>
                <tr>
                  <th className="border border-black px-2 py-2 text-left">Phone No:</th>
                  <td className="border border-black px-2 py-2">{customer?.phone || rental.tenant_phone || "-"}</td>
                </tr>
                <tr>
                  <th className="border border-black px-2 py-2 text-left">Email:</th>
                  <td className="border border-black px-2 py-2">{customer?.email || rental.tenant_email || "-"}</td>
                </tr>
                <tr>
                  <th className="border border-black px-2 py-2 text-left">Contract Period:</th>
                  <td className="border border-black px-2 py-2">
                    {dateLabel(rental.contract_start)} to {dateLabel(rental.contract_end)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-full text-[14px] print:w-[32%]">
          <div className="space-y-3 border border-black bg-white/70 px-3 py-3">
            <p>
              <span className="font-bold">Receipt Type:</span> Apartment Rental Bill
            </p>
            <p>
              <span className="font-bold">Payment Type:</span> {paymentTypeLabel(payment.payment_type)}
            </p>
            <p>
              <span className="font-bold">Bill Status:</span> {statusLabel(payment.status)}
            </p>
            <div className="mt-4 border-t border-black pt-3 text-[13px]">
              <p>
                <span className="font-bold">Date:</span> {dateLabel(issueDate)}
              </p>
              <p className="mt-2">
                <span className="font-bold">S.No:</span> {billLabel}
              </p>
              <p className="mt-2">
                <span className="font-bold">Due Date:</span> {dateLabel(payment.due_date)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[720px] border-collapse text-[13px] print:min-w-0">
          <thead>
            <tr>
              <th className="w-[6%] border border-black px-2 py-2 text-center">Item</th>
              <th className="w-[32%] border border-black px-2 py-2 text-left">Description</th>
              <th className="w-[14%] border border-black px-2 py-2 text-center">Due Date</th>
              <th className="w-[14%] border border-black px-2 py-2 text-center">Amount Due</th>
              <th className="w-[14%] border border-black px-2 py-2 text-center">Paid</th>
              <th className="w-[12%] border border-black px-2 py-2 text-center">Balance</th>
              <th className="w-[8%] border border-black px-2 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-2 text-center">1</td>
              <td className="border border-black px-2 py-2">
                {paymentTypeLabel(payment.payment_type)} bill for {propertyLabel}
                {payment.period_month ? ` (${payment.period_month})` : ""}
              </td>
              <td className="border border-black px-2 py-2 text-center">{dateLabel(payment.due_date)}</td>
              <td className="border border-black px-2 py-2 text-center">{money(payment.amount_due)}</td>
              <td className="border border-black px-2 py-2 text-center">{money(payment.amount_paid)}</td>
              <td className="border border-black px-2 py-2 text-center">{money(balance)}</td>
              <td className="border border-black px-2 py-2 text-center">{statusLabel(payment.status)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[720px] border-collapse text-[13px] print:min-w-0">
          <tbody>
            <tr>
              <td rowSpan={6} className="w-[63%] border border-black align-top px-3 py-3">
                <div className="font-bold">Note or Special Comments:</div>
                <div className="mt-2 leading-6">{note}</div>
              </td>
              <th className="w-[17%] border border-black px-2 py-2 text-center">Monthly Rent</th>
              <td className="w-[20%] border border-black px-2 py-2 text-center">{money(rental.monthly_rent)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Advance Required</th>
              <td className="border border-black px-2 py-2 text-center">{money(rental.advance_required_amount)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Advance Paid</th>
              <td className="border border-black px-2 py-2 text-center">{money(rental.advance_paid_amount)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Current Bill</th>
              <td className="border border-black px-2 py-2 text-center">{money(payment.amount_due)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Paid On Bill</th>
              <td className="border border-black px-2 py-2 text-center">{money(payment.amount_paid)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Outstanding</th>
              <td className="border border-black px-2 py-2 text-center">{money(balance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-12 flex flex-col gap-8 text-[12px] font-semibold sm:flex-row sm:justify-evenly print:flex-row print:justify-evenly">
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
    </LetterheadPrintShell>
  );
}
