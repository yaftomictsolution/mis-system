"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";

export type DashboardSummary = {
  totalApartments: number;
  availableApartments: number;
  soldApartments: number;
  totalCustomers: number;
  totalRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  pendingApprovals: number;
  overdueInstallments: number;
  overdueAmount: number;
  municipalityPending: number;
  municipalityPendingCount: number;
  activeRentals: number;
  rentalsDueSoon: number;
};

export type DashboardSalesPoint = {
  name: string;
  sales: number;
};

export type DashboardStatusPoint = {
  name: string;
  value: number;
  color: string;
};

export type DashboardRecentSale = {
  id: string;
  customer: string;
  apartment: string;
  amount: string;
  date: string;
  status: string;
  href: string;
};

export type DashboardApproval = {
  id: string;
  desc: string;
  requester: string;
  time: string;
  href?: string;
};

export type DashboardProgressItem = {
  id: string;
  name: string;
  location: string;
  progress: number;
  status: string;
  href: string;
};

export type DashboardActivity = {
  id: string;
  text: string;
  time: string;
  user: string;
  type: "sale" | "milestone" | "payment" | "document" | "alert";
};

export type DashboardMetric = {
  label: string;
  value: string;
  color: string;
  bar: string;
  width: string;
};

export type DashboardData = {
  loading: boolean;
  summary: DashboardSummary;
  salesChartData: DashboardSalesPoint[];
  apartmentStatusData: DashboardStatusPoint[];
  recentSales: DashboardRecentSale[];
  approvals: DashboardApproval[];
  progressItems: DashboardProgressItem[];
  activities: DashboardActivity[];
  metrics: DashboardMetric[];
  refresh: () => Promise<void>;
};

const EMPTY_SUMMARY: DashboardSummary = {
  totalApartments: 0,
  availableApartments: 0,
  soldApartments: 0,
  totalCustomers: 0,
  totalRevenue: 0,
  currentMonthRevenue: 0,
  previousMonthRevenue: 0,
  pendingApprovals: 0,
  overdueInstallments: 0,
  overdueAmount: 0,
  municipalityPending: 0,
  municipalityPendingCount: 0,
  activeRentals: 0,
  rentalsDueSoon: 0,
};

function safeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function timestampOf(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyFull(amount: number): string {
  return `AFN ${Math.round(amount).toLocaleString()}`;
}

function formatDate(value: number | string | null | undefined): string {
  const ts = timestampOf(value);
  if (!ts) return "-";
  return new Date(ts).toISOString().slice(0, 10);
}

function relativeTime(value: number | string | null | undefined): string {
  const ts = timestampOf(value);
  if (!ts) return "-";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} min ago`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} hr ago`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `${days} day ago`;
}

function revenueForSale(sale: {
  actual_net_revenue?: number;
  net_price?: number;
  total_price?: number;
  discount?: number;
}): number {
  const actual = Number(sale.actual_net_revenue ?? 0);
  if (Number.isFinite(actual) && actual > 0) return actual;

  const net = Number(sale.net_price ?? 0);
  if (Number.isFinite(net) && net > 0) return net;

  const total = Number(sale.total_price ?? 0);
  const discount = Number(sale.discount ?? 0);
  return Math.max(0, total - discount);
}

function installmentIsOverdue(row: {
  status?: string;
  due_date?: number;
  amount?: number;
  paid_amount?: number;
}): boolean {
  if (safeStatus(row.status) === "overdue") return true;
  const dueTs = Number(row.due_date ?? 0);
  if (!Number.isFinite(dueTs) || dueTs <= 0) return false;
  const fullyPaid = Number(row.paid_amount ?? 0) >= Number(row.amount ?? 0);
  if (fullyPaid) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueTs < today.getTime();
}

function percentage(part: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function percentWidth(part: number, total: number): string {
  return `${percentage(part, total)}%`;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastSixMonths(): Array<{ key: string; label: string }> {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const current = new Date();
  current.setUTCDate(1);
  current.setUTCHours(0, 0, 0, 0);

  const items: Array<{ key: string; label: string }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const point = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - i, 1));
    items.push({ key: monthKey(point), label: formatter.format(point) });
  }
  return items;
}

function activityTypeFromNotification(category: string | null): DashboardActivity["type"] {
  const normalized = safeStatus(category);
  if (normalized.includes("sale")) return "sale";
  if (normalized.includes("payment") || normalized.includes("bill")) return "payment";
  if (normalized.includes("document")) return "document";
  if (normalized.includes("eligible") || normalized.includes("alert")) return "alert";
  return "milestone";
}

function isSalePendingDeedApproval(
  sale: {
    status?: string;
    deed_status?: string;
    uuid?: string;
  },
  financial?: {
    customer_debt?: number;
    remaining_municipality?: number;
  } | null,
): boolean {
  if (safeStatus(sale.deed_status) === "issued") return false;
  if (safeStatus(sale.status) !== "completed") return false;
  if (!financial) return false;

  const customerDebt = Number(financial.customer_debt ?? 0);
  const remainingMunicipality = Number(financial.remaining_municipality ?? 0);
  return customerDebt <= 0 && remainingMunicipality <= 0;
}

export function useDashboardData(): DashboardData {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [salesChartData, setSalesChartData] = useState<DashboardSalesPoint[]>([]);
  const [apartmentStatusData, setApartmentStatusData] = useState<DashboardStatusPoint[]>([]);
  const [recentSales, setRecentSales] = useState<DashboardRecentSale[]>([]);
  const [approvals, setApprovals] = useState<DashboardApproval[]>([]);
  const [progressItems, setProgressItems] = useState<DashboardProgressItem[]>([]);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    const [apartments, customers, sales, installments, financials, rentals, notifications] = await Promise.all([
      db.apartments.toArray(),
      db.customers.toArray(),
      db.apartment_sales.toArray(),
      db.installments.toArray(),
      db.apartment_sale_financials.toArray(),
      db.rentals.toArray(),
      db.admin_notifications.toArray(),
    ]);

    const customerById = new Map<number, string>();
    for (const customer of customers) {
      if (typeof customer.id === "number" && customer.id > 0) {
        customerById.set(customer.id, customer.name || "Customer");
      }
    }

    const apartmentById = new Map<number, string>();
    for (const apartment of apartments) {
      if (typeof apartment.id === "number" && apartment.id > 0) {
        apartmentById.set(apartment.id, apartment.apartment_code || "Apartment");
      }
    }

    const financialBySaleUuid = new Map<string, (typeof financials)[number]>();
    for (const financial of financials) {
      const saleUuid = String(financial.sale_uuid ?? "").trim();
      if (!saleUuid) continue;
      financialBySaleUuid.set(saleUuid, financial);
    }

    const apartmentStatuses = apartments.reduce(
      (acc, apartment) => {
        const status = safeStatus(apartment.status);
        if (status === "sold" || status === "handed_over") acc.sold += 1;
        else if (status === "rented") acc.rented += 1;
        else if (status === "reserved") acc.reserved += 1;
        else if (status === "company_use") acc.companyUse += 1;
        else acc.available += 1;
        return acc;
      },
      { available: 0, sold: 0, rented: 0, reserved: 0, companyUse: 0 },
    );

    const now = new Date();
    const currentMonthKey = monthKey(now);
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousMonthKey = monthKey(previousMonth);

    let totalRevenue = 0;
    let currentMonthRevenue = 0;
    let previousMonthRevenue = 0;
    const salesByMonth = new Map<string, number>();

    for (const sale of sales) {
      const revenue = revenueForSale(sale);
      totalRevenue += revenue;

      const saleTs = timestampOf(Number(sale.sale_date ?? 0));
      if (!saleTs) continue;
      const key = monthKey(new Date(saleTs));
      salesByMonth.set(key, Number(((salesByMonth.get(key) ?? 0) + revenue).toFixed(2)));
      if (key === currentMonthKey) currentMonthRevenue += revenue;
      if (key === previousMonthKey) previousMonthRevenue += revenue;
    }

    const overdueRows = installments.filter((row) => installmentIsOverdue(row));
    const overdueAmount = overdueRows.reduce((sum, row) => {
      const remaining =
        row.remaining_amount == null
          ? Math.max(0, Number(row.amount ?? 0) - Number(row.paid_amount ?? 0))
          : Number(row.remaining_amount ?? 0);
      return sum + Math.max(0, remaining);
    }, 0);

    const municipalityPending = financials.reduce(
      (sum, row) => sum + Math.max(0, Number(row.remaining_municipality ?? 0)),
      0,
    );
    const municipalityPendingCount = financials.filter((row) => Number(row.remaining_municipality ?? 0) > 0).length;

    const activeRentalStatuses = new Set(["active", "advance_pending"]);
    const closedRentalStatuses = new Set(["completed", "terminated", "defaulted", "cancelled"]);
    const activeRentals = rentals.filter((row) => activeRentalStatuses.has(safeStatus(row.status))).length;
    const rentalsDueSoon = rentals.filter((row) => {
      const status = safeStatus(row.status);
      if (closedRentalStatuses.has(status)) return false;
      const nextDue = Number(row.next_due_date ?? 0);
      if (!Number.isFinite(nextDue) || nextDue <= 0) return false;
      const diff = nextDue - Date.now();
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const latestDeedNotificationBySaleUuid = new Map<string, (typeof notifications)[number]>();
    const deedNotifications = [...notifications]
      .filter((row) => safeStatus(row.category) === "sale_deed_eligible")
      .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at));

    for (const notification of deedNotifications) {
      const saleUuid = String(notification.sale_uuid ?? "").trim();
      if (!saleUuid || latestDeedNotificationBySaleUuid.has(saleUuid)) continue;
      latestDeedNotificationBySaleUuid.set(saleUuid, notification);
    }

    const pendingApprovalSales = sales
      .filter((sale) => isSalePendingDeedApproval(sale, financialBySaleUuid.get(sale.uuid)))
      .sort((a, b) => {
        const notificationA = latestDeedNotificationBySaleUuid.get(a.uuid);
        const notificationB = latestDeedNotificationBySaleUuid.get(b.uuid);
        const timeA = timestampOf(notificationA?.created_at) || timestampOf(a.updated_at) || timestampOf(a.sale_date);
        const timeB = timestampOf(notificationB?.created_at) || timestampOf(b.updated_at) || timestampOf(b.sale_date);
        return timeB - timeA;
      });

    const nextRecentSales = [...sales]
      .sort((a, b) => Number(b.sale_date ?? 0) - Number(a.sale_date ?? 0))
      .slice(0, 5)
      .map((sale) => {
        const customer = customerById.get(Number(sale.customer_id ?? 0)) || sale.sale_id || "Customer";
        const apartment = apartmentById.get(Number(sale.apartment_id ?? 0)) || "Apartment";
        const amount = formatCurrencyFull(revenueForSale(sale));
        const status = safeStatus(sale.status);
        return {
          id: sale.uuid,
          customer,
          apartment,
          amount,
          date: formatDate(sale.sale_date),
          status: status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : "Active",
          href: sale.uuid ? `/apartment-sales/${sale.uuid}/financial` : "/apartment-sales",
        };
      });

    const nextApprovals = pendingApprovalSales.slice(0, 6).map((sale) => {
      const notification = latestDeedNotificationBySaleUuid.get(sale.uuid);
      const saleId = String(sale.sale_id ?? "").trim() || sale.uuid.slice(0, 8).toUpperCase();
      const customerName = customerById.get(Number(sale.customer_id ?? 0)) || "Customer";
      const apartmentName = apartmentById.get(Number(sale.apartment_id ?? 0)) || "Apartment";

      return {
        id: sale.uuid,
        desc:
          notification?.title ||
          `Deed approval required for ${apartmentName}`,
        requester: `${customerName} - Sale ${saleId}`,
        time: relativeTime(notification?.created_at ?? sale.updated_at ?? sale.sale_date),
        href: `/apartment-sales/${sale.uuid}/financial`,
      };
    });

    const totalRentalCount = rentals.length;
    const rentalStatusCounts = {
      active: rentals.filter((row) => safeStatus(row.status) === "active").length,
      advancePending: rentals.filter((row) => safeStatus(row.status) === "advance_pending").length,
      completed: rentals.filter((row) => safeStatus(row.status) === "completed").length,
    };

    const nextProgressItems: DashboardProgressItem[] = totalRentalCount
      ? [
          {
            id: "active-rentals",
            name: "Active Rentals",
            location: `${rentalStatusCounts.active} active contracts`,
            progress: percentage(rentalStatusCounts.active, totalRentalCount),
            status: "Tracking occupied units",
            href: "/rentals",
          },
          {
            id: "advance-pending",
            name: "Advance Pending",
            location: `${rentalStatusCounts.advancePending} contracts waiting for full advance`,
            progress: percentage(rentalStatusCounts.advancePending, totalRentalCount),
            status: "Needs collection follow-up",
            href: "/rentals",
          },
          {
            id: "completed-rentals",
            name: "Completed Rentals",
            location: `${rentalStatusCounts.completed} closed successfully`,
            progress: percentage(rentalStatusCounts.completed, totalRentalCount),
            status: "Closed rental agreements",
            href: "/rentals",
          },
        ]
      : [];

    const notificationActivities = [...notifications]
      .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        text: item.title || item.message || "Notification update",
        time: relativeTime(item.created_at),
        user: item.sale_id ? `Sale ${item.sale_id}` : item.type.split("\\").pop() || "System",
        type: activityTypeFromNotification(item.category),
      }));

    const fallbackActivities: DashboardActivity[] = [
      ...nextRecentSales.slice(0, 3).map((sale) => ({
        id: `sale-${sale.id}`,
        text: `Sale recorded for ${sale.apartment}`,
        time: sale.date,
        user: sale.customer,
        type: "sale" as const,
      })),
      ...(overdueRows.length
        ? [
            {
              id: "overdue-installments",
              text: `${overdueRows.length} installments are currently overdue`,
              time: "live",
              user: "Collections",
              type: "alert" as const,
            },
          ]
        : []),
      ...(rentalsDueSoon
        ? [
            {
              id: "rentals-due-soon",
              text: `${rentalsDueSoon} rentals have payments due within 7 days`,
              time: "live",
              user: "Rentals",
              type: "payment" as const,
            },
          ]
        : []),
    ].slice(0, 5);

    const nextSalesChartData = lastSixMonths().map((entry) => ({
      name: entry.label,
      sales: Number((salesByMonth.get(entry.key) ?? 0).toFixed(2)),
    }));

    const nextApartmentStatusData: DashboardStatusPoint[] = [
      { name: "Available", value: apartmentStatuses.available, color: "#3b82f6" },
      { name: "Sold", value: apartmentStatuses.sold, color: "#10b981" },
      { name: "Rented", value: apartmentStatuses.rented, color: "#f59e0b" },
      { name: "Reserved", value: apartmentStatuses.reserved, color: "#a855f7" },
      { name: "Company Use", value: apartmentStatuses.companyUse, color: "#64748b" },
    ].filter((item) => item.value > 0);

    const unreadNotifications = notifications.filter((row) => !row.read_at).length;
    const nextMetrics: DashboardMetric[] = [
      {
        label: "Available Units",
        value: `${apartmentStatuses.available}`,
        color: "text-blue-600 dark:text-blue-400",
        bar: "bg-blue-500",
        width: percentWidth(apartmentStatuses.available, apartments.length),
      },
      {
        label: "Sold Units",
        value: `${apartmentStatuses.sold}`,
        color: "text-emerald-600 dark:text-emerald-400",
        bar: "bg-emerald-500",
        width: percentWidth(apartmentStatuses.sold, apartments.length),
      },
      {
        label: "Overdue Rate",
        value: `${percentage(overdueRows.length, installments.length)}%`,
        color: "text-amber-600 dark:text-amber-400",
        bar: "bg-amber-500",
        width: percentWidth(overdueRows.length, installments.length),
      },
      {
        label: "Unread Alerts",
        value: `${unreadNotifications}`,
        color: "text-slate-600 dark:text-slate-400",
        bar: "bg-slate-500",
        width: percentWidth(unreadNotifications, notifications.length),
      },
    ];

    setSummary({
      totalApartments: apartments.length,
      availableApartments: apartmentStatuses.available,
      soldApartments: apartmentStatuses.sold,
      totalCustomers: customers.length,
      totalRevenue,
      currentMonthRevenue,
      previousMonthRevenue,
      pendingApprovals: pendingApprovalSales.length,
      overdueInstallments: overdueRows.length,
      overdueAmount,
      municipalityPending,
      municipalityPendingCount,
      activeRentals,
      rentalsDueSoon,
    });
    setSalesChartData(nextSalesChartData);
    setApartmentStatusData(nextApartmentStatusData);
    setRecentSales(nextRecentSales);
    setApprovals(nextApprovals);
    setProgressItems(nextProgressItems);
    setActivities(notificationActivities.length ? notificationActivities : fallbackActivities);
    setMetrics(nextMetrics);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    const unsubscribeInstallments = subscribeAppEvent("installments:changed", () => {
      void load();
    });
    const unsubscribeRentals = subscribeAppEvent("rentals:changed", () => {
      void load();
    });
    const unsubscribeNotifications = subscribeAppEvent("notifications:changed", () => {
      void load();
    });

    const onSyncComplete = () => {
      void load();
    };
    const onOnline = () => {
      void load();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timer);
      unsubscribeInstallments();
      unsubscribeRentals();
      unsubscribeNotifications();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return {
    loading,
    summary,
    salesChartData,
    apartmentStatusData,
    recentSales,
    approvals,
    progressItems,
    activities,
    metrics,
    refresh: load,
  };
}
