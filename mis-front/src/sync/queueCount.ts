import { db } from "@/db/localDB";

export async function getQueueCount() {
  return db.sync_queue.count();
}
