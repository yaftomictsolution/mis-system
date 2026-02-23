import { db } from "@/db/localDB";
import { api } from "@/lib/api";
import { setSyncing } from "./syncStatus";

let syncInProgress = false;

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

