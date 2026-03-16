"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { db, type ApartmentSaleRow, type CustomerRow, type InstallmentRow } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";
import { apartmentSalePullToLocal } from "@/modules/apartment-sales/apartment-sales.repo";
import { customerGetLocal, customersPullToLocal } from "@/modules/customers/customers.repo";
import { installmentsPullToLocal } from "@/modules/installments/installments.repo";

const money = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const toDate = (value: number | null | undefined): string => {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
};

type ActivityData = {
  customer: CustomerRow | null;
  sales: ApartmentSaleRow[];
  installments: InstallmentRow[];
  apartmentLabelById: Map<number, string>;
};

export default function CustomerActivityPage() {
  const params = useParams<{ uuid?: string | string[] }>();
  const customerUuid = useMemo(() => {
    const raw = params?.uuid;
    if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
    return String(raw ?? "").trim();
  }, [params?.uuid]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [sales, setSales] = useState<ApartmentSaleRow[]>([]);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [apartmentLabelById, setApartmentLabelById] = useState<Map<number, string>>(() => new Map());
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const loadLocal = useCallback(async (): Promise<ActivityData> => {
    if (!customerUuid) {
      return { customer: null, sales: [], installments: [], apartmentLabelById: new Map() };
    }

    const customerRow = await customerGetLocal(customerUuid);
    if (!customerRow) {
      return { customer: null, sales: [], installments: [], apartmentLabelById: new Map() };
    }

    const customerId = Number(customerRow.id ?? 0);
    const customerSales =
      customerId > 0 ? await db.apartment_sales.where("customer_id").equals(customerId).toArray() : [];
    customerSales.sort((a, b) => Number(b.sale_date ?? b.updated_at ?? 0) - Number(a.sale_date ?? a.updated_at ?? 0));

    const saleIds = customerSales
      .map((row) => Number(row.id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);
    const saleUuids = customerSales.map((row) => String(row.uuid ?? "").trim()).filter(Boolean);

    const [installmentsBySaleId, installmentsBySaleUuid, apartments] = await Promise.all([
      saleIds.length
        ? db.installments.where("apartment_sale_id").anyOf([...new Set(saleIds)]).toArray()
        : Promise.resolve([] as InstallmentRow[]),
      saleUuids.length
        ? db.installments.where("sale_uuid").anyOf([...new Set(saleUuids)]).toArray()
        : Promise.resolve([] as InstallmentRow[]),
      db.apartments.toArray(),
    ]);

    const byUuid = new Map<string, InstallmentRow>();
    for (const row of [...installmentsBySaleId, ...installmentsBySaleUuid]) {
      if (!row.uuid) continue;
      byUuid.set(row.uuid, row);
    }

    const customerInstallments = [...byUuid.values()].sort((a, b) => {
      const dueA = Number(a.due_date ?? 0);
      const dueB = Number(b.due_date ?? 0);
      if (dueA !== dueB) return dueA - dueB;
      return Number(a.installment_no ?? 0) - Number(b.installment_no ?? 0);
    });

    const labelMap = new Map<number, string>();
    for (const apartment of apartments) {
      if (!apartment.id || apartment.id <= 0) continue;
      labelMap.set(apartment.id, `${apartment.apartment_code} - Unit ${apartment.unit_number}`);
    }

    return {
      customer: customerRow,
      sales: customerSales,
      installments: customerInstallments,
      apartmentLabelById: labelMap,
    };
  }, [customerUuid]);

  const applyData = useCallback((data: ActivityData): void => {
    setCustomer(data.customer);
    setSales(data.sales);
    setInstallments(data.installments);
    setApartmentLabelById(data.apartmentLabelById);
  }, []);

  const refresh = useCallback(async () => {
    if (!customerUuid) {
      setError("Customer id is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      applyData(await loadLocal());
      try {
        await Promise.all([customersPullToLocal(), apartmentSalePullToLocal(), installmentsPullToLocal()]);
      } catch {}
      applyData(await loadLocal());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load customer activity.");
    } finally {
      setLoading(false);
    }
  }, [applyData, customerUuid, loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void (async () => applyData(await loadLocal()))();
    };

    const unsubscribeInstallmentsChanged = subscribeAppEvent("installments:changed", () => {
      void (async () => applyData(await loadLocal()))();
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      unsubscribeInstallmentsChanged();
    };
  }, [applyData, loadLocal]);

  const saleIdBySaleUuid = useMemo(() => {
    const map = new Map<string, string>();
    for (const sale of sales) {
      if (!sale.uuid) continue;
      map.set(sale.uuid, sale.sale_id || sale.uuid.slice(0, 8).toUpperCase());
    }
    return map;
  }, [sales]);

  const totals = useMemo(() => {
    const totalContracts = sales.length;
    const totalInstallments = installments.length;
    const totalPaid = installments.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0);
    const totalRemaining = installments.reduce(
      (sum, row) => sum + Math.max(0, Number(row.amount ?? 0) - Number(row.paid_amount ?? 0)),
      0
    );
    return { totalContracts, totalInstallments, totalPaid, totalRemaining };
  }, [installments, sales.length]);

  const printPage = useCallback(() => {
    const area = printAreaRef.current;
    if (!area) return;

    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) return;

    const title = customer?.name ? `Customer Activity - ${customer.name}` : "Customer Activity";
    const printedAt = new Date().toLocaleString();
    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { margin: 0 0 8px; font-size: 20px; }
            .meta { margin: 0 0 16px; color: #64748b; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
            .label { color: #64748b; font-size: 12px; }
            .value { margin-top: 4px; font-size: 18px; font-weight: 700; }
            section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
            h2 { margin: 0 0 10px; font-size: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
            th:last-child, td:last-child { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="meta">Printed at: ${printedAt}</p>
          ${area.innerHTML}
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
  }, [customer?.name]);

  return (
    <RequirePermission permission="customers.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Customer Activity Report" subtitle={customer ? customer.name : "Loading customer..."}>
          <div className="flex items-center gap-2 print:hidden">
            <Link
              href="/customers"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={printPage}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Print
            </button>
          </div>
        </PageHeader>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300">
            Loading customer activity...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-600 dark:border-red-500/30 dark:bg-[#12121a]">
            {error}
          </div>
        ) : !customer ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-600 dark:border-red-500/30 dark:bg-[#12121a]">
            Customer not found.
          </div>
        ) : (
          <div ref={printAreaRef} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500 dark:text-slate-400">Contracts</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{totals.totalContracts}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500 dark:text-slate-400">Installments</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{totals.totalInstallments}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500 dark:text-slate-400">Paid Amount</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-600">{money(totals.totalPaid)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
                <div className="text-xs text-slate-500 dark:text-slate-400">Remaining Amount</div>
                <div className="mt-1 text-2xl font-semibold text-amber-600">{money(totals.totalRemaining)}</div>
              </div>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Sales / Contracts</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 dark:border-[#2a2a3e] dark:bg-[#171724] dark:text-slate-300">
                      <th className="px-3 py-2 font-semibold">Sale ID</th>
                      <th className="px-3 py-2 font-semibold">Apartment</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Payment</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Key</th>
                      <th className="px-3 py-2 font-semibold">Deed</th>
                      <th className="px-3 py-2 text-right font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                          No contracts found for this customer.
                        </td>
                      </tr>
                    ) : (
                      sales.map((sale) => (
                        <tr
                          key={sale.uuid}
                          className="border-b border-slate-100 even:bg-slate-50/50 dark:border-[#2a2a3e] dark:even:bg-[#171724]/40"
                        >
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                            {sale.sale_id || sale.uuid.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {apartmentLabelById.get(sale.apartment_id) ?? `Apartment #${sale.apartment_id}`}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{toDate(sale.sale_date)}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{sale.payment_type}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{sale.status}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{sale.key_handover_status ?? "-"}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{sale.deed_status ?? "-"}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">
                            {money(Number(sale.net_price ?? sale.total_price - sale.discount))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Installment Activity</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 dark:border-[#2a2a3e] dark:bg-[#171724] dark:text-slate-300">
                      <th className="px-3 py-2 font-semibold">Sale</th>
                      <th className="px-3 py-2 font-semibold">No</th>
                      <th className="px-3 py-2 font-semibold">Due Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-right font-semibold">Paid</th>
                      <th className="px-3 py-2 font-semibold">Paid Date</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                          No installment activity found for this customer.
                        </td>
                      </tr>
                    ) : (
                      installments.map((row) => (
                        <tr
                          key={row.uuid}
                          className="border-b border-slate-100 even:bg-slate-50/50 dark:border-[#2a2a3e] dark:even:bg-[#171724]/40"
                        >
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {row.sale_id || saleIdBySaleUuid.get(String(row.sale_uuid ?? "")) || row.sale_uuid || row.apartment_sale_id}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.installment_no}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{toDate(row.due_date)}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">
                            {money(Number(row.amount ?? 0))}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-emerald-600">{money(Number(row.paid_amount ?? 0))}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{toDate(row.paid_date)}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{row.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
