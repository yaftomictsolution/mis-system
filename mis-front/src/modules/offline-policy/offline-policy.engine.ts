"use client";

import { useEffect } from "react";
import { db } from "@/db/localDB";
import { notifyInfo } from "@/lib/notify";
import {
  consumeExpiredOfflineDeadline,
  consumeExpiredUnsyncedDeleteAt,
  clearLastEnforcedOfflineDeadline,
  getCachedOfflinePolicy,
  getLastEnforcedOfflineDeadline,
  isOfflineAccessExpired,
  isOfflineSystemBlocked,
  getOfflineModuleRetentionDays,
  offlinePolicyGet,
  OFFLINE_POLICY_MODULES,
  OFFLINE_POLICY_CACHE_KEY,
  OFFLINE_POLICY_PENDING_RESET_KEY,
  OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY,
  OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY,
  OFFLINE_SYSTEM_BLOCKED_KEY,
  setLastEnforcedOfflineDeadline,
  setOfflineSystemBlocked,
  syncPendingOfflinePolicyReset,
  type OfflineModuleKey,
} from "./offline-policy.repo";

const DAY_MS = 24 * 60 * 60 * 1000;
const POLICY_REFRESH_MS = 5 * 60 * 1000;
const POLICY_ENFORCE_MS = 5 * 1000;

type ModuleCleanupConfig = {
  getTable: () =>
    | {
      where(index: string): {
        below(value: number): {
          toArray(): Promise<Array<{ uuid?: string }>>;
        };
      };
      bulkDelete(keys: string[]): Promise<unknown>;
    }
    | undefined;
  entity?: string;
};

type RollbackTable = {
  put(value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

const MODULE_CONFIG: Record<OfflineModuleKey, ModuleCleanupConfig> = {
  customers: { getTable: () => db.customers, entity: "customers" },
  apartments: { getTable: () => db.apartments, entity: "apartments" },
  employees: { getTable: () => db.employees, entity: "employees" },
  apartment_sales: { getTable: () => db.apartment_sales, entity: "apartment_sales" },
  apartment_sale_financials: { getTable: () => db.apartment_sale_financials, entity: "apartment_sale_financials" },
  installments: { getTable: () => db.installments, entity: "installments" },
  roles: { getTable: () => db.roles, entity: "roles" },
  users: { getTable: () => db.users, entity: "users" },
  rentals: { getTable: () => db.rentals },
  rental_payments: { getTable: () => db.rental_payments },
};

const ROLLBACK_ENTITY_TABLES: Record<string, (() => RollbackTable | undefined) | undefined> = {
  customers: () => db.customers as unknown as RollbackTable,
  apartments: () => db.apartments as unknown as RollbackTable,
  employees: () => db.employees as unknown as RollbackTable,
  apartment_sales: () => db.apartment_sales as unknown as RollbackTable,
  apartment_sale_financials: () => db.apartment_sale_financials as unknown as RollbackTable,
  installments: () => db.installments as unknown as RollbackTable,
  roles: () => db.roles as unknown as RollbackTable,
  users: () => db.users as unknown as RollbackTable,
};

let maintenanceInProgress = false;

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && Date.now() >= parsed;
}

async function cleanupModuleStore(module: OfflineModuleKey): Promise<number> {
  const retentionDays = getOfflineModuleRetentionDays(module, 180);
  const { getTable, entity } = MODULE_CONFIG[module];
  const table = getTable();
  if (!table) return 0;
  const cutoff = retentionDays <= 0 ? Date.now() : Date.now() - retentionDays * DAY_MS;
  const lockedUuids = new Set<string>();

  if (entity) {
    const pending = await db.sync_queue.where("entity").equals(entity).toArray();
    for (const item of pending) {
      lockedUuids.add(item.uuid);
    }
  }

  const oldRows = await table.where("updated_at").below(cutoff).toArray();
  const removable = oldRows
    .filter((row) => !lockedUuids.has(String((row as { uuid?: string }).uuid ?? "")))
    .map((row) => String((row as { uuid?: string }).uuid ?? ""))
    .filter(Boolean);

  if (!removable.length) return 0;

  await table.bulkDelete(removable);
  return removable.length;
}

async function purgeUnsyncedItemsByAge(retentionDays: number): Promise<number> {
  const queueRows =
    retentionDays <= 0 ? await db.sync_queue.toArray() : await db.sync_queue.where("created_at").below(Date.now() - retentionDays * DAY_MS).toArray();
  const moduleOps =
    retentionDays <= 0
      ? await db.pending_module_ops.toArray()
      : await db.pending_module_ops.where("created_at").below(Date.now() - retentionDays * DAY_MS).toArray();
  const attachmentRows =
    retentionDays <= 0
      ? await db.pending_attachments.toArray()
      : await db.pending_attachments.where("created_at").below(Date.now() - retentionDays * DAY_MS).toArray();

  await rollbackPurgedSyncQueueRows(queueRows);

  for (const item of moduleOps) {
    if (item.module === "documents" && item.action === "create") {
      const payload = item.payload as { temp_id?: number };
      if (payload?.temp_id) {
        await db.system_documents.delete(payload.temp_id);
      }
    }
    if (item.module === "crm" && item.action === "create") {
      const payload = item.payload as { temp_id?: number };
      if (payload?.temp_id) {
        await db.crm_messages.delete(payload.temp_id);
      }
    }
  }

  if (queueRows.length) {
    await db.sync_queue.bulkDelete(queueRows.map((row) => row.id).filter((id): id is number => id !== undefined));
  }
  if (moduleOps.length) {
    await db.pending_module_ops.bulkDelete(moduleOps.map((row) => row.id).filter((id): id is number => id !== undefined));
  }
  if (attachmentRows.length) {
    await db.pending_attachments.bulkDelete(
      attachmentRows.map((row) => row.id).filter((id): id is number => id !== undefined),
    );
  }

  return queueRows.length + moduleOps.length + attachmentRows.length;
}

async function purgeAllUnsyncedItems(): Promise<number> {
  const queueRows = await db.sync_queue.toArray();
  const moduleOps = await db.pending_module_ops.toArray();
  const attachmentRows = await db.pending_attachments.toArray();
  await rollbackPurgedSyncQueueRows(queueRows);

  for (const item of moduleOps) {
    if (item.module === "documents" && item.action === "create") {
      const payload = item.payload as { temp_id?: number };
      if (payload?.temp_id) {
        await db.system_documents.delete(payload.temp_id);
      }
    }
    if (item.module === "crm" && item.action === "create") {
      const payload = item.payload as { temp_id?: number };
      if (payload?.temp_id) {
        await db.crm_messages.delete(payload.temp_id);
      }
    }
  }

  await db.sync_queue.clear();
  await db.pending_module_ops.clear();
  await db.pending_attachments.clear();
  return queueRows.length + moduleOps.length + attachmentRows.length;
}

async function rollbackPurgedSyncQueueRows(queueRows: Array<{
  entity: string;
  uuid: string;
  local_key?: string | null;
  action: "create" | "update" | "delete";
  rollback_snapshot?: unknown;
  created_at?: number;
}>): Promise<void> {
  const orderedRows = [...queueRows].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
  const groups = new Map<string, typeof queueRows>();

  for (const row of orderedRows) {
    const localKey = String(row.local_key ?? row.uuid ?? "").trim();
    if (!localKey) continue;
    const groupKey = `${row.entity}:${localKey}`;
    const list = groups.get(groupKey) ?? [];
    list.push(row);
    groups.set(groupKey, list);
  }

  for (const [groupKey, rows] of groups) {
    const [entity, localKey] = groupKey.split(":");
    const table = ROLLBACK_ENTITY_TABLES[entity]?.();
    if (!table) continue;

    const first = rows[0];
    if (first.action === "create") {
      await table.delete(localKey);
      continue;
    }

    if (first.rollback_snapshot !== undefined && first.rollback_snapshot !== null) {
      await table.put(first.rollback_snapshot);
    }
  }
}

function emitUnsyncedQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sync:queue:changed"));
}

async function clearSessionForExpiredOfflineAccess(): Promise<void> {
  await db.session.clear();

  if (typeof window === "undefined") return;

  const preserved = new Set([
    "theme",
    OFFLINE_POLICY_CACHE_KEY,
    OFFLINE_POLICY_PENDING_RESET_KEY,
    OFFLINE_POLICY_PENDING_UNSYNCED_RESET_KEY,
    OFFLINE_SYSTEM_BLOCKED_KEY,
    OFFLINE_SYSTEM_LAST_ENFORCED_DEADLINE_KEY,
  ]);

  for (const key of Object.keys(window.localStorage)) {
    if (!preserved.has(key)) {
      window.localStorage.removeItem(key);
    }
  }

  window.sessionStorage.clear();
}

async function blockOfflineSystem(deadlineIso: string | null): Promise<void> {
  setLastEnforcedOfflineDeadline(deadlineIso);
  setOfflineSystemBlocked(true);
  consumeExpiredOfflineDeadline();
  await clearSessionForExpiredOfflineAccess();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline:blocked"));
    window.location.replace("/login");
  }
}

async function expireOfflineAccessWhileOnline(deadlineIso: string | null): Promise<void> {
  setLastEnforcedOfflineDeadline(deadlineIso);
  setOfflineSystemBlocked(true);
  consumeExpiredOfflineDeadline();
  try {
    await syncPendingOfflinePolicyReset();
  } catch {
    // Keep the local reset marker and retry on the next online policy refresh/login.
  }
  await clearSessionForExpiredOfflineAccess();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline:blocked"));
    window.location.replace("/login");
  }
}

export async function runOfflinePolicyMaintenance(): Promise<void> {
  if (maintenanceInProgress || typeof window === "undefined") return;
  maintenanceInProgress = true;

  try {
    const policy = getCachedOfflinePolicy();

    const deadline = policy.system_offline_until;
    if (isOfflineAccessExpired(policy) && deadline && getLastEnforcedOfflineDeadline() !== deadline) {
      if (isOffline()) {
        await blockOfflineSystem(deadline);
        notifyInfo("Offline system access expired. The session was ended and unsynced records were kept for later sync.");
      } else {
        await expireOfflineAccessWhileOnline(deadline);
        notifyInfo("Offline system access expired. The session was ended and unsynced records were kept for later sync.");
      }
      return;
    }

    let changed = 0;
    for (const moduleKey of OFFLINE_POLICY_MODULES) {
      changed += await cleanupModuleStore(moduleKey);
    }

    if (isOffline()) {
      changed += await purgeUnsyncedItemsByAge(policy.unsynced_retention_days);
    }

    if (isExpired(policy.unsynced_delete_at)) {
      changed += await purgeAllUnsyncedItems();
      consumeExpiredUnsyncedDeleteAt();
      emitUnsyncedQueueChanged();
      try {
        await syncPendingOfflinePolicyReset();
      } catch {
        // Keep the local reset marker and retry on the next online policy refresh/login.
      }
    }

    if (changed > 0) {
      window.dispatchEvent(new CustomEvent("sync:complete", { detail: { syncedAny: false, cleaned: true } }));
    }
  } finally {
    maintenanceInProgress = false;
  }
}

export function useOfflinePolicyGuard(): void {
  useEffect(() => {
    const refreshPolicy = async () => {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      try {
        await syncPendingOfflinePolicyReset();
        const policy = await offlinePolicyGet();
        if (!isOfflineAccessExpired(policy)) {
          clearLastEnforcedOfflineDeadline();
        }
      } catch {
        // Keep the last cached policy.
      }
    };

    const tick = async (refreshRemote: boolean) => {
      if (refreshRemote) {
        await refreshPolicy();
      }
      await runOfflinePolicyMaintenance();
    };

    void tick(true);

    const enforceTimer = window.setInterval(() => {
      void tick(false);
    }, POLICY_ENFORCE_MS);

    const refreshTimer = window.setInterval(() => {
      void tick(true);
    }, POLICY_REFRESH_MS);

    const onOnline = () => {
      void tick(true);
    };
    const onOffline = () => {
      if (isOfflineSystemBlocked() || isOfflineAccessExpired()) {
        window.location.replace("/login");
        return;
      }
      void tick(false);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (!navigator.onLine && (isOfflineSystemBlocked() || isOfflineAccessExpired())) {
          window.location.replace("/login");
          return;
        }
        void tick(navigator.onLine);
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(enforceTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
