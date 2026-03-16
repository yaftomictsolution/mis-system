import { db } from "@/db/localDB";

export async function getQueueCount() {
  const syncQueueCountPromise = db.sync_queue.count();
  const attachmentQueueCountPromise = db.pending_attachments.count().catch(() => 0);

  const [syncQueueCount, attachmentQueueCount] = await Promise.all([
    syncQueueCountPromise,
    attachmentQueueCountPromise,
  ]);

  return syncQueueCount + attachmentQueueCount;
}
