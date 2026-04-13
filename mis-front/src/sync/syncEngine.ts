import { db } from "@/db/localDB";
import { api } from "@/lib/api";
import {
  customerAttachmentDropByCustomerUuid,
  customerAttachmentSyncPending,
} from "@/modules/customers/customer-attachments.repo";
import { customersPullToLocal } from "@/modules/customers/customers.repo";
import { apartmentSalePullToLocal } from "@/modules/apartment-sales/apartment-sales.repo";
import { syncPendingCrmOps } from "@/modules/crm/crm.repo";
import { syncPendingDocumentOps } from "@/modules/documents/documents.repo";
import { syncPendingNotificationOps } from "@/modules/notifications/notifications.repo";
import { setSyncing } from "./syncStatus";

let syncInProgress = false;
const isNonRetryableSyncError = (status?: number) => status === 409 || status === 422;
const getApiStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } }).response?.status;

export async function runSyncOnce() {
  if (syncInProgress) {
    return;
  }

  if (!navigator.onLine) {
    console.log("Offline -> skipping sync");
    return;
  }

  syncInProgress = true;
  setSyncing(true);

  try {
    let syncedAny = false;
    let hasRetryableFailure = false;
    const syncedEntities = new Set<string>();
    let customerPullCount = 0;
    let apartmentSalePullCount = 0;
    const items = await db.sync_queue.orderBy("created_at").toArray();

    for (const item of items) {
      try {
        await api.post("/api/sync/push", item, {
          headers: { "Idempotency-Key": item.idempotency_key },
        });

        if (item.id !== undefined) {
          await db.sync_queue.delete(item.id);
        }
        syncedAny = true;
        syncedEntities.add(item.entity);
        console.log("Synced", item.entity, item.uuid);
      } catch (error) {
        const status = getApiStatus(error);
        if (isNonRetryableSyncError(status)) {
          if (item.id !== undefined) {
            await db.sync_queue.delete(item.id);
          }
          if (item.entity === "customers") {
            await customerAttachmentDropByCustomerUuid(item.uuid);
          }
          console.warn("Dropped non-retryable sync item", item.entity, item.uuid, status);
          continue;
        }
        console.error("Sync failed", item, error);
        hasRetryableFailure = true;
        break;
      }
    }

    if (!hasRetryableFailure) {
      const attachmentResult = await customerAttachmentSyncPending();
      if (attachmentResult.synced > 0) {
        syncedAny = true;
      }
    }

    if (!hasRetryableFailure) {
      try {
        const [customersResult, apartmentSalesResult] = await Promise.all([customersPullToLocal(), apartmentSalePullToLocal()]);
        customerPullCount = Number(customersResult?.pulled ?? 0);
        apartmentSalePullCount = Number(apartmentSalesResult?.pulled ?? 0);
        if (customerPullCount > 0) {
          syncedAny = true;
          syncedEntities.add("customers");
        }
        if (apartmentSalePullCount > 0) {
          syncedAny = true;
          syncedEntities.add("apartment_sales");
        }
      } catch (error) {
        console.warn("Entity pull before module-op sync failed", error);
      }
    }

    if (!hasRetryableFailure) {
      for (const syncModule of [syncPendingDocumentOps, syncPendingCrmOps, syncPendingNotificationOps]) {
        const result = await syncModule();
        if (result.synced > 0) {
          syncedAny = true;
        }
        if (result.retryableFailure) {
          hasRetryableFailure = true;
          break;
        }
      }
    }

    if (typeof window !== "undefined" && syncedAny) {
      window.dispatchEvent(
        new CustomEvent("sync:complete", {
          detail: {
            syncedAny,
            entities: [...syncedEntities],
            changed: syncedAny,
            pulls: {
              customers: customerPullCount,
              apartment_sales: apartmentSalePullCount,
            },
          },
        }),
      );
    }
  } finally {
    setSyncing(false);
    syncInProgress = false;
  }
}

