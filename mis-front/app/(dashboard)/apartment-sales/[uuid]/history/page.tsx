"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ApartmentSaleRow } from "@/db/localDB";
import { apartmentSaleGetLocal, apartmentSalePullToLocal } from "@/modules/apartment-sales/apartment-sales.repo";
import {
  apartmentSaleInstallmentPaymentsList,
  apartmentSalePossessionLogsList,
  type SaleInstallmentPaymentRow,
  type SalePossessionLogRow,
} from "@/modules/apartment-sales/apartment-sale-history.repo";
import { installmentsPullToLocal } from "@/modules/installments/installments.repo";

const money = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const toDateTime = (value: number | null | undefined): string => {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleString();
};

const actionLabel = (action: string): string => {
  const key = action.trim().toLowerCase();
  if (key === "key_handover") return "Key Handover";
  if (key === "key_return") return "Key Return";
  if (key === "terminated") return "Terminated";
  return action || "unknown";
};

const actionColor = (action: string): "blue" | "emerald" | "amber" | "red" | "purple" | "slate" => {
  const key = action.trim().toLowerCase();
  if (key === "key_handover") return "emerald";
  if (key === "key_return") return "purple";
  if (key === "terminated") return "red";
  return "slate";
};

export default function ApartmentSaleHistoryPage() {
  const params = useParams<{ uuid?: string | string[] }>();
  const saleUuid = useMemo(() => {
    const raw = params?.uuid;
    if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
    return String(raw ?? "").trim();
  }, [params?.uuid]);

  const [sale, setSale] = useState<ApartmentSaleRow | null>(null);
  const [payments, setPayments] = useState<SaleInstallmentPaymentRow[]>([]);
  const [logs, setLogs] = useState<SalePossessionLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadSaleLocal = useCallback(async (): Promise<ApartmentSaleRow | null> => {
    if (!saleUuid) return null;
    const row = await apartmentSaleGetLocal(saleUuid);
    if (!row) return null;
    setSale(row);
    return row;
  }, [saleUuid]);

  const loadHistory = useCallback(async () => {
    if (!saleUuid) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const [paymentRows, logRows] = await Promise.all([
        apartmentSaleInstallmentPaymentsList(saleUuid),
        apartmentSalePossessionLogsList(saleUuid),
      ]);
      setPayments(paymentRows);
      setLogs(logRows);
    } catch (error: unknown) {
      setPayments([]);
      setLogs([]);
      setHistoryError(error instanceof Error ? error.message : "Failed to load sale history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [saleUuid]);

  const refresh = useCallback(async () => {
    if (!saleUuid) {
      setLoadError("Sale uuid is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      try {
        await Promise.all([apartmentSalePullToLocal(), installmentsPullToLocal()]);
      } catch {}

      const row = await loadSaleLocal();
      if (!row) {
        setLoadError("Sale not found.");
        return;
      }

      await loadHistory();
    } finally {
      setLoading(false);
    }
  }, [loadHistory, loadSaleLocal, saleUuid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void (async () => {
        await loadSaleLocal();
      })();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [loadSaleLocal]);

  const totalPaid = useMemo(
    () => payments.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0),
    [payments]
  );
  const handoverCount = useMemo(
    () => logs.filter((row) => row.action.trim().toLowerCase() === "key_handover").length,
    [logs]
  );
  const keyReturnCount = useMemo(
    () => logs.filter((row) => row.action.trim().toLowerCase() === "key_return").length,
    [logs]
  );

  return (
    <RequirePermission permission={["sales.create", "sales.approve"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Sale History"
          subtitle={sale ? `Audit trail for ${sale.sale_id || sale.uuid}` : "Installment payments and possession logs"}
        >
          <div className="flex items-center gap-2">
            <Link
              href={sale ? `/apartment-sales/${sale.uuid}/financial` : "/apartment-sales"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Financial
            </Link>
            <Link
              href="/apartment-sales"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Back To Sales
            </Link>
          </div>
        </PageHeader>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#12121a]">
            Loading history page...
          </div>
        ) : loadError || !sale ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-600 dark:border-red-500/30 dark:bg-[#12121a]">
            {loadError ?? "Sale not found."}
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500">Sale</div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{sale.sale_id || sale.uuid}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500">Recorded Payments</div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{payments.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500">Total Paid (Audit)</div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{money(totalPaid)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500">Possession Events</div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  {`${handoverCount} handover / ${keyReturnCount} return`}
                </div>
              </div>
            </div>

            {historyError && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {historyError}
              </div>
            )}

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Installment Payment Audit</h2>
                {historyLoading && <span className="text-xs text-slate-500">Refreshing...</span>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a3e]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600 dark:bg-[#0f111a] dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Installment #</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Payment Date</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Received By</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-500" colSpan={7}>
                          No payment audit rows found for this sale.
                        </td>
                      </tr>
                    ) : (
                      payments.map((row) => (
                        <tr key={row.uuid} className="border-t border-slate-200 dark:border-[#2a2a3e]">
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{row.installment_no || "-"}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{money(row.amount)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{toDateTime(row.payment_date)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.payment_method || "-"}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.received_by_name || row.received_by || "-"}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.reference_no || "-"}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.notes || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Possession Logs</h2>
                {historyLoading && <span className="text-xs text-slate-500">Refreshing...</span>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a3e]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600 dark:bg-[#0f111a] dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-500" colSpan={4}>
                          No possession logs found for this sale.
                        </td>
                      </tr>
                    ) : (
                      logs.map((row) => (
                        <tr key={row.uuid} className="border-t border-slate-200 dark:border-[#2a2a3e]">
                          <td className="px-3 py-2">
                            <Badge color={actionColor(row.action)}>{actionLabel(row.action)}</Badge>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{toDateTime(row.action_date)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.user_name || row.user_id || "-"}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.note || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </RequirePermission>
  );
}
