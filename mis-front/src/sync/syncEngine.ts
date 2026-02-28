import { db } from "@/db/localDB";
import { api } from "@/lib/api";
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
        console.log("Synced", item.entity, item.uuid);
      } catch (error) {
        const status = getApiStatus(error);
        if (isNonRetryableSyncError(status)) {
          if (item.id !== undefined) {
            await db.sync_queue.delete(item.id);
          }
          console.warn("Dropped non-retryable sync item", item.entity, item.uuid, status);
          continue;
        }
        console.error("Sync failed", item, error);
        break;
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sync:complete", {
          detail: { syncedAny },
        }),
      );
    }
  } finally {
    setSyncing(false);
    syncInProgress = false;
  }
}

