"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { ArrowRight, Building2, CalendarClock, FileCheck2, Landmark, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { loadCustomerPortalBundles, type CustomerPortalApartmentBundle } from "@/modules/customer-portal/customer-portal.repo";
import { fetchMe } from "@/store/auth/authSlice";
import type { AppDispatch, RootState } from "@/store/store";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null | undefined): string {
  return moneyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function saleStatusColor(status: string | null | undefined): "blue" | "emerald" | "amber" | "purple" | "slate" {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "completed") return "emerald";
  if (value === "approved" || value === "active") return "blue";
  if (value === "pending") return "amber";
  if (value === "cancelled") return "purple";
  return "slate";
}

export default function CustomerPortalPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { token, user, hydrated, status } = useSelector((state: RootState) => state.auth);
  const [rows, setRows] = useState<CustomerPortalApartmentBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      router.replace("/login?redirect=%2Fcustomer-portal");
      return;
    }

    if (!user && status !== "loading") {
      void dispatch(fetchMe());
    }
  }, [dispatch, hydrated, router, status, token, user]);

  useEffect(() => {
    if (!hydrated || !token || !user) return;

    if (Number(user.customer_id ?? 0) <= 0) {
      router.replace("/");
      return;
    }

    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await loadCustomerPortalBundles();
        if (!active) return;
        setRows(next);
      } catch (error: unknown) {
        if (!active) return;
        const responseStatus = (error as { response?: { status?: number } }).response?.status;
        if (responseStatus === 401) {
          router.replace("/login?redirect=%2Fcustomer-portal");
          return;
        }

        const message =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error instanceof Error ? error.message : "Could not load your apartment details.");
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [hydrated, router, token, user]);

  if (!hydrated || !token || !user) {
    return <PortalShell title="Loading your customer portal..." subtitle="Checking your secure access." />;
  }

  return (
    <PortalShell
      title={`Welcome, ${String(user.full_name || user.email || "Customer").trim()}`}
      subtitle="This page shows only the apartments and payments linked to your account."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          Loading your apartment records...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          No apartment sale is linked to this customer account yet.
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row) => {
            const securePath = row.apartment.qr_access_token ? `/q/${row.apartment.qr_access_token}` : null;
            const rowKey =
              row.sale.uuid ||
              row.apartment.uuid ||
              `${row.sale.sale_id || "sale"}-${row.apartment.apartment_code || "apartment"}`;

            return (
              <section key={rowKey} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <h2 className="text-xl font-semibold">
                        {row.apartment.apartment_code || "Apartment"} - Unit {row.apartment.unit_number || "-"}
                      </h2>
                    </div>
                    <div className="text-sm text-slate-500">
                      Block {row.apartment.block_number || "-"} | Floor {row.apartment.floor_number || "-"} | Sale {row.sale.sale_id || "-"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={saleStatusColor(row.sale.status)}>{row.sale.status || "unknown"}</Badge>
                    <Badge color={row.sale.deed_status === "issued" ? "emerald" : "amber"}>{row.sale.deed_status || "not_issued"}</Badge>
                    {securePath ? (
                      <Link
                        href={securePath}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        Open Secure Apartment Page
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Sale Date" value={formatDate(row.sale.sale_date)} icon={<CalendarClock className="h-4 w-4" />} />
                  <MetricCard label="Net Price" value={formatMoney(row.sale.net_price)} icon={<ShieldCheck className="h-4 w-4" />} />
                  <MetricCard label="Paid Total" value={formatMoney(row.sale.paid_total)} icon={<FileCheck2 className="h-4 w-4" />} />
                  <MetricCard label="Remaining" value={formatMoney(row.sale.remaining_amount)} icon={<Landmark className="h-4 w-4" />} />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
                      Installments
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left">No</th>
                            <th className="px-4 py-3 text-left">Due</th>
                            <th className="px-4 py-3 text-left">Amount</th>
                            <th className="px-4 py-3 text-left">Paid</th>
                            <th className="px-4 py-3 text-left">Remaining</th>
                            <th className="px-4 py-3 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.installments.map((installment) => (
                            <tr key={installment.uuid || `${row.sale.uuid}-${installment.installment_no}`} className="border-t border-slate-100 text-slate-700">
                              <td className="px-4 py-3">{installment.installment_no ?? "-"}</td>
                              <td className="px-4 py-3">{formatDate(installment.due_date)}</td>
                              <td className="px-4 py-3">{formatMoney(installment.amount)}</td>
                              <td className="px-4 py-3">{formatMoney(installment.paid_amount)}</td>
                              <td className="px-4 py-3">{formatMoney(installment.remaining_amount)}</td>
                              <td className="px-4 py-3">
                                <Badge color={saleStatusColor(installment.status)}>{installment.status || "pending"}</Badge>
                              </td>
                            </tr>
                          ))}
                          {row.installments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                                No installment schedule found.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-sm font-semibold text-slate-800">Financial Summary</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      <SummaryRow label="Payment Type" value={row.sale.payment_type || "-"} />
                      <SummaryRow label="Customer Debt" value={formatMoney(row.financial.customer_debt)} />
                      <SummaryRow label="Municipality Share" value={formatMoney(row.financial.municipality_share_15)} />
                      <SummaryRow label="Municipality Remaining" value={formatMoney(row.financial.remaining_municipality)} />
                      <SummaryRow label="Key Handover" value={row.sale.key_handover_status || "-"} />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}

function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Customer Portal</div>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
            </div>
            <Link href="/login" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
              Switch account
            </Link>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span>{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
