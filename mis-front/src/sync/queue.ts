import { db } from "@/db/localDB";

export async function enqueueSync(op: {
  entity: string;
  uuid: string;
  action: "create" | "update" | "delete";
  payload: unknown;
}) {
  await db.sync_queue.add({
    idempotency_key: crypto.randomUUID(),
    entity: op.entity,
    uuid: op.uuid,
    action: op.action,
    payload: op.payload,
    created_at: Date.now(),
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sync:queue:changed"));
  }
}
