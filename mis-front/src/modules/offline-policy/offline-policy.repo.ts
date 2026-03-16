"use client";

import { api } from "@/lib/api";

export const OFFLINE_POLICY_CACHE_KEY = "offline_policy_cache_v1";
export const OFFLINE_SYSTEM_BLOCKED_KEY = "offline_system_blocked_v1";
export const OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY = "offline_system_last_enforced_deadline_v1";
export const OFFLINE_POLICY_PENDING_RESET_KEY = "offline_policy_pending_reset_v1";
export const OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY = "offline_policy_pending_unsynced_reset_v1";

export const OFFLINE_POLICY_MODULES = [
  "customers",
  "apartments",
  "apartment_sales",
  "apartment_sale_financials",
  "installments",
  "roles",
  "users",
  "rentals",
  "rental_payments",
  "employees",
] as const;

export type OfflineModuleKey = (typeof OFFLINE_POLICY_MODULES)[number];

export type OfflinePolicy = {
  system_offline_until: string | null;
  unsynced_delete_at: string | null;
  unsynced_retention_days: number;
  module_retention_days: Record<OfflineModuleKey, number>;
};

const DEFAULT_RETENTION_DAYS = 365;

export const DEFAULT_OFFLINE_POLICY: OfflinePolicy = {
  system_offline_until: null,
  unsynced_delete_at: null,
  unsynced_retention_days: DEFAULT_RETENTION_DAYS,
  module_retention_days: {
    customers: DEFAULT_RETENTION_DAYS,
    apartments: DEFAULT_RETENTION_DAYS,
    employees: DEFAULT_RETENTION_DAYS,
    apartment_sales: DEFAULT_RETENTION_DAYS,
    apartment_sale_financials: DEFAULT_RETENTION_DAYS,
    installments: DEFAULT_RETENTION_DAYS,
    roles: DEFAULT_RETENTION_DAYS,
    users: DEFAULT_RETENTION_DAYS,
    rentals: DEFAULT_RETENTION_DAYS,
    rental_payments: DEFAULT_RETENTION_DAYS,
  },
};

type Obj = Record<string, unknown>;

const asObj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});

function toDays(value: unknown, fallback = DEFAULT_RETENTION_DAYS): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(3650, Math.trunc(parsed)));
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function normalizeOfflinePolicy(input: unknown): OfflinePolicy {
  const root = asObj(input);
  const moduleRetention = asObj(root.module_retention_days);

  return {
    system_offline_until: toIsoOrNull(root.system_offline_until),
    unsynced_delete_at: toIsoOrNull(root.unsynced_delete_at),
    unsynced_retention_days: toDays(root.unsynced_retention_days),
    module_retention_days: {
      customers: toDays(moduleRetention.customers),
      apartments: toDays(moduleRetention.apartments),
      employees: toDays(moduleRetention.employees),
      apartment_sales: toDays(moduleRetention.apartment_sales),
      apartment_sale_financials: toDays(moduleRetention.apartment_sale_financials),
      installments: toDays(moduleRetention.installments),
      roles: toDays(moduleRetention.roles),
      users: toDays(moduleRetention.users),
      rentals: toDays(moduleRetention.rentals),
      rental_payments: toDays(moduleRetention.rental_payments),
    },
  };
}

export function getCachedOfflinePolicy(): OfflinePolicy {
  if (typeof window === "undefined") return DEFAULT_OFFLINE_POLICY;
  const raw = window.localStorage.getItem(OFFLINE_POLICY_CACHE_KEY);
  if (!raw) return DEFAULT_OFFLINE_POLICY;

  try {
    return normalizeOfflinePolicy(JSON.parse(raw));
  } catch {
    return DEFAULT_OFFLINE_POLICY;
  }
}

export function setCachedOfflinePolicy(policy: OfflinePolicy): void {
  if (typeof window === "undefined") return;
  const pendingSystemReset = getPendingOfflinePolicyReset();
  const pendingUnsyncedReset = getPendingUnsyncedDeleteReset();
  const effectivePolicy: OfflinePolicy = {
    ...policy,
    system_offline_until:
      pendingSystemReset && policy.system_offline_until === pendingSystemReset ? null : policy.system_offline_until,
    unsynced_delete_at:
      pendingUnsyncedReset && policy.unsynced_delete_at === pendingUnsyncedReset ? null : policy.unsynced_delete_at,
  };

  if (pendingSystemReset && effectivePolicy.system_offline_until !== pendingSystemReset) {
    clearPendingOfflinePolicyReset();
  }
  if (pendingUnsyncedReset && effectivePolicy.unsynced_delete_at !== pendingUnsyncedReset) {
    clearPendingUnsyncedDeleteReset();
  }

  window.localStorage.setItem(OFFLINE_POLICY_CACHE_KEY, JSON.stringify(effectivePolicy));
  const lastEnforced = getLastEnforcedOfflineDeadline();
  if (lastEnforced && lastEnforced !== effectivePolicy.system_offline_until) {
    clearLastEnforcedOfflineDeadline();
  }
  setOfflineSystemBlocked(isOfflineAccessExpired(effectivePolicy));
  window.dispatchEvent(new CustomEvent("offline-policy:changed", { detail: effectivePolicy }));
}

export function getPendingOfflinePolicyReset(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(OFFLINE_POLICY_PENDING_RESET_KEY);
}

export function setPendingOfflinePolicyReset(iso: string | null): void {
  if (typeof window === "undefined") return;
  if (!iso) {
    window.localStorage.removeItem(OFFLINE_POLICY_PENDING_RESET_KEY);
    return;
  }
  window.localStorage.setItem(OFFLINE_POLICY_PENDING_RESET_KEY, iso);
}

export function clearPendingOfflinePolicyReset(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OFFLINE_POLICY_PENDING_RESET_KEY);
}

export function getPendingUnsyncedDeleteReset(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY);
}

export function setPendingUnsyncedDeleteReset(iso: string | null): void {
  if (typeof window === "undefined") return;
  if (!iso) {
    window.localStorage.removeItem(OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY);
    return;
  }
  window.localStorage.setItem(OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY, iso);
}

export function clearPendingUnsyncedDeleteReset(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY);
}

export function consumeExpiredOfflineDeadline(): void {
  const current = getCachedOfflinePolicy();
  const expiredDeadline = current.system_offline_until;
  if (!expiredDeadline) return;

  setPendingOfflinePolicyReset(expiredDeadline);
  setCachedOfflinePolicy({
    ...current,
    system_offline_until: null,
  });
}

export function consumeExpiredUnsyncedDeleteAt(): void {
  const current = getCachedOfflinePolicy();
  const expiredDeadline = current.unsynced_delete_at;
  if (!expiredDeadline) return;

  setPendingUnsyncedDeleteReset(expiredDeadline);
  setCachedOfflinePolicy({
    ...current,
    unsynced_delete_at: null,
  });
}

export async function syncPendingOfflinePolicyReset(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const pendingSystemReset = getPendingOfflinePolicyReset();
  const pendingUnsyncedReset = getPendingUnsyncedDeleteReset();
  if (!pendingSystemReset && !pendingUnsyncedReset) return;

  const cached = getCachedOfflinePolicy();
  const payload = normalizeOfflinePolicy({
    ...cached,
    system_offline_until: pendingSystemReset ? null : cached.system_offline_until,
    unsynced_delete_at: pendingUnsyncedReset ? null : cached.unsynced_delete_at,
  });

  const res = await api.put("/api/settings/offline-policy", payload);
  const policy = normalizeOfflinePolicy(asObj(res.data).data);
  clearPendingOfflinePolicyReset();
  clearPendingUnsyncedDeleteReset();
  setCachedOfflinePolicy(policy);
}

export function isOfflineSystemBlocked(): boolean {
  if (typeof window === "undefined") return false;
  const blocked = window.localStorage.getItem(OFFLINE_SYSTEM_BLOCKED_KEY) === "1";
  if (!blocked) return false;

  const policy = getCachedOfflinePolicy();
  const hasDeadline = Boolean(policy.system_offline_until);
  const expired = isOfflineAccessExpired(policy);

  if (!hasDeadline || !expired) {
    window.localStorage.removeItem(OFFLINE_SYSTEM_BLOCKED_KEY);
    window.localStorage.removeItem(OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY);
    return false;
  }

  return true;
}

export function setOfflineSystemBlocked(blocked: boolean): void {
  if (typeof window === "undefined") return;
  if (blocked) {
    window.localStorage.setItem(OFFLINE_SYSTEM_BLOCKED_KEY, "1");
    return;
  }
  window.localStorage.removeItem(OFFLINE_SYSTEM_BLOCKED_KEY);
}

export function getLastEnforcedOfflineDeadline(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY);
}

export function setLastEnforcedOfflineDeadline(iso: string | null): void {
  if (typeof window === "undefined") return;
  if (!iso) {
    window.localStorage.removeItem(OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY);
    return;
  }
  window.localStorage.setItem(OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY, iso);
}

export function clearLastEnforcedOfflineDeadline(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY);
}

export function isOfflineAccessExpired(policy: OfflinePolicy = getCachedOfflinePolicy()): boolean {
  const iso = policy.system_offline_until;
  if (!iso) return false;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && Date.now() >= parsed;
}

export function getOfflineModuleRetentionDays(module: OfflineModuleKey, fallback = 180): number {
  const policy = getCachedOfflinePolicy();
  return policy.module_retention_days[module] ?? fallback;
}

export async function offlinePolicyGet(): Promise<OfflinePolicy> {
  const res = await api.get("/api/settings/offline-policy");
  const policy = normalizeOfflinePolicy(asObj(res.data).data);
  setCachedOfflinePolicy(policy);
  return getCachedOfflinePolicy();
}

export async function offlinePolicySave(input: OfflinePolicy): Promise<OfflinePolicy> {
  const payload = normalizeOfflinePolicy(input);
  const res = await api.put("/api/settings/offline-policy", payload);
  const policy = normalizeOfflinePolicy(asObj(res.data).data);
  setCachedOfflinePolicy(policy);
  return getCachedOfflinePolicy();
}

export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const OFFLINE_POLICY_MODULE_LABELS: Record<OfflineModuleKey, string> = {
  customers: "Customers",
  apartments: "Apartments",
  employees: "Employees",
  apartment_sales: "Apartment Sales",
  apartment_sale_financials: "Sale Financials",
  installments: "Installments",
  roles: "Roles",
  users: "Users",
  rentals: "Rentals",
  rental_payments: "Rental Payments",
};
