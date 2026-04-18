"use client";

import type { AccountRow, ProjectRow, PurchaseRequestItemRow, PurchaseRequestRow, VendorRow, WarehouseRow } from "@/db/localDB";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import LetterheadPrintShell from "@/components/print/LetterheadPrintShell";

type Props = {
  request: PurchaseRequestRow;
  account?: AccountRow | null;
  vendor?: VendorRow | null;
  warehouse?: WarehouseRow | null;
  project?: ProjectRow | null;
};

function dateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function money(value: number, currency: string = "USD"): string {
  return formatMoney(Number(value || 0), normalizeCurrency(currency));
}

function paymentItemName(item: PurchaseRequestItemRow): string {
  if (item.item_kind === "asset") {
    const assetBase = item.asset_name || item.company_asset_code || "Asset";
    return item.asset_type ? `${assetBase} (${item.asset_type})` : assetBase;
  }

  return item.material_name || "Material";
}

function paymentQuantity(item: PurchaseRequestItemRow): number {
  const approved = Number(item.quantity_approved ?? 0);
  if (approved > 0) return approved;
  return Number(item.quantity_requested ?? 0);
}

function paymentUnitPrice(item: PurchaseRequestItemRow): number {
  const estimated = Number(item.estimated_unit_price ?? 0);
  if (estimated > 0) return estimated;
  return Number(item.actual_unit_price ?? 0);
}

function paymentLineTotal(item: PurchaseRequestItemRow): number {
  const quantity = paymentQuantity(item);
  const unitPrice = paymentUnitPrice(item);
  if (quantity <= 0 || unitPrice <= 0) return 0;
  return Number((quantity * unitPrice).toFixed(2));
}

export default function PurchasePaymentSlipPrintView({
  request,
  account,
  vendor,
  warehouse,
  project,
}: Props) {
  const slipLabel = String(request.payment_slip_no ?? "").trim() || String(request.request_no ?? "").trim() || request.uuid.slice(0, 8).toUpperCase();
  const issueDate = request.payment_processed_at ?? request.requested_at ?? request.updated_at;
  const vendorName = vendor?.name || request.vendor_name || "Direct Purchase";
  const warehouseName = warehouse?.name || request.warehouse_name || "-";
  const projectName = project?.name || request.project_name || "-";
  const requestedBy = request.requested_by_name || request.requested_by_user_name || request.requested_by_employee_name || "-";
  const processedBy = request.payment_processed_by_user_name || "-";
  const paymentCurrency = normalizeCurrency(request.payment_currency_code || "USD");
  const accountCurrency = normalizeCurrency(account?.currency || request.payment_account_currency || request.payment_currency_code || "USD");
  const approvedTotal = Number(request.approved_grand_total ?? request.estimated_grand_total ?? 0);
  const estimatedTotal = Number(request.estimated_grand_total ?? approvedTotal);
  const paidAmount = Number(request.payment_amount ?? approvedTotal);
  const accountAmount = Number(request.payment_account_amount ?? request.payment_amount ?? approvedTotal);
  const balance = Math.max(0, Number((approvedTotal - paidAmount).toFixed(2)));
  const rateLabel =
    request.payment_exchange_rate_snapshot && Number(request.payment_exchange_rate_snapshot) > 0
      ? `1 USD = ${Number(request.payment_exchange_rate_snapshot).toFixed(4)} AFN`
      : "-";
  const itemRows = (request.items ?? []).map((item, index) => ({
    key: item.uuid || `${request.uuid}-${index}`,
    index: index + 1,
    name: paymentItemName(item),
    quantity: paymentQuantity(item),
    unit: item.unit || "-",
    unitPrice: paymentUnitPrice(item),
    total: paymentLineTotal(item),
  }));
  const note =
    request.payment_notes ||
    request.notes ||
    `Purchase payment for ${request.request_no} was posted from ${account?.name || request.payment_account_name || "the selected company account"} and is ready for receiving workflow.`;

  return (
    <LetterheadPrintShell title="Purchase Payment Slip" subtitle={`Slip ${slipLabel}`}>
      <div className="mt-10 flex items-start justify-between gap-6">
        <div className="w-[60%]">
          <p className="text-[16px] font-bold">Supplier Name: <span className="font-normal">{vendorName}</span></p>
          <p className="mt-2 text-[16px] font-bold">Warehouse / Project: <span className="font-normal">{warehouseName}{projectName !== "-" ? ` / ${projectName}` : ""}</span></p>
          <div className="mt-3">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Phone No:</th>
                  <td className="border border-black px-2 py-2">{vendor?.phone || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Email:</th>
                  <td className="border border-black px-2 py-2">{vendor?.email || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Address:</th>
                  <td className="border border-black px-2 py-2">{vendor?.address || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Requested By:</th>
                  <td className="border border-black px-2 py-2">{requestedBy}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Payment Account:</th>
                  <td className="border border-black px-2 py-2">
                    {account?.name || request.payment_account_name || "-"}
                    {(account?.currency || request.payment_account_currency) ? ` (${account?.currency || request.payment_account_currency})` : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[32%] text-[14px]">
          <div className="space-y-3 border border-black bg-white/70 px-3 py-3">
            <p><span className="font-bold">Receipt Type:</span> Purchase Request Payment</p>
            <p><span className="font-bold">Request Type:</span> {request.request_type}</p>
            <p><span className="font-bold">Payment Status:</span> {request.status || "-"}</p>
            <div className="mt-4 border-t border-black pt-3 text-[13px]">
              <p><span className="font-bold">Date:</span> {dateLabel(issueDate)}</p>
              <p className="mt-2"><span className="font-bold">S.No:</span> {slipLabel}</p>
              <p className="mt-2"><span className="font-bold">Processed By:</span> {processedBy}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-[6%] border border-black px-2 py-2 text-center">Item</th>
              <th className="w-[38%] border border-black px-2 py-2 text-left">Description</th>
              <th className="w-[12%] border border-black px-2 py-2 text-center">Qty</th>
              <th className="w-[12%] border border-black px-2 py-2 text-center">Unit</th>
              <th className="w-[16%] border border-black px-2 py-2 text-center">Unit Price</th>
              <th className="w-[16%] border border-black px-2 py-2 text-center">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.length ? (
              itemRows.map((item) => (
                <tr key={item.key}>
                  <td className="border border-black px-2 py-2 text-center">{item.index}</td>
                  <td className="border border-black px-2 py-2">{item.name}</td>
                  <td className="border border-black px-2 py-2 text-center">{item.quantity}</td>
                  <td className="border border-black px-2 py-2 text-center">{item.unit}</td>
                  <td className="border border-black px-2 py-2 text-center">{item.unitPrice > 0 ? money(item.unitPrice, paymentCurrency) : "-"}</td>
                  <td className="border border-black px-2 py-2 text-center">{item.total > 0 ? money(item.total, paymentCurrency) : "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="border border-black px-3 py-6 text-center">
                  No purchase items were available in local storage for this payment slip.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr>
              <td rowSpan={6} className="w-[63%] border border-black align-top px-3 py-3">
                <div className="font-bold">Note or Special Comments:</div>
                <div className="mt-2 leading-6">{note}</div>
              </td>
              <th className="w-[17%] border border-black px-2 py-2 text-center">Estimated Total</th>
              <td className="w-[20%] border border-black px-2 py-2 text-center">{money(estimatedTotal, paymentCurrency)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Approved Total</th>
              <td className="border border-black px-2 py-2 text-center">{money(approvedTotal, paymentCurrency)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Paid</th>
              <td className="border border-black px-2 py-2 text-center">{money(paidAmount, paymentCurrency)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Account Payout</th>
              <td className="border border-black px-2 py-2 text-center">{money(accountAmount, accountCurrency)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Rate Used</th>
              <td className="border border-black px-2 py-2 text-center">{rateLabel}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Balance</th>
              <td className="border border-black px-2 py-2 text-center">{money(balance, paymentCurrency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-12 flex justify-evenly text-[12px] font-semibold">
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-6" />
          <p className="mt-3">Requested By</p>
        </div>
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-6" />
          <p className="mt-3">Finance Signature</p>
        </div>
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-6" />
          <p className="mt-3">Authorized Signature</p>
        </div>
      </div>
    </LetterheadPrintShell>
  );
}
