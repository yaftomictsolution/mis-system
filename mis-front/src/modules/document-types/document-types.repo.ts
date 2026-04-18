"use client";

import { db, type DocumentTypeLocalRow } from "@/db/localDB";
import { api } from "@/lib/api";
import { emitAppEvent } from "@/lib/appEvents";
import type { DocumentModuleKey, DocumentTypeOption } from "@/modules/documents/documents.repo";

type Obj = Record<string, unknown>;
export type DocumentTypeModuleKey = DocumentModuleKey | "accounts" | "company_assets";

export type DocumentTypeRow = {
  id?: number;
  uuid: string;
  code: string;
  module: DocumentTypeModuleKey | string;
  label: string;
  is_active: boolean;
  can_delete?: boolean;
  delete_blocked_reason?: string | null;
  updated_at: number;
  created_at?: string | null;
};

export type DocumentTypeInput = {
  module: DocumentTypeModuleKey;
  label: string;
  is_active: boolean;
};

export type DocumentTypeListParams = {
  module?: DocumentTypeModuleKey | "";
  includeInactive?: boolean;
};

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;
const asObj = (value: unknown): Obj => (typeof value === "object" && value !== null ? (value as Obj) : {});

function parseTs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function sanitizeDocumentType(input: unknown): DocumentTypeRow {
  const row = asObj(input);
  return {
    id: Number(row.id ?? 0) > 0 ? Number(row.id) : undefined,
    uuid: String(row.uuid ?? ""),
    code: String(row.code ?? ""),
    module: String(row.module ?? ""),
    label: String(row.label ?? ""),
    is_active: Boolean(row.is_active),
    can_delete: typeof row.can_delete === "boolean" ? row.can_delete : undefined,
    delete_blocked_reason: row.delete_blocked_reason ? String(row.delete_blocked_reason) : null,
    updated_at: parseTs(row.updated_at),
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

function toLocalRow(row: DocumentTypeRow): DocumentTypeLocalRow {
  return {
    uuid: row.uuid,
    code: row.code,
    module: String(row.module),
    label: row.label,
    is_active: Boolean(row.is_active),
    can_delete: row.can_delete,
    delete_blocked_reason: row.delete_blocked_reason ?? null,
    updated_at: row.updated_at,
    created_at: row.created_at ?? null,
  };
}

function fromLocalRow(row: DocumentTypeLocalRow): DocumentTypeRow {
  return {
    uuid: row.uuid,
    code: row.code,
    module: row.module,
    label: row.label,
    is_active: Boolean(row.is_active),
    can_delete: row.can_delete,
    delete_blocked_reason: row.delete_blocked_reason ?? null,
    updated_at: row.updated_at,
    created_at: row.created_at ?? null,
  };
}

function sortRows(rows: DocumentTypeRow[]): DocumentTypeRow[] {
  return [...rows].sort((a, b) => {
    const moduleCompare = String(a.module).localeCompare(String(b.module));
    if (moduleCompare !== 0) return moduleCompare;
    return a.label.localeCompare(b.label);
  });
}

export async function documentTypesListLocal(params: DocumentTypeListParams = {}): Promise<DocumentTypeRow[]> {
  const moduleFilter = String(params.module ?? "").trim();
  const rows = await db.document_types.toArray();
  return sortRows(
    rows
      .map(fromLocalRow)
      .filter((row) => (moduleFilter ? String(row.module) === moduleFilter : true))
      .filter((row) => (params.includeInactive ? true : row.is_active))
  );
}

export async function documentTypeOptionsLocal(module: DocumentTypeModuleKey): Promise<DocumentTypeOption[]> {
  const rows = await documentTypesListLocal({ module, includeInactive: false });
  return rows.map((row) => ({ value: row.code, label: row.label }));
}

export async function documentTypesPullToLocal(): Promise<{ pulled: number }> {
  if (!isOnline()) return { pulled: 0 };

  const res = await api.get("/api/document-types", { params: { per_page: 300 } });
  const root = asObj(res.data);
  const items = Array.isArray(root.data) ? root.data.map(sanitizeDocumentType).filter((row) => row.uuid) : [];
  await db.document_types.clear();
  if (items.length) {
    await db.document_types.bulkPut(items.map(toLocalRow));
  }
  emitAppEvent("document-types:changed");
  return { pulled: items.length };
}

export async function documentTypeCreate(input: DocumentTypeInput): Promise<DocumentTypeRow> {
  if (!isOnline()) throw new Error("Document type management requires internet connection.");
  const res = await api.post("/api/document-types", input);
  const saved = sanitizeDocumentType(asObj(res.data).data);
  await db.document_types.put(toLocalRow(saved));
  emitAppEvent("document-types:changed");
  return saved;
}

export async function documentTypeUpdate(uuid: string, input: DocumentTypeInput): Promise<DocumentTypeRow> {
  if (!isOnline()) throw new Error("Document type management requires internet connection.");
  const res = await api.put(`/api/document-types/${uuid}`, input);
  const saved = sanitizeDocumentType(asObj(res.data).data);
  await db.document_types.put(toLocalRow(saved));
  emitAppEvent("document-types:changed");
  return saved;
}

export async function documentTypeDelete(uuid: string): Promise<void> {
  if (!isOnline()) throw new Error("Document type management requires internet connection.");
  await api.delete(`/api/document-types/${uuid}`);
  await db.document_types.delete(uuid);
  emitAppEvent("document-types:changed");
}
