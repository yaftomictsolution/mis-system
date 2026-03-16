"use client";

import { db } from "@/db/localDB";

export type OfflineDataStatus = {
  key: string;
  label: string;
  count: number;
  ready: boolean;
  detail: string;
};

type SyncStoreConfig = {
  key: string;
  label: string;
  cursorKey: string;
  count: () => Promise<number>;
};

const SYNC_STORE_CONFIGS: SyncStoreConfig[] = [
  { key: "customers", label: "Customers", cursorKey: "customers_sync_cursor", count: () => db.customers.count() },
  { key: "apartments", label: "Apartments", cursorKey: "apartments_sync_cursor", count: () => db.apartments.count() },
  {
    key: "apartment_sales",
    label: "Apartment Sales",
    cursorKey: "apartment_sales_sync_cursor",
    count: () => db.apartment_sales.count(),
  },
  {
    key: "installments",
    label: "Installments",
    cursorKey: "installments_sync_cursor",
    count: () => db.installments.count(),
  },
  { key: "roles", label: "Roles", cursorKey: "roles_sync_cursor", count: () => db.roles.count() },
  { key: "users", label: "Users", cursorKey: "user_sync_cursor", count: () => db.users.count() },
  { key: "rentals", label: "Rentals", cursorKey: "rentals_sync_cursor", count: () => db.rentals.count() },
];

function hasCursor(cursorKey: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(cursorKey));
}

export async function getOfflineDataStatuses(): Promise<OfflineDataStatus[]> {
  const counts = await Promise.all(SYNC_STORE_CONFIGS.map((item) => item.count().catch(() => 0)));

  return SYNC_STORE_CONFIGS.map((item, index) => {
    const count = counts[index];
    const syncedAtLeastOnce = hasCursor(item.cursorKey);

    if (count > 0) {
      return {
        key: item.key,
        label: item.label,
        count,
        ready: true,
        detail: syncedAtLeastOnce ? `${count} local records` : `${count} local records only`,
      };
    }

    if (syncedAtLeastOnce) {
      return {
        key: item.key,
        label: item.label,
        count,
        ready: true,
        detail: "Synced, no local records",
      };
    }

    return {
      key: item.key,
      label: item.label,
      count,
      ready: false,
      detail: "Not synced yet",
    };
  });
}
