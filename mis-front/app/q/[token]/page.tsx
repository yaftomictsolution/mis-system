"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { Building2, CalendarClock, Landmark, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { loadQrAccessBundle, type QrAccessBundle, type QrAccessScope } from "@/modules/qr-access/qr-access.repo";
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

function badgeForScope(scope: QrAccessScope | null): { label: string; color: "blue" | "emerald" | "amber" } {
  if (scope === "admin") return { label: "Admin Access", color: "emerald" };
  if (scope === "sales") return { label: "Staff Access", color: "blue" };
  return { label: "Customer Access", color: "amber" };
}

function badgeForStatus(status: string | null | undefined): "blue" | "emerald" | "amber" | "purple" | "slate" {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "completed" || value === "paid" || value === "issued") return "emerald";
  if (value === "approved" || value === "active") return "blue";
  if (value === "pending") return "amber";
  if (value === "cancelled") return "purple";
  return "slate";
}

export default function ApartmentQrAccessPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { token, user, hydrated, status } = useSelector((state: RootState) => state.auth);
  const [bundle, setBundle] = useState<QrAccessBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routeToken = useMemo(() => {
    const raw = Array.isArray(params?.token) ? params.token[0] : params?.token;
    return String(raw ?? "").trim();
  }, [params]);

  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(`/q/${routeToken}`)}`);
      return;
    }

    if (!user && status !== "loading") {
      void dispatch(fetchMe());
    }
  }, [dispatch, hydrated, routeToken, router, status, token, user]);

  useEffect(() => {
    if (!hydrated || !token || !user || !routeToken) return;

    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await loadQrAccessBundle(routeToken);
        if (!active) return;
        setBundle(next);
      } catch (error: unknown) {
        if (!active) return;

        const responseStatus = (error as { response?: { status?: number } }).response?.status;
        if (responseStatus === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(`/q/${routeToken}`)}`);
          return;
        }

        const message =
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (error instanceof Error ? error.message : "Could not load apartment QR details.");
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
  }, [hydrated, routeToken, router, token, user]);

  if (!hydrated || !token || !user) {
    return <AccessShell title="Checking QR access..." subtitle="Preparing your secure apartment view." />;
  }

  const scopeBadge = badgeForScope(bundle?.access_scope ?? null);

  return (
    <AccessShell
      title={bundle?.apartment.apartment_code ? `Apartment ${bundle.apartment.apartment_code}` : "Apartment QR Access"}
      subtitle="This page shows data only after login and only within the permissions of your account."
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          Loading apartment details...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          {error}
        </div>
      ) : bundle ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <h1 className="text-2xl font-semibold">
                    {bundle.apartment.apartment_code || "Apartment"} - Unit {bundle.apartment.unit_number || "-"}
                  </h1>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Block {bundle.apartment.block_number || "-"} | Floor {bundle.apartment.floor_number || "-"} | Usage {bundle.apartment.usage_type || "-"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={scopeBadge.color}>{scopeBadge.label}</Badge>
                <Badge color={badgeForStatus(bundle.sale?.status)}>{bundle.sale?.status || bundle.apartment.status || "unknown"}</Badge>
                {Number(user.customer_id ?? 0) > 0 ? (
                  <Link href="/customer-portal" className="text-sm font-medium text-blue-700 transition-colors hover:text-blue-900">
                    Customer portal
                  </Link>
                ) : (
                  <Link href="/" className="text-sm font-medium text-blue-700 transition-colors hover:text-blue-900">
                    Dashboard
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Area" value={`${bundle.apartment.area_sqm ?? 0} sqm`} icon={<Building2 className="h-4 w-4" />} />
              <MetricCard label="Sale Date" value={formatDate(bundle.sale?.sale_date)} icon={<CalendarClock className="h-4 w-4" />} />
              <MetricCard label="Net Price" value={formatMoney(bundle.sale?.net_price)} icon={<ShieldCheck className="h-4 w-4" />} />
              <MetricCard label="Paid Total" value={formatMoney(bundle.sale?.paid_total)} icon={<Landmark className="h-4 w-4" />} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 text-lg font-semibold text-slate-900">Sale and Customer</div>
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryBox label="Sale ID" value={bundle.sale?.sale_id || "-"} />
                <SummaryBox label="Payment Type" value={bundle.sale?.payment_type || "-"} />
                <SummaryBox label="Customer Remaining" value={formatMoney(bundle.sale?.customer_remaining)} />
                <SummaryBox label="Deed Status" value={bundle.sale?.deed_status || "-"} />
                <SummaryBox label="Key Handover" value={bundle.sale?.key_handover_status || "-"} />
                <SummaryBox label="QR Status" value={bundle.apartment.qr_status || "-"} />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <UserRound className="h-4 w-4" />
                  Customer
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <SummaryRow label="Name" value={bundle.customer?.name || "-"} />
                  <SummaryRow label="Phone" value={bundle.customer?.phone || "-"} />
                  <SummaryRow label="Email" value={bundle.customer?.email || "-"} />
                </div>
              </div>
            </section>

            {bundle.access_scope === "customer" ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 text-lg font-semibold text-slate-900">Customer Payment Summary</div>
                <div className="space-y-3 text-sm text-slate-700">
                  <SummaryRow label="Total Price" value={formatMoney(bundle.sale?.total_price)} />
                  <SummaryRow label="Discount" value={formatMoney(bundle.sale?.discount)} />
                  <SummaryRow label="Net Price" value={formatMoney(bundle.sale?.net_price)} />
                  <SummaryRow label="Paid Total" value={formatMoney(bundle.sale?.paid_total)} />
                  <SummaryRow label="Remaining" value={formatMoney(bundle.sale?.customer_remaining)} />
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 text-lg font-semibold text-slate-900">Financial Summary</div>
                <div className="space-y-3 text-sm text-slate-700">
                  <SummaryRow label="Company Share" value={formatMoney(bundle.financial?.company_share_85)} />
                  <SummaryRow label="Delivered To Company" value={formatMoney(bundle.financial?.delivered_to_company)} />
                  <SummaryRow label="Municipality Share" value={formatMoney(bundle.financial?.municipality_share_15)} />
                  <SummaryRow label="Delivered To Municipality" value={formatMoney(bundle.financial?.delivered_to_municipality)} />
                  <SummaryRow label="Municipality Remaining" value={formatMoney(bundle.financial?.remaining_municipality)} />
                  <SummaryRow label="Customer Debt" value={formatMoney(bundle.financial?.customer_debt)} />
                </div>
              </section>
            )}
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4 text-lg font-semibold text-slate-900">Installments</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 text-left">No</th>
                    <th className="px-6 py-3 text-left">Due</th>
                    <th className="px-6 py-3 text-left">Amount</th>
                    <th className="px-6 py-3 text-left">Paid</th>
                    <th className="px-6 py-3 text-left">Remaining</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.installments.map((installment) => (
                    <tr key={installment.uuid || `${bundle.sale?.uuid}-${installment.installment_no}`} className="border-t border-slate-100 text-slate-700">
                      <td className="px-6 py-3">{installment.installment_no ?? "-"}</td>
                      <td className="px-6 py-3">{formatDate(installment.due_date)}</td>
                      <td className="px-6 py-3">{formatMoney(installment.amount)}</td>
                      <td className="px-6 py-3">{formatMoney(installment.paid_amount)}</td>
                      <td className="px-6 py-3">{formatMoney(installment.remaining_amount)}</td>
                      <td className="px-6 py-3">
                        <Badge color={badgeForStatus(installment.status)}>{installment.status || "pending"}</Badge>
                      </td>
                      <td className="px-6 py-3">{formatDate(installment.paid_date)}</td>
                    </tr>
                  ))}
                  {bundle.installments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                        No installments are available for this apartment.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </AccessShell>
  );
}

function AccessShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Secure QR Access</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
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

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
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
