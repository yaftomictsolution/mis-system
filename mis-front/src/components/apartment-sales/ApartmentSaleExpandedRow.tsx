"use client";

import Link from "next/link";
import type { ApartmentSaleRow } from "@/db/localDB";
import { toCurrency, toDateLabel, toMoney2 } from "@/components/apartment-sales/apartment-sale.page-helpers";

type ApartmentSaleExpandedRowProps = {
  row: ApartmentSaleRow;
  customerLabel: string;
  apartmentLabel: string;
  paidTotal: number;
  customerRemaining: number;
  municipalityRemaining: number;
};

/**
 * Renders secondary sale details shown when a table row is expanded.
 */
export function ApartmentSaleExpandedRow({
  row,
  customerLabel,
  apartmentLabel,
  paidTotal,
  customerRemaining,
  municipalityRemaining,
}: ApartmentSaleExpandedRowProps) {
  const municipalityShare = toMoney2(Number(row.total_price ?? 0) * 0.15);
  const actualNetRevenue = toMoney2(Number(row.actual_net_revenue ?? 0));
  const deedStatus = String(row.deed_status ?? "not_issued").replaceAll("_", " ");
  const possessionStatus = String(row.key_handover_status ?? "not_handed_over").replaceAll("_", " ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sale Details</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{`Date: ${toDateLabel(row.sale_date)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`First Due: ${toDateLabel(row.first_due_date)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Installments: ${row.installment_count ?? row.installments_count ?? "-"}`}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer & Unit</div>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{customerLabel}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{apartmentLabel}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Payment: ${row.payment_type || "full"}`}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Balances</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{`Paid: ${toCurrency(paidTotal)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Customer Remaining: ${toCurrency(customerRemaining)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Municipality Remaining: ${toCurrency(municipalityRemaining)}`}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Financial</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{`Municipality 15%: ${toCurrency(municipalityShare)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Actual Net: ${toCurrency(actualNetRevenue)}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Possession: ${possessionStatus}`}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{`Deed: ${deedStatus}`}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/apartment-sales/${row.uuid}/financial`}
          className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
        >
          Financial Breakdown
        </Link>
        <Link
          href={`/apartment-sales/${row.uuid}/history`}
          className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Customer History
        </Link>
      </div>
    </div>
  );
}

