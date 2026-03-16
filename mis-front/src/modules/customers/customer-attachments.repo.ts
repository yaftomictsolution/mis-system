import { db, type PendingAttachmentRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { createImageThumbFromBlob, isImageFile } from "@/lib/imageThumb";

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;

function emitQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sync:queue:changed"));
}

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function isNonRetryableAttachmentError(status?: number): boolean {
  return status === 400 || status === 404 || status === 409 || status === 410 || status === 422;
}

function toUploadFile(row: PendingAttachmentRow): File | Blob {
  if (typeof File !== "undefined") {
    return new File([row.file_blob], row.file_name || "attachment", { type: row.file_type || "application/octet-stream" });
  }
  return row.file_blob;
}

function firstCustomerImageUrlFromPayload(input: unknown): string | null {
  const root = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const documents = Array.isArray(root.documents) ? root.documents : [];
  const imageCandidates: Array<{ fileUrl: string; createdAt: number }> = [];

  for (const item of documents) {
    const row = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const documentType = String(row.document_type ?? "").trim().toLowerCase();
    const fileUrl = String(row.file_url ?? row.download_url ?? "").trim();
    const filePath = String(row.file_path ?? "").trim().toLowerCase();
    const createdAt = Date.parse(String(row.created_at ?? "")) || 0;

    if (documentType === "customer_image" && fileUrl) {
      imageCandidates.push({ fileUrl, createdAt });
      continue;
    }
    if (!documentType && (/\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(fileUrl) || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(filePath))) {
      imageCandidates.push({
        fileUrl: fileUrl || String(row.file_path ?? "").trim(),
        createdAt,
      });
    }
  }

  return imageCandidates.sort((a, b) => b.createdAt - a.createdAt)[0]?.fileUrl ?? null;
}

export async function customerAttachmentEnqueueLocal(customerUuid: string, file: File): Promise<void> {
  if (!customerUuid || !file) return;

  await db.pending_attachments.add({
    entity: "customers",
    entity_uuid: customerUuid,
    file_name: file.name,
    file_type: file.type || "application/octet-stream",
    file_size: file.size,
    file_blob: file,
    created_at: Date.now(),
  });
  emitQueueChanged();
}

export async function customerAttachmentDropByCustomerUuid(customerUuid: string): Promise<void> {
  if (!customerUuid) return;
  const rows = await db.pending_attachments.where("entity_uuid").equals(customerUuid).toArray();
  if (!rows.length) return;
  const ids = rows.map((row) => row.id).filter((id): id is number => id !== undefined);
  if (!ids.length) return;
  await db.pending_attachments.bulkDelete(ids);
  emitQueueChanged();
}

export async function customerAttachmentSyncPending(): Promise<{ synced: number }> {
  if (!isOnline()) return { synced: 0 };

  let synced = 0;
  const rows = await db.pending_attachments.orderBy("created_at").toArray();

  for (const row of rows) {
    if (row.id === undefined) continue;

    try {
      const form = new FormData();
      form.append("attachment", toUploadFile(row), row.file_name || "attachment");
      const res = await api.post(`/api/customers/${row.entity_uuid}/attachments`, form);
      const payload = (res.data as { data?: unknown } | undefined)?.data;
      const customerImageUrl = firstCustomerImageUrlFromPayload(payload);
      const customerImageThumb = isImageFile(row.file_blob) ? await createImageThumbFromBlob(row.file_blob) : null;

      if (customerImageUrl) {
        await db.customers.update(row.entity_uuid, {
          customer_image_url: customerImageUrl,
          ...(customerImageThumb ? { customer_image_thumb: customerImageThumb } : {}),
        });
      }

      await db.pending_attachments.delete(row.id);
      emitQueueChanged();
      synced += 1;
    } catch (error: unknown) {
      const status = getApiStatus(error);
      if (isNonRetryableAttachmentError(status)) {
        await db.pending_attachments.delete(row.id);
        emitQueueChanged();
        continue;
      }
      break;
    }
  }

  return { synced };
}
