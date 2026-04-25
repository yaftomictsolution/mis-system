"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { db } from "@/db/localDB";
import { api } from "@/lib/api";
import { subscribeAppEvent } from "@/lib/appEvents";
import { hasAnyPermission, hasAnyRole } from "@/lib/permissions";
import type { RootState } from "@/store/store";

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
  actionLabel?: string;
};

export type DashboardApprovalQueue = {
  key: "admin" | "storekeeper" | "finance";
  label: string;
  count: number;
  helperText?: string;
  emptyText?: string;
  items: DashboardApproval[];
};

export type DashboardAssetQueueCard = {
  id: "asset_waiting_approval" | "asset_ready_allocate" | "asset_allocated";
  label: string;
  count: number;
  href: string;
  helperText: string;
  color: "orange" | "blue" | "purple";
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
  approvalQueues: DashboardApprovalQueue[];
  assetRequestQueueCards: DashboardAssetQueueCard[];
  progressItems: DashboardProgressItem[];
  activities: DashboardActivity[];
  metrics: DashboardMetric[];
  refresh: () => Promise<void>;
};

type DashboardSnapshot = Omit<DashboardData, "loading" | "refresh"> & {
  generated_at?: string | null;
};

type DashboardCacheEntry = {
  snapshot: DashboardSnapshot;
  isStale: boolean;
};

type DashboardRefreshOptions = {
  force?: boolean;
  silent?: boolean;
  preferLocal?: boolean;
};

const DASHBOARD_CACHE_PREFIX = "dashboard_summary_v1";
const DASHBOARD_CACHE_TTL_SECONDS = 300;
const REMOTE_REFRESH_MIN_INTERVAL_MS = 30_000;
const VISIBLE_REFRESH_MIN_INTERVAL_MS = 30_000;

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

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  generated_at: null,
  summary: EMPTY_SUMMARY,
  salesChartData: [],
  apartmentStatusData: [],
  recentSales: [],
  approvals: [],
  approvalQueues: [],
  assetRequestQueueCards: [],
  progressItems: [],
  activities: [],
  metrics: [],
};

const isOnline = (): boolean => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const nowIso = () => new Date().toISOString();

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toActivityType(value: unknown): DashboardActivity["type"] {
  const type = String(value ?? "").trim().toLowerCase();
  if (type === "sale" || type === "milestone" || type === "payment" || type === "document" || type === "alert") {
    return type;
  }
  return "milestone";
}

function safeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function timestampOf(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
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

function dashboardCacheKey(userId: string): string {
  return `${DASHBOARD_CACHE_PREFIX}:${userId}`;
}

type BuildWorkflowApprovalQueuesInput = {
  baseApprovalCount: number;
  baseApprovals: DashboardApproval[];
  roles: string[];
  permissions: string[];
};

type InternalQueueItem = DashboardApproval & { sortTs: number };

const QUEUE_PREVIEW_LIMIT = 8;

function normalizeQueueActionLabel(value: unknown, fallback = "Review"): string {
  const label = toStringValue(value).trim();
  return label || fallback;
}

function queuePreview(items: InternalQueueItem[]): DashboardApproval[] {
  return [...items]
    .sort((left, right) => right.sortTs - left.sortTs)
    .slice(0, QUEUE_PREVIEW_LIMIT)
    .map(({ sortTs: _sortTs, ...item }) => item);
}

async function buildWorkflowApprovalQueues({
  baseApprovalCount,
  baseApprovals,
  roles,
  permissions,
}: BuildWorkflowApprovalQueuesInput): Promise<DashboardApprovalQueue[]> {
  const [materialRequests, purchaseRequests, assetRequests] = await Promise.all([
    db.material_requests.toArray(),
    db.purchase_requests.toArray(),
    db.asset_requests.toArray(),
  ] as const);

  const canSeeAdminQueue =
    hasAnyRole(roles, "Admin") ||
    hasAnyPermission(permissions, ["material_requests.approve", "purchase_requests.approve", "inventory.approve"]);
  const canSeeStorekeeperQueue =
    hasAnyRole(roles, ["Admin", "Storekeeper"]) ||
    hasAnyPermission(permissions, ["material_requests.issue", "purchase_requests.receive", "inventory.issue"]);
  const canSeeFinanceQueue =
    hasAnyRole(roles, ["Admin", "Accountant"]) ||
    hasAnyPermission(permissions, "purchase_requests.finance");

  const adminMaterialItems: InternalQueueItem[] = materialRequests
    .filter((row) => safeStatus(row.status) === "pending_admin_approval")
    .map((row) => ({
      id: `material-admin-${row.uuid}`,
      desc: `Material request ${row.request_no} is waiting for approval`,
      requester: [row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "Requester", row.project_name || row.warehouse_name || "Inventory"]
        .filter(Boolean)
        .join(" - "),
      time: relativeTime(row.requested_at ?? row.updated_at),
      href: "/inventory-requests?queue=waiting-approval",
      actionLabel: "Review",
      sortTs: timestampOf(row.requested_at ?? row.updated_at),
    }));

  const adminPurchaseItems: InternalQueueItem[] = purchaseRequests
    .filter((row) => safeStatus(row.status) === "pending_admin_approval")
    .map((row) => ({
      id: `purchase-admin-${row.uuid}`,
      desc: `Purchase request ${row.request_no} is waiting for approval`,
      requester: [row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "Requester", row.vendor_name || row.warehouse_name || row.project_name || "Procurement"]
        .filter(Boolean)
        .join(" - "),
      time: relativeTime(row.requested_at ?? row.updated_at),
      href: "/purchase-requests?queue=waiting-approval",
      actionLabel: "Review",
      sortTs: timestampOf(row.requested_at ?? row.updated_at),
    }));

  const adminAssetItems: InternalQueueItem[] = assetRequests
    .filter((row) => {
      const status = safeStatus(row.status);
      return status === "pending_admin_approval" || status === "pending";
    })
    .map((row) => ({
      id: `asset-admin-${row.uuid}`,
      desc: `Asset request ${row.request_no} is waiting for approval`,
      requester: [row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "Requester", row.project_name || "Asset workflow"]
        .filter(Boolean)
        .join(" - "),
      time: relativeTime(row.requested_at ?? row.updated_at),
      href: "/asset-requests?queue=waiting-approval",
      actionLabel: "Review",
      sortTs: timestampOf(row.requested_at ?? row.updated_at),
    }));

  const storekeeperMaterialItems: InternalQueueItem[] = materialRequests
    .filter((row) => {
      const status = safeStatus(row.status);
      return status === "approved" || status === "partial_issued";
    })
    .map((row) => ({
      id: `material-storekeeper-${row.uuid}`,
      desc: `Issue materials for ${row.request_no}`,
      requester: [row.project_name || "Project", row.warehouse_name || "Warehouse"].filter(Boolean).join(" - "),
      time: relativeTime(row.approved_at ?? row.updated_at),
      href: "/inventory-requests?queue=issue-ready",
      actionLabel: "Issue",
      sortTs: timestampOf(row.approved_at ?? row.updated_at),
    }));

  const storekeeperPurchaseItems: InternalQueueItem[] = purchaseRequests
    .filter((row) => {
      const status = safeStatus(row.status);
      return status === "paid" || status === "partial_received";
    })
    .map((row) => ({
      id: `purchase-storekeeper-${row.uuid}`,
      desc: `Receive stock for ${row.request_no}`,
      requester: [row.vendor_name || "Supplier", row.warehouse_name || "Warehouse"].filter(Boolean).join(" - "),
      time: relativeTime(row.payment_processed_at ?? row.updated_at),
      href: "/purchase-requests?queue=receive-ready",
      actionLabel: "Receive",
      sortTs: timestampOf(row.payment_processed_at ?? row.updated_at),
    }));

  const storekeeperAssetItems: InternalQueueItem[] = assetRequests
    .filter((row) => safeStatus(row.status) === "approved")
    .map((row) => ({
      id: `asset-storekeeper-${row.uuid}`,
      desc: `Allocate assets for ${row.request_no}`,
      requester: [row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "Requester", row.project_name || "Asset workflow"]
        .filter(Boolean)
        .join(" - "),
      time: relativeTime(row.approved_at ?? row.updated_at),
      href: "/asset-requests?queue=allocate-ready",
      actionLabel: "Allocate",
      sortTs: timestampOf(row.approved_at ?? row.updated_at),
    }));

  const financePurchaseItems: InternalQueueItem[] = purchaseRequests
    .filter((row) => safeStatus(row.status) === "approved")
    .map((row) => ({
      id: `purchase-finance-${row.uuid}`,
      desc: `Payment is required for ${row.request_no}`,
      requester: [row.vendor_name || "Supplier", row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "Requester"]
        .filter(Boolean)
        .join(" - "),
      time: relativeTime(row.approved_at ?? row.updated_at),
      href: "/purchase-requests?queue=finance-payment",
      actionLabel: "Pay",
      sortTs: timestampOf(row.approved_at ?? row.updated_at),
    }));

  const baseQueueItems: InternalQueueItem[] = baseApprovals.map((item, index) => ({
    ...item,
    actionLabel: normalizeQueueActionLabel(item.actionLabel, "Review"),
    sortTs: Date.now() - index,
  }));

  const queues: DashboardApprovalQueue[] = [];

  if (canSeeAdminQueue) {
    queues.push({
      key: "admin",
      label: "Admin",
      count: baseApprovalCount + adminMaterialItems.length + adminPurchaseItems.length + adminAssetItems.length,
      helperText: "Approvals that need admin review before the workflow can continue.",
      emptyText: "No admin approvals are waiting.",
      items: queuePreview([...baseQueueItems, ...adminMaterialItems, ...adminPurchaseItems, ...adminAssetItems]),
    });
  }

  if (canSeeStorekeeperQueue) {
    queues.push({
      key: "storekeeper",
      label: "Storekeeper",
      count: storekeeperMaterialItems.length + storekeeperPurchaseItems.length + storekeeperAssetItems.length,
      helperText: "Approved issue and receiving work for the warehouse team.",
      emptyText: "No warehouse actions are waiting.",
      items: queuePreview([...storekeeperMaterialItems, ...storekeeperPurchaseItems, ...storekeeperAssetItems]),
    });
  }

  if (canSeeFinanceQueue) {
    queues.push({
      key: "finance",
      label: "Finance",
      count: financePurchaseItems.length,
      helperText: "Approved purchases that still need company-account payment.",
      emptyText: "No finance payments are waiting.",
      items: queuePreview(financePurchaseItems),
    });
  }

  return queues;
}

async function buildAssetRequestQueueCards(
  roles: string[],
  permissions: string[],
): Promise<DashboardAssetQueueCard[]> {
  const assetRequests = await db.asset_requests.toArray();
  const canSeeAdminAssetQueue =
    hasAnyRole(roles, "Admin") || hasAnyPermission(permissions, "inventory.approve");
  const canSeeStorekeeperAssetQueue =
    hasAnyRole(roles, ["Admin", "Storekeeper"]) || hasAnyPermission(permissions, "inventory.issue");

  const waitingApprovalCount = assetRequests.filter((row) => {
    const status = safeStatus(row.status);
    return status === "pending_admin_approval" || status === "pending";
  }).length;
  const readyAllocateCount = assetRequests.filter((row) => safeStatus(row.status) === "approved").length;
  const allocatedCount = assetRequests.filter((row) => safeStatus(row.status) === "allocated").length;

  const cards: DashboardAssetQueueCard[] = [];

  if (canSeeAdminAssetQueue) {
    cards.push({
      id: "asset_waiting_approval",
      label: "Asset Waiting Approval",
      count: waitingApprovalCount,
      href: "/asset-requests?queue=waiting-approval",
      helperText: "New asset requests waiting for admin decision.",
      color: "orange",
    });
  }

  if (canSeeStorekeeperAssetQueue) {
    cards.push({
      id: "asset_ready_allocate",
      label: "Asset Ready To Allocate",
      count: readyAllocateCount,
      href: "/asset-requests?queue=allocate-ready",
      helperText: "Approved asset requests that can now be allocated.",
      color: "blue",
    });
    cards.push({
      id: "asset_allocated",
      label: "Asset Currently Allocated",
      count: allocatedCount,
      href: "/asset-requests?queue=allocated",
      helperText: "Allocated asset requests that are still active in the field.",
      color: "purple",
    });
  }

  return cards;
}

function sanitizeSummary(value: unknown): DashboardSummary {
  const row = asObj(value);
  return {
    totalApartments: toNumber(row.totalApartments),
    availableApartments: toNumber(row.availableApartments),
    soldApartments: toNumber(row.soldApartments),
    totalCustomers: toNumber(row.totalCustomers),
    totalRevenue: toNumber(row.totalRevenue),
    currentMonthRevenue: toNumber(row.currentMonthRevenue),
    previousMonthRevenue: toNumber(row.previousMonthRevenue),
    pendingApprovals: toNumber(row.pendingApprovals),
    overdueInstallments: toNumber(row.overdueInstallments),
    overdueAmount: toNumber(row.overdueAmount),
    municipalityPending: toNumber(row.municipalityPending),
    municipalityPendingCount: toNumber(row.municipalityPendingCount),
    activeRentals: toNumber(row.activeRentals),
    rentalsDueSoon: toNumber(row.rentalsDueSoon),
  };
}

function sanitizeSnapshot(value: unknown): DashboardSnapshot {
  const row = asObj(value);

  return {
    generated_at: row.generated_at == null ? null : String(row.generated_at),
    summary: sanitizeSummary(row.summary),
    salesChartData: asArray(row.salesChartData).map((entry) => {
      const item = asObj(entry);
      return {
        name: toStringValue(item.name),
        sales: toNumber(item.sales),
      };
    }),
    apartmentStatusData: asArray(row.apartmentStatusData).map((entry) => {
      const item = asObj(entry);
      return {
        name: toStringValue(item.name),
        value: toNumber(item.value),
        color: toStringValue(item.color),
      };
    }),
    recentSales: asArray(row.recentSales).map((entry) => {
      const item = asObj(entry);
      return {
        id: toStringValue(item.id),
        customer: toStringValue(item.customer, "Customer"),
        apartment: toStringValue(item.apartment, "Apartment"),
        amount: toStringValue(item.amount, formatCurrencyFull(0)),
        date: toStringValue(item.date, "-"),
        status: toStringValue(item.status, "Active"),
        href: toStringValue(item.href, "/apartment-sales"),
      };
    }),
    approvals: asArray(row.approvals).map((entry) => {
      const item = asObj(entry);
      return {
        id: toStringValue(item.id),
        desc: toStringValue(item.desc),
        requester: toStringValue(item.requester),
        time: toStringValue(item.time, "-"),
        href: item.href == null ? undefined : String(item.href),
        actionLabel: normalizeQueueActionLabel(item.actionLabel, "Review"),
      };
    }),
    approvalQueues: asArray(row.approvalQueues).map((entry) => {
      const item = asObj(entry);
      return {
        key:
          toStringValue(item.key) === "storekeeper"
            ? "storekeeper"
            : toStringValue(item.key) === "finance"
              ? "finance"
              : "admin",
        label: toStringValue(item.label),
        count: toNumber(item.count),
        helperText: toStringValue(item.helperText),
        emptyText: toStringValue(item.emptyText),
        items: asArray(item.items).map((queueEntry) => {
          const queueItem = asObj(queueEntry);
          return {
            id: toStringValue(queueItem.id),
            desc: toStringValue(queueItem.desc),
            requester: toStringValue(queueItem.requester),
            time: toStringValue(queueItem.time, "-"),
            href: queueItem.href == null ? undefined : String(queueItem.href),
            actionLabel: normalizeQueueActionLabel(queueItem.actionLabel, "Review"),
          };
        }),
      };
    }),
    assetRequestQueueCards: asArray(row.assetRequestQueueCards).map((entry) => {
      const item = asObj(entry);
      const idValue = toStringValue(item.id);
      return {
        id:
          idValue === "asset_ready_allocate"
            ? "asset_ready_allocate"
            : idValue === "asset_allocated"
              ? "asset_allocated"
              : "asset_waiting_approval",
        label: toStringValue(item.label),
        count: toNumber(item.count),
        href: toStringValue(item.href, "/asset-requests"),
        helperText: toStringValue(item.helperText),
        color:
          toStringValue(item.color) === "blue"
            ? "blue"
            : toStringValue(item.color) === "purple"
              ? "purple"
              : "orange",
      };
    }),
    progressItems: asArray(row.progressItems).map((entry) => {
      const item = asObj(entry);
      return {
        id: toStringValue(item.id),
        name: toStringValue(item.name),
        location: toStringValue(item.location),
        progress: toNumber(item.progress),
        status: toStringValue(item.status),
        href: toStringValue(item.href, "/rentals"),
      };
    }),
    activities: asArray(row.activities).map((entry) => {
      const item = asObj(entry);
      return {
        id: toStringValue(item.id),
        text: toStringValue(item.text),
        time: toStringValue(item.time, "-"),
        user: toStringValue(item.user, "System"),
        type: toActivityType(item.type),
      };
    }),
    metrics: asArray(row.metrics).map((entry) => {
      const item = asObj(entry);
      return {
        label: toStringValue(item.label),
        value: toStringValue(item.value),
        color: toStringValue(item.color),
        bar: toStringValue(item.bar),
        width: toStringValue(item.width, "0%"),
      };
    }),
  };
}

async function readCachedSnapshot(userId: string): Promise<DashboardCacheEntry | null> {
  if (!userId) return null;
  const row = await db.api_cache.get(dashboardCacheKey(userId));
  if (!row) return null;

  return {
    snapshot: sanitizeSnapshot(row.data),
    isStale: row.updated_at + row.ttl_seconds * 1000 <= Date.now(),
  };
}

async function writeCachedSnapshot(userId: string, snapshot: DashboardSnapshot): Promise<void> {
  if (!userId) return;
  await db.api_cache.put({
    key: dashboardCacheKey(userId),
    data: snapshot,
    updated_at: Date.now(),
    ttl_seconds: DASHBOARD_CACHE_TTL_SECONDS,
  });
}

async function fetchRemoteSnapshot(): Promise<DashboardSnapshot> {
  const response = await api.get("/api/dashboard/summary");
  return sanitizeSnapshot(asObj(response.data).data);
}

async function buildLocalSnapshot(roles: string[], permissions: string[]): Promise<DashboardSnapshot> {
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

  const latestNotificationBySaleCategory = (
    category: string,
  ): Map<string, (typeof notifications)[number]> => {
    const map = new Map<string, (typeof notifications)[number]>();
    const rows = [...notifications]
      .filter((row) => safeStatus(row.category) === category)
      .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at));

    for (const notification of rows) {
      const saleUuid = String(notification.sale_uuid ?? "").trim();
      if (!saleUuid || map.has(saleUuid)) continue;
      map.set(saleUuid, notification);
    }

    return map;
  };

  const latestSaleApprovalNotificationBySaleUuid = latestNotificationBySaleCategory("sale_approval_required");
  const latestDeedNotificationBySaleUuid = latestNotificationBySaleCategory("sale_deed_eligible");
  const deedNotifications = [...notifications]
    .filter((row) => safeStatus(row.category) === "sale_deed_eligible")
    .sort((a, b) => timestampOf(b.created_at) - timestampOf(a.created_at));

  for (const notification of deedNotifications) {
    const saleUuid = String(notification.sale_uuid ?? "").trim();
    if (!saleUuid || latestDeedNotificationBySaleUuid.has(saleUuid)) continue;
    latestDeedNotificationBySaleUuid.set(saleUuid, notification);
  }

  const pendingSaleApprovals = sales
    .filter((sale) => safeStatus(sale.status) === "pending")
    .sort((a, b) => {
      const notificationA = latestSaleApprovalNotificationBySaleUuid.get(a.uuid);
      const notificationB = latestSaleApprovalNotificationBySaleUuid.get(b.uuid);
      const timeA = timestampOf(notificationA?.created_at) || timestampOf(a.updated_at) || timestampOf(a.sale_date);
      const timeB = timestampOf(notificationB?.created_at) || timestampOf(b.updated_at) || timestampOf(b.sale_date);
      return timeB - timeA;
    });

  const pendingApprovalSales = sales
    .filter((sale) => isSalePendingDeedApproval(sale, financialBySaleUuid.get(sale.uuid)))
    .sort((a, b) => {
      const notificationA = latestDeedNotificationBySaleUuid.get(a.uuid);
      const notificationB = latestDeedNotificationBySaleUuid.get(b.uuid);
      const timeA = timestampOf(notificationA?.created_at) || timestampOf(a.updated_at) || timestampOf(a.sale_date);
      const timeB = timestampOf(notificationB?.created_at) || timestampOf(b.updated_at) || timestampOf(b.sale_date);
      return timeB - timeA;
    });

  const recentSales = [...sales]
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

  const approvals = [
    ...pendingSaleApprovals.map((sale) => {
      const notification = latestSaleApprovalNotificationBySaleUuid.get(sale.uuid);
      const saleId = String(sale.sale_id ?? "").trim() || sale.uuid.slice(0, 8).toUpperCase();
      const customerName = customerById.get(Number(sale.customer_id ?? 0)) || "Customer";
      const apartmentName = apartmentById.get(Number(sale.apartment_id ?? 0)) || "Apartment";

      return {
        id: sale.uuid,
        desc: notification?.title || `Sale approval required for ${apartmentName}`,
        requester: `${customerName} - Sale ${saleId}`,
        time: relativeTime(notification?.created_at ?? sale.updated_at ?? sale.sale_date),
        href: "/apartment-sales?tab=pending-approval",
        sortTs: timestampOf(notification?.created_at) || timestampOf(sale.updated_at) || timestampOf(sale.sale_date),
      };
    }),
    ...pendingApprovalSales.map((sale) => {
      const notification = latestDeedNotificationBySaleUuid.get(sale.uuid);
      const saleId = String(sale.sale_id ?? "").trim() || sale.uuid.slice(0, 8).toUpperCase();
      const customerName = customerById.get(Number(sale.customer_id ?? 0)) || "Customer";
      const apartmentName = apartmentById.get(Number(sale.apartment_id ?? 0)) || "Apartment";

      return {
        id: sale.uuid,
        desc: notification?.title || `Deed approval required for ${apartmentName}`,
        requester: `${customerName} - Sale ${saleId}`,
        time: relativeTime(notification?.created_at ?? sale.updated_at ?? sale.sale_date),
        href: `/apartment-sales/${sale.uuid}/financial`,
        sortTs: timestampOf(notification?.created_at) || timestampOf(sale.updated_at) || timestampOf(sale.sale_date),
      };
    }),
  ]
    .sort((a, b) => b.sortTs - a.sortTs)
    .slice(0, 6)
    .map((row): DashboardApproval => ({
      id: row.id,
      desc: row.desc,
      requester: row.requester,
      time: row.time,
      href: row.href,
    }));

  const totalRentalCount = rentals.length;
  const rentalStatusCounts = {
    active: rentals.filter((row) => safeStatus(row.status) === "active").length,
    advancePending: rentals.filter((row) => safeStatus(row.status) === "advance_pending").length,
    completed: rentals.filter((row) => safeStatus(row.status) === "completed").length,
  };

  const progressItems: DashboardProgressItem[] = totalRentalCount
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
    ...recentSales.slice(0, 3).map((sale) => ({
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

  const salesChartData = lastSixMonths().map((entry) => ({
    name: entry.label,
    sales: Number((salesByMonth.get(entry.key) ?? 0).toFixed(2)),
  }));

  const apartmentStatusData: DashboardStatusPoint[] = [
    { name: "Available", value: apartmentStatuses.available, color: "#3b82f6" },
    { name: "Sold", value: apartmentStatuses.sold, color: "#10b981" },
    { name: "Rented", value: apartmentStatuses.rented, color: "#f59e0b" },
    { name: "Reserved", value: apartmentStatuses.reserved, color: "#a855f7" },
    { name: "Company Use", value: apartmentStatuses.companyUse, color: "#64748b" },
  ].filter((item) => item.value > 0);

  const unreadNotifications = notifications.filter((row) => !row.read_at).length;
  const metrics: DashboardMetric[] = [
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

  const summary: DashboardSummary = {
    totalApartments: apartments.length,
    availableApartments: apartmentStatuses.available,
    soldApartments: apartmentStatuses.sold,
    totalCustomers: customers.length,
    totalRevenue,
    currentMonthRevenue,
    previousMonthRevenue,
    pendingApprovals: pendingSaleApprovals.length + pendingApprovalSales.length,
    overdueInstallments: overdueRows.length,
    overdueAmount,
    municipalityPending,
    municipalityPendingCount,
    activeRentals,
    rentalsDueSoon,
  };

  const approvalQueues = await buildWorkflowApprovalQueues({
    baseApprovalCount: summary.pendingApprovals,
    baseApprovals: approvals,
    roles,
    permissions,
  });
  const assetRequestQueueCards = await buildAssetRequestQueueCards(roles, permissions);

  return {
    generated_at: nowIso(),
    summary,
    salesChartData,
    apartmentStatusData,
    recentSales,
    approvals,
    approvalQueues,
    assetRequestQueueCards,
    progressItems,
    activities: notificationActivities.length ? notificationActivities : fallbackActivities,
    metrics,
  };
}

export function useDashboardData(): DashboardData {
  const userId = useSelector((state: RootState) => String(state.auth.user?.id ?? "").trim());
  const roles = useSelector((state: RootState) => state.auth.user?.roles ?? []);
  const permissions = useSelector((state: RootState) => state.auth.user?.permissions ?? []);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [snapshotOwner, setSnapshotOwner] = useState("");
  const lastRemoteFetchRef = useRef(0);
  const lastVisibleRefreshRef = useRef(0);

  const refresh = useCallback(async (options: DashboardRefreshOptions = {}): Promise<void> => {
    const { force = false, silent = false, preferLocal = false } = options;
    const shouldPreferLocal = preferLocal || !isOnline();

    if (!silent) {
      setLoading(true);
    }

    let localSnapshot: DashboardSnapshot | null = null;
    if (shouldPreferLocal) {
      localSnapshot = await buildLocalSnapshot(roles, permissions);
      setSnapshot(localSnapshot);
      setSnapshotOwner(userId);
      if (!silent) {
        setLoading(false);
      }
    }

    const cached = !shouldPreferLocal && userId ? await readCachedSnapshot(userId) : null;
    if (cached) {
      setSnapshot(cached.snapshot);
      setSnapshotOwner(userId);
      if (!silent) {
        setLoading(false);
      }
    }

    const shouldFetchRemote =
      isOnline() &&
      Boolean(userId) &&
      (force || !cached || cached.isStale || Date.now() - lastRemoteFetchRef.current >= REMOTE_REFRESH_MIN_INTERVAL_MS);

    if (shouldFetchRemote) {
      try {
        lastRemoteFetchRef.current = Date.now();
        const remoteSnapshot = await fetchRemoteSnapshot();
        const [approvalQueues, assetRequestQueueCards] = await Promise.all([
          buildWorkflowApprovalQueues({
            baseApprovalCount: remoteSnapshot.summary.pendingApprovals,
            baseApprovals: remoteSnapshot.approvals,
            roles,
            permissions,
          }),
          buildAssetRequestQueueCards(roles, permissions),
        ]);
        const enrichedRemoteSnapshot: DashboardSnapshot = {
          ...remoteSnapshot,
          approvalQueues,
          assetRequestQueueCards,
        };
        setSnapshot(enrichedRemoteSnapshot);
        setSnapshotOwner(userId);
        await writeCachedSnapshot(userId, enrichedRemoteSnapshot);
        setLoading(false);
        return;
      } catch {
        if (cached || localSnapshot) {
          setLoading(false);
          return;
        }
      }
    }

    if (cached || localSnapshot) {
      setLoading(false);
      return;
    }

    const fallbackSnapshot = await buildLocalSnapshot(roles, permissions);
    setSnapshot(fallbackSnapshot);
    setSnapshotOwner(userId);
    setLoading(false);
  }, [permissions, roles, userId]);

  useEffect(() => {
    let disposed = false;

    const runRefresh = (options: DashboardRefreshOptions = {}) => {
      void refresh(options).catch(() => {
        if (!disposed) {
          setLoading(false);
        }
      });
    };

    runRefresh({ force: true });

    const unsubscribeInstallments = subscribeAppEvent("installments:changed", () => {
      runRefresh({ force: isOnline(), silent: true, preferLocal: true });
    });
    const unsubscribeRentals = subscribeAppEvent("rentals:changed", () => {
      runRefresh({ force: isOnline(), silent: true, preferLocal: true });
    });
    const unsubscribeNotifications = subscribeAppEvent("notifications:changed", () => {
      runRefresh({ force: isOnline(), silent: true, preferLocal: true });
    });
    const unsubscribeAssetRequests = subscribeAppEvent("asset-requests:changed", () => {
      runRefresh({ force: isOnline(), silent: true, preferLocal: true });
    });

    const onSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ syncedAny?: boolean }>).detail;
      if (!detail?.syncedAny) return;
      runRefresh({ force: true, silent: true });
    };
    const onOnline = () => {
      runRefresh({ force: true, silent: true });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastVisibleRefreshRef.current < VISIBLE_REFRESH_MIN_INTERVAL_MS) {
          return;
        }
        lastVisibleRefreshRef.current = now;
        runRefresh({ silent: true });
      }
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      unsubscribeInstallments();
      unsubscribeRentals();
      unsubscribeNotifications();
      unsubscribeAssetRequests();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const visibleSnapshot = snapshotOwner === userId ? snapshot : EMPTY_SNAPSHOT;

  return {
    loading,
    summary: visibleSnapshot.summary,
    salesChartData: visibleSnapshot.salesChartData,
    apartmentStatusData: visibleSnapshot.apartmentStatusData,
    recentSales: visibleSnapshot.recentSales,
    approvals: visibleSnapshot.approvals,
    approvalQueues: visibleSnapshot.approvalQueues,
    assetRequestQueueCards: visibleSnapshot.assetRequestQueueCards,
    progressItems: visibleSnapshot.progressItems,
    activities: visibleSnapshot.activities,
    metrics: visibleSnapshot.metrics,
    refresh: async () => {
      await refresh({ force: true });
    },
  };
}
