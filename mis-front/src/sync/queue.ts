import { db } from "@/db/localDB";

export async function enqueueSync(op: {
  entity: string;
  uuid: string;
  localKey?: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  rollbackSnapshot?: unknown;
}) {
  const localKey = op.localKey ?? op.uuid;
  const existing = (await db.sync_queue.where("local_key").equals(localKey).toArray())
    .filter((item) => item.entity === op.entity)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  if (existing?.id !== undefined) {
    if (existing.action === "create" && op.action === "update") {
      await db.sync_queue.update(existing.id, {
        idempotency_key: crypto.randomUUID(),
        payload: op.payload,
      });
    } else if (existing.action === "create" && op.action === "delete") {
      await db.sync_queue.delete(existing.id);
    } else if (existing.action === "update" && op.action === "update") {
      await db.sync_queue.update(existing.id, {
        idempotency_key: crypto.randomUUID(),
        payload: op.payload,
      });
    } else if (existing.action === "update" && op.action === "delete") {
      await db.sync_queue.update(existing.id, {
        idempotency_key: crypto.randomUUID(),
        action: "delete",
        payload: op.payload,
      });
    } else if (existing.action === "delete" && op.action === "delete") {
      // Already queued as delete.
    } else {
      await db.sync_queue.add({
        idempotency_key: crypto.randomUUID(),
        entity: op.entity,
        uuid: op.uuid,
        local_key: localKey,
        action: op.action,
        payload: op.payload,
        rollback_snapshot: op.rollbackSnapshot ?? null,
        created_at: Date.now(),
      });
    }
  } else {
    await db.sync_queue.add({
      idempotency_key: crypto.randomUUID(),
      entity: op.entity,
      uuid: op.uuid,
      local_key: localKey,
      action: op.action,
      payload: op.payload,
      rollback_snapshot: op.rollbackSnapshot ?? null,
      created_at: Date.now(),
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sync:queue:changed"));
  }
}
