"use client";

import { db, type PendingModuleOpRow } from "@/db/localDB";

type PendingModuleName = PendingModuleOpRow["module"];

export async function enqueuePendingModuleOp(
  input: Omit<PendingModuleOpRow, "id" | "created_at"> & { created_at?: number }
): Promise<number> {
  return db.pending_module_ops.add({
    ...input,
    created_at: input.created_at ?? Date.now(),
  });
}

export async function listPendingModuleOps(module: PendingModuleName): Promise<PendingModuleOpRow[]> {
  return db.pending_module_ops.where("module").equals(module).sortBy("created_at");
}

export async function deletePendingModuleOp(id?: number): Promise<void> {
  if (id === undefined) return;
  await db.pending_module_ops.delete(id);
}

export async function deletePendingModuleOpsForTarget(
  module: PendingModuleName,
  action: string,
  targetId: string
): Promise<void> {
  const items = await db.pending_module_ops.where("module").equals(module).toArray();
  const ids = items
    .filter((item) => item.action === action && item.target_id === targetId)
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined);

  if (ids.length > 0) {
    await db.pending_module_ops.bulkDelete(ids);
  }
}

export async function deletePendingModuleOpsByModule(module: PendingModuleName): Promise<void> {
  const items = await db.pending_module_ops.where("module").equals(module).toArray();
  const ids = items.map((item) => item.id).filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await db.pending_module_ops.bulkDelete(ids);
  }
}
