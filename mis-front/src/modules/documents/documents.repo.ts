"use client";

import {
  db,
  type ApartmentRentalRow,
  type ApartmentRow,
  type CustomerRow,
  type PendingModuleOpRow,
  type SystemDocumentLocalRow,
} from "@/db/localDB";
import { emitAppEvent } from "@/lib/appEvents";
import { api } from "@/lib/api";
import {
  deletePendingModuleOp,
  deletePendingModuleOpsForTarget,
  enqueuePendingModuleOp,
  listPendingModuleOps,
} from "@/modules/offline-ops/offline-ops.repo";

export type DocumentModuleKey = "customer" | "apartment" | "apartment_sale" | "rental";

export type SystemDocumentRow = {
  id: number;
  module: DocumentModuleKey | string;
  module_label: string;
  document_type: string;
  document_type_label: string;
  reference_id: number;
  reference_label: string;
  file_name: string;
  file_path: string;
  file_url: string;
  download_url: string;
  expiry_date?: string | null;
  created_at?: string | null;
  local_only?: boolean;
  local_blob?: Blob | null;
};

export type SystemDocumentPage = {
  items: SystemDocumentRow[];
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
};

export type DocumentReferenceOption = {
  id: number;
  label: string;
};

export type DocumentTypeOption = {
  value: string;
  label: string;
};

export type DocumentPreviewKind = "image" | "pdf" | "none";

type DocumentSyncResult = {
  synced: number;
  retryableFailure: boolean;
};

type Obj = Record<string, unknown>;

const MAX_REMOTE_PAGE_SIZE = 100;

const MODULE_LABELS: Record<DocumentModuleKey, string> = {
  customer: "Customer",
  apartment: "Apartment",
  apartment_sale: "Apartment Sale / Deed",
  rental: "Rental",
};

const DOCUMENT_TYPES: Record<DocumentModuleKey, DocumentTypeOption[]> = {
  customer: [
    { value: "customer_deed_document", label: "Customer Deed Document" },
    { value: "customer_attachment", label: "Customer Attachment" },
  ],
  apartment: [
    { value: "apartment_image", label: "Apartment Image" },
    { value: "apartment_document", label: "Apartment Document" },
  ],
  apartment_sale: [
    { value: "deed_document", label: "Deed Document" },
    { value: "sale_contract", label: "Sale Contract" },
    { value: "sale_receipt", label: "Sale Receipt" },
  ],
  rental: [
    { value: "rental_contract", label: "Rental Contract" },
    { value: "rental_receipt", label: "Rental Receipt" },
    { value: "tenant_document", label: "Tenant Document" },
  ],
};

export const DOCUMENT_MODULE_OPTIONS: Array<{ value: DocumentModuleKey; label: string }> = [
  { value: "customer", label: "Customer" },
  { value: "apartment", label: "Apartment" },
  { value: "apartment_sale", label: "Apartment Sale / Deed" },
  { value: "rental", label: "Rental" },
];

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});
const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();

function fileExtension(value: string): string {
  const clean = value.split("?")[0] ?? "";
  return clean.split(".").pop()?.toLowerCase() ?? "";
}

function getApiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function isRetryable(error: unknown): boolean {
  const status = getApiStatus(error);
  return status === undefined || status >= 500;
}

function isOfflineError(error: unknown): boolean {
  return !isOnline() || getApiStatus(error) === undefined;
}

function normalizeDocumentRow(input: unknown): SystemDocumentRow {
  const row = asObj(input);

  return {
    id: Number(row.id ?? 0),
    module: String(row.module ?? ""),
    module_label: String(row.module_label ?? ""),
    document_type: String(row.document_type ?? ""),
    document_type_label: String(row.document_type_label ?? ""),
    reference_id: Number(row.reference_id ?? 0),
    reference_label: String(row.reference_label ?? ""),
    file_name: String(row.file_name ?? ""),
    file_path: String(row.file_path ?? ""),
    file_url: String(row.file_url ?? ""),
    download_url: String(row.download_url ?? row.file_url ?? ""),
    expiry_date: row.expiry_date ? String(row.expiry_date) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    local_only: Boolean(row.local_only),
    local_blob: row.local_blob instanceof Blob ? row.local_blob : null,
  };
}

function toLocalRow(row: SystemDocumentRow): SystemDocumentLocalRow {
  return {
    ...row,
    updated_at: nowMs(),
    local_only: Boolean(row.local_only),
    local_blob: row.local_blob ?? null,
  };
}

function fromLocalRow(row: SystemDocumentLocalRow): SystemDocumentRow {
  return {
    id: row.id,
    module: row.module,
    module_label: row.module_label,
    document_type: row.document_type,
    document_type_label: row.document_type_label,
    reference_id: row.reference_id,
    reference_label: row.reference_label,
    file_name: row.file_name,
    file_path: row.file_path,
    file_url: row.file_url,
    download_url: row.download_url,
    expiry_date: row.expiry_date ?? null,
    created_at: row.created_at ?? null,
    local_only: Boolean(row.local_only),
    local_blob: row.local_blob ?? null,
  };
}

function compareDocumentCreatedAt(a: SystemDocumentLocalRow, b: SystemDocumentLocalRow): number {
  return Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
}

function localDocumentPage(rows: SystemDocumentLocalRow[], page: number, perPage: number): SystemDocumentPage {
  const sorted = [...rows].sort(compareDocumentCreatedAt);
  const offset = (page - 1) * perPage;
  const items = sorted.slice(offset, offset + perPage).map(fromLocalRow);
  return {
    items,
    page,
    perPage,
    total: sorted.length,
    hasMore: offset + items.length < sorted.length,
  };
}

async function buildCustomerReferenceOptions(): Promise<DocumentReferenceOption[]> {
  const rows = await db.customers.orderBy("name").limit(200).toArray();
  return rows
    .filter((row) => Number(row.id) > 0)
    .map((row) => ({
      id: Number(row.id),
      label: `${row.name} (${row.phone || "-"})`,
    }));
}

async function buildApartmentReferenceOptions(): Promise<DocumentReferenceOption[]> {
  const rows = await db.apartments.orderBy("apartment_code").limit(200).toArray();
  return rows
    .filter((row) => Number(row.id) > 0)
    .map((row) => ({
      id: Number(row.id),
      label: `${row.apartment_code} - Unit ${row.unit_number || ""}`.trim(),
    }));
}

function customerLabel(row: CustomerRow | undefined): string {
  if (!row) return "Customer";
  return `${row.name} (${row.phone || "-"})`;
}

function apartmentLabel(row: ApartmentRow | undefined): string {
  if (!row) return "Apartment";
  return `${row.apartment_code} - Unit ${row.unit_number || ""}`.trim();
}

function rentalLabel(row: ApartmentRentalRow, tenant?: CustomerRow, apartment?: ApartmentRow): string {
  return `${row.rental_id || `Rental #${row.id ?? ""}`} - ${customerLabel(tenant)} - ${apartmentLabel(apartment)}`;
}

async function buildApartmentSaleReferenceOptions(): Promise<DocumentReferenceOption[]> {
  const [sales, customers, apartments] = await Promise.all([
    db.apartment_sales.orderBy("updated_at").reverse().limit(200).toArray(),
    db.customers.toArray(),
    db.apartments.toArray(),
  ]);

  const customerById = new Map(customers.map((row) => [Number(row.id), row]));
  const apartmentById = new Map(apartments.map((row) => [Number(row.id), row]));

  return sales
    .filter((row) => Number(row.id) > 0)
    .map((row) => ({
      id: Number(row.id),
      label: `${row.sale_id || `Sale #${row.id ?? ""}`} - ${customerLabel(customerById.get(row.customer_id))} - ${apartmentLabel(
        apartmentById.get(row.apartment_id)
      )}`,
    }));
}

async function buildRentalReferenceOptions(): Promise<DocumentReferenceOption[]> {
  const [rentals, customers, apartments] = await Promise.all([
    db.rentals.orderBy("updated_at").reverse().limit(200).toArray(),
    db.customers.toArray(),
    db.apartments.toArray(),
  ]);

  const customerById = new Map(customers.map((row) => [Number(row.id), row]));
  const apartmentById = new Map(apartments.map((row) => [Number(row.id), row]));

  return rentals
    .filter((row) => Number(row.id) > 0)
    .map((row) => ({
      id: Number(row.id),
      label: rentalLabel(row, customerById.get(row.tenant_id), apartmentById.get(row.apartment_id)),
    }));
}

async function buildLocalReferenceOptions(module: DocumentModuleKey): Promise<DocumentReferenceOption[]> {
  switch (module) {
    case "customer":
      return buildCustomerReferenceOptions();
    case "apartment":
      return buildApartmentReferenceOptions();
    case "apartment_sale":
      return buildApartmentSaleReferenceOptions();
    case "rental":
      return buildRentalReferenceOptions();
    default:
      return [];
  }
}

async function buildReferenceLabel(module: DocumentModuleKey, referenceId: number): Promise<string> {
  const options = await buildLocalReferenceOptions(module);
  return options.find((item) => item.id === referenceId)?.label ?? `Record #${referenceId}`;
}

async function documentReferenceOptionsRemote(module: DocumentModuleKey): Promise<{
  references: DocumentReferenceOption[];
  documentTypes: DocumentTypeOption[];
}> {
  const res = await api.get("/api/documents/reference-options", { params: { module } });
  const root = asObj(res.data);
  const data = Array.isArray(root.data) ? root.data : [];
  const documentTypes = Array.isArray(root.document_types) ? root.document_types : [];

  return {
    references: data
      .map((item) => {
        const row = asObj(item);
        return { id: Number(row.id ?? 0), label: String(row.label ?? "") };
      })
      .filter((item) => item.id > 0 && item.label),
    documentTypes: documentTypes
      .map((item) => {
        const row = asObj(item);
        return { value: String(row.value ?? ""), label: String(row.label ?? "") };
      })
      .filter((item) => item.value && item.label),
  };
}

async function documentsListLocal(params: {
  module?: DocumentModuleKey | "";
  page?: number;
  perPage?: number;
} = {}): Promise<SystemDocumentPage> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.max(1, params.perPage ?? 20);
  const rows = await db.system_documents.toArray();
  const filtered = params.module ? rows.filter((row) => row.module === params.module) : rows;
  return localDocumentPage(filtered, page, perPage);
}

async function documentsListRemote(params: {
  module?: DocumentModuleKey | "";
  page?: number;
  perPage?: number;
} = {}): Promise<SystemDocumentPage> {
  const requested = Math.max(1, params.perPage ?? 20);
  const perRequest = Math.min(requested, MAX_REMOTE_PAGE_SIZE);
  let page = Math.max(1, params.page ?? 1);
  let hasMore = true;
  const rows: SystemDocumentRow[] = [];
  let remoteTotal = 0;

  while (hasMore && rows.length < requested) {
    const res = await api.get("/api/documents", {
      params: {
        module: params.module || undefined,
        page,
        per_page: perRequest,
      },
    });

    const root = asObj(res.data);
    const meta = asObj(root.meta);
    const data = Array.isArray(root.data) ? root.data.map(normalizeDocumentRow) : [];
    rows.push(...data);
    remoteTotal = Number(meta.total ?? rows.length);
    hasMore = Boolean(meta.has_more);
    page += 1;

    if (data.length === 0) {
      break;
    }
  }

  const freshRows = rows.slice(0, requested);
  if (freshRows.length > 0) {
    await db.system_documents.bulkPut(freshRows.map(toLocalRow));
  }

  return {
    items: freshRows,
    page: Math.max(1, params.page ?? 1),
    perPage: requested,
    total: remoteTotal || freshRows.length,
    hasMore,
  };
}

function nextTempDocumentId(): number {
  return -Math.trunc(Date.now() + Math.random() * 1000);
}

async function uploadDocumentRemote(input: {
  module: DocumentModuleKey;
  documentType: string;
  referenceId: number;
  file: Blob;
  fileName: string;
}): Promise<SystemDocumentRow> {
  const form = new FormData();
  form.append("module", input.module);
  form.append("document_type", input.documentType);
  form.append("reference_id", String(input.referenceId));
  form.append("document", input.file, input.fileName);

  const res = await api.post("/api/documents", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return normalizeDocumentRow(asObj(res.data).data);
}

async function syncDocumentCreateOp(op: PendingModuleOpRow): Promise<"synced" | "retry" | "dropped"> {
  const payload = asObj(op.payload);
  const tempId = Number(payload.temp_id ?? 0);
  const moduleKey = String(payload.module ?? "") as DocumentModuleKey;
  const documentType = String(payload.document_type ?? "");
  const referenceId = Number(payload.reference_id ?? 0);
  const fileBlob = payload.file_blob instanceof Blob ? payload.file_blob : null;
  const fileName = String(payload.file_name ?? "document");

  if (!tempId || !moduleKey || !documentType || !referenceId || !fileBlob) {
    await db.system_documents.delete(tempId);
    await deletePendingModuleOp(op.id);
    return "dropped";
  }

  try {
    const saved = await uploadDocumentRemote({
      module: moduleKey,
      documentType,
      referenceId,
      file: fileBlob,
      fileName,
    });

    await db.transaction("rw", db.system_documents, db.pending_module_ops, async () => {
      await db.system_documents.delete(tempId);
      await db.system_documents.put(toLocalRow(saved));
      await deletePendingModuleOp(op.id);
    });
    return "synced";
  } catch (error: unknown) {
    if (isRetryable(error)) {
      return "retry";
    }
    await db.system_documents.delete(tempId);
    await deletePendingModuleOp(op.id);
    return "dropped";
  }
}

async function syncDocumentDeleteOp(op: PendingModuleOpRow): Promise<"synced" | "retry" | "dropped"> {
  const payload = asObj(op.payload);
  const id = Number(payload.id ?? 0);
  if (!id) {
    await deletePendingModuleOp(op.id);
    return "dropped";
  }

  try {
    await api.delete(`/api/documents/${id}`);
    await deletePendingModuleOp(op.id);
    return "synced";
  } catch (error: unknown) {
    const status = getApiStatus(error);
    if (status === 404) {
      await deletePendingModuleOp(op.id);
      return "dropped";
    }
    return isRetryable(error) ? "retry" : "dropped";
  }
}

export async function documentsList(params: {
  module?: DocumentModuleKey | "";
  page?: number;
  perPage?: number;
} = {}): Promise<SystemDocumentPage> {
  if (isOnline()) {
    try {
      await documentsListRemote(params);
    } catch (error: unknown) {
      const local = await documentsListLocal(params);
      if (local.items.length > 0 || isOfflineError(error)) {
        return local;
      }
      throw error;
    }
  }

  return documentsListLocal(params);
}

export async function documentReferenceOptions(module: DocumentModuleKey): Promise<{
  references: DocumentReferenceOption[];
  documentTypes: DocumentTypeOption[];
}> {
  const localReferences = await buildLocalReferenceOptions(module);
  if (localReferences.length > 0 || !isOnline()) {
    return {
      references: localReferences,
      documentTypes: DOCUMENT_TYPES[module] ?? [],
    };
  }

  try {
    const remote = await documentReferenceOptionsRemote(module);
    return {
      references: remote.references,
      documentTypes: DOCUMENT_TYPES[module] ?? remote.documentTypes,
    };
  } catch {
    return {
      references: [],
      documentTypes: DOCUMENT_TYPES[module] ?? [],
    };
  }
}

export async function documentUpload(input: {
  module: DocumentModuleKey;
  documentType: string;
  referenceId: number;
  file: File;
}): Promise<SystemDocumentRow> {
  if (isOnline()) {
    try {
      const saved = await uploadDocumentRemote({
        module: input.module,
        documentType: input.documentType,
        referenceId: input.referenceId,
        file: input.file,
        fileName: input.file.name,
      });
      await db.system_documents.put(toLocalRow(saved));
      emitAppEvent("documents:changed");
      return saved;
    } catch (error: unknown) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  const tempId = nextTempDocumentId();
  const tempRow: SystemDocumentRow = {
    id: tempId,
    module: input.module,
    module_label: MODULE_LABELS[input.module] ?? input.module,
    document_type: input.documentType,
    document_type_label:
      DOCUMENT_TYPES[input.module]?.find((item) => item.value === input.documentType)?.label ?? input.documentType,
    reference_id: input.referenceId,
    reference_label: await buildReferenceLabel(input.module, input.referenceId),
    file_name: input.file.name,
    file_path: "",
    file_url: "",
    download_url: "",
    expiry_date: null,
    created_at: nowIso(),
    local_only: true,
    local_blob: input.file,
  };

  await db.transaction("rw", db.system_documents, db.pending_module_ops, async () => {
    await db.system_documents.put(toLocalRow(tempRow));
    await enqueuePendingModuleOp({
      module: "documents",
      action: "create",
      target_id: String(tempId),
      payload: {
        temp_id: tempId,
        module: input.module,
        document_type: input.documentType,
        reference_id: input.referenceId,
        file_name: input.file.name,
        file_blob: input.file,
      },
    });
  });

  emitAppEvent("documents:changed");
  return tempRow;
}

export async function documentDelete(id: number): Promise<void> {
  const existing = await db.system_documents.get(id);
  if (!existing) return;

  await db.system_documents.delete(id);

  if (existing.local_only || id < 0) {
    await deletePendingModuleOpsForTarget("documents", "create", String(id));
    emitAppEvent("documents:changed");
    return;
  }

  if (isOnline()) {
    try {
      await api.delete(`/api/documents/${id}`);
      emitAppEvent("documents:changed");
      return;
    } catch (error: unknown) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  }

  await enqueuePendingModuleOp({
    module: "documents",
    action: "delete",
    target_id: String(id),
    payload: { id },
  });
  emitAppEvent("documents:changed");
}

export async function syncPendingDocumentOps(): Promise<DocumentSyncResult> {
  if (!isOnline()) {
    return { synced: 0, retryableFailure: false };
  }

  const ops = await listPendingModuleOps("documents");
  let synced = 0;

  for (const op of ops) {
    const result = op.action === "create" ? await syncDocumentCreateOp(op) : await syncDocumentDeleteOp(op);
    if (result === "synced") {
      synced += 1;
      continue;
    }
    if (result === "retry") {
      return { synced, retryableFailure: true };
    }
  }

  if (synced > 0) {
    emitAppEvent("documents:changed");
  }

  return { synced, retryableFailure: false };
}

export function getDocumentPreviewKind(row: Pick<SystemDocumentRow, "file_name" | "file_url" | "file_path">): DocumentPreviewKind {
  const extension = fileExtension(row.file_name || row.file_url || row.file_path);

  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(extension)) {
    return "image";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  return "none";
}
