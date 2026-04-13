"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  documentTypeCreate,
  documentTypeDelete,
  documentTypesListLocal,
  documentTypesPullToLocal,
  documentTypeUpdate,
  documentTypeOptionsLocal,
  type DocumentTypeInput,
  type DocumentTypeRow,
} from "@/modules/document-types/document-types.repo";
import {
  documentDelete,
  documentReferenceOptions,
  documentsList,
  documentUpload,
  DOCUMENT_MODULE_OPTIONS,
  type DocumentModuleKey,
  type DocumentReferenceOption,
  type DocumentTypeOption,
  type SystemDocumentRow,
} from "@/modules/documents/documents.repo";

type DocumentTypeFormState = {
  module: DocumentModuleKey;
  label: string;
  is_active: "true" | "false";
};

const DOC_TYPE_PAGE_SIZE = 8;

function shouldShowInDocumentsPage(row: SystemDocumentRow): boolean {
  return !(row.module === "customer" && row.document_type === "customer_image");
}

function createEmptyTypeForm(module: DocumentModuleKey = "customer"): DocumentTypeFormState {
  return {
    module,
    label: "",
    is_active: "true",
  };
}

function toTypeForm(row: DocumentTypeRow): DocumentTypeFormState {
  return {
    module: row.module as DocumentModuleKey,
    label: row.label,
    is_active: row.is_active ? "true" : "false",
  };
}

function formatDateFromTs(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleString();
}

export default function DocumentsPage() {
  const [moduleFilter, setModuleFilter] = useState<DocumentModuleKey | "">("");
  const [uploadModule, setUploadModule] = useState<DocumentModuleKey>("customer");
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [references, setReferences] = useState<DocumentReferenceOption[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<SystemDocumentRow[]>([]);
  const [previewRow, setPreviewRow] = useState<SystemDocumentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [saving, setSaving] = useState(false);

  const [documentTypeRows, setDocumentTypeRows] = useState<DocumentTypeRow[]>([]);
  const [documentTypeModuleFilter, setDocumentTypeModuleFilter] = useState<DocumentModuleKey | "">("");
  const [documentTypeLoading, setDocumentTypeLoading] = useState(true);
  const [documentTypeFormOpen, setDocumentTypeFormOpen] = useState(false);
  const [documentTypeFormError, setDocumentTypeFormError] = useState<string | null>(null);
  const [documentTypeSaving, setDocumentTypeSaving] = useState(false);
  const [editingDocumentType, setEditingDocumentType] = useState<DocumentTypeRow | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = useState<DocumentTypeRow | null>(null);
  const [documentTypeForm, setDocumentTypeForm] = useState<DocumentTypeFormState>(createEmptyTypeForm());

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const page = await documentsList({ module: moduleFilter, page: 1, perPage: 300 });
      setRows(page.items.filter(shouldShowInDocumentsPage));
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [moduleFilter]);

  const loadDocumentTypeRows = useCallback(async () => {
    const rows = await documentTypesListLocal({ module: documentTypeModuleFilter, includeInactive: true });
    setDocumentTypeRows(rows);
  }, [documentTypeModuleFilter]);

  const refreshDocumentTypes = useCallback(async (showLoader = true) => {
    if (showLoader) setDocumentTypeLoading(true);
    try {
      await loadDocumentTypeRows();
      try {
        await documentTypesPullToLocal();
      } catch {
        // Keep local types if remote pull fails.
      }
      await loadDocumentTypeRows();
    } finally {
      if (showLoader) setDocumentTypeLoading(false);
    }
  }, [loadDocumentTypeRows]);

  const loadReferenceOptions = useCallback(async (module: DocumentModuleKey) => {
    setLoadingReferences(true);
    try {
      const [referenceResult, localTypeOptions] = await Promise.all([
        documentReferenceOptions(module),
        documentTypeOptionsLocal(module),
      ]);

      const typeOptions = localTypeOptions.length > 0 ? localTypeOptions : referenceResult.documentTypes;
      const nextReferenceId = referenceResult.references[0] ? String(referenceResult.references[0].id) : "";
      const resolvedType = typeOptions.find((item) => item.value === selectedDocumentType)?.value ?? typeOptions[0]?.value ?? "";

      setReferences(referenceResult.references);
      setDocumentTypes(typeOptions);
      setSelectedReferenceId((current) => {
        if (referenceResult.references.some((item) => String(item.id) === current)) return current;
        return nextReferenceId;
      });
      setSelectedDocumentType(resolvedType);
    } catch (error: unknown) {
      setReferences([]);
      setDocumentTypes([]);
      setSelectedReferenceId("");
      setSelectedDocumentType("");
      notifyError(error instanceof Error ? error.message : "Failed to load record options.");
    } finally {
      setLoadingReferences(false);
    }
  }, [selectedDocumentType]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void refreshDocumentTypes();
  }, [refreshDocumentTypes]);

  useEffect(() => {
    void loadReferenceOptions(uploadModule);
  }, [loadReferenceOptions, uploadModule]);

  useEffect(() => {
    const onSyncComplete = () => {
      void loadDocuments();
      void refreshDocumentTypes(false);
      void loadReferenceOptions(uploadModule);
    };

    const unsubscribeDocuments = subscribeAppEvent("documents:changed", () => {
      void loadDocuments();
      void loadReferenceOptions(uploadModule);
    });
    const unsubscribeDocumentTypes = subscribeAppEvent("document-types:changed", () => {
      void refreshDocumentTypes(false);
      void loadReferenceOptions(uploadModule);
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeDocuments();
      unsubscribeDocumentTypes();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [loadDocuments, loadReferenceOptions, refreshDocumentTypes, uploadModule]);

  const handleUpload = useCallback(async () => {
    if (saving) return;

    const referenceId = Number(selectedReferenceId);
    if (!referenceId) {
      notifyError("Please select a record.");
      return;
    }
    if (!selectedDocumentType) {
      notifyError("Please select document type.");
      return;
    }
    if (selectedFiles.length === 0) {
      notifyError("Please choose one or more document files.");
      return;
    }

    setSaving(true);
    try {
      const typeLabel = documentTypes.find((item) => item.value === selectedDocumentType)?.label;
      const results = await Promise.allSettled(
        selectedFiles.map((file) =>
          documentUpload({
            module: uploadModule,
            documentType: selectedDocumentType,
            documentTypeLabel: typeLabel,
            referenceId,
            file,
          })
        )
      );

      const failedIndexes: number[] = [];
      let successCount = 0;
      let offlineCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount += 1;
          if (result.value.local_only) offlineCount += 1;
        } else {
          failedIndexes.push(index);
        }
      });

      if (successCount > 0) {
        notifySuccess(
          offlineCount === successCount
            ? `${successCount} document${successCount === 1 ? "" : "s"} saved offline. They will sync when online.`
            : `${successCount} document${successCount === 1 ? "" : "s"} uploaded successfully.`
        );
      }

      if (failedIndexes.length > 0) {
        setSelectedFiles(selectedFiles.filter((_, index) => failedIndexes.includes(index)));
        notifyError(`${failedIndexes.length} file${failedIndexes.length === 1 ? "" : "s"} failed. Please retry those uploads.`);
      } else {
        setSelectedFiles([]);
      }

      await Promise.all([loadDocuments(), loadReferenceOptions(uploadModule)]);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setSaving(false);
    }
  }, [
    documentTypes,
    loadDocuments,
    loadReferenceOptions,
    saving,
    selectedDocumentType,
    selectedFiles,
    selectedReferenceId,
    uploadModule,
  ]);

  const handleDelete = useCallback(async (row: SystemDocumentRow) => {
    if (!window.confirm(`Delete document ${row.file_name}?`)) return;

    try {
      await documentDelete(row.id);
      notifySuccess("Document deleted.");
      await loadDocuments();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to delete document.");
    }
  }, [loadDocuments]);

  const openCreateDocumentType = useCallback(() => {
    setEditingDocumentType(null);
    setDocumentTypeForm(createEmptyTypeForm(uploadModule));
    setDocumentTypeFormError(null);
    setDocumentTypeFormOpen(true);
  }, [uploadModule]);

  const openEditDocumentType = useCallback((row: DocumentTypeRow) => {
    setEditingDocumentType(row);
    setDocumentTypeForm(toTypeForm(row));
    setDocumentTypeFormError(null);
    setDocumentTypeFormOpen(true);
  }, []);

  const closeDocumentTypeForm = useCallback(() => {
    setEditingDocumentType(null);
    setDocumentTypeForm(createEmptyTypeForm(uploadModule));
    setDocumentTypeFormError(null);
    setDocumentTypeFormOpen(false);
  }, [uploadModule]);

  const handleDocumentTypeSubmit = useCallback(async () => {
    if (documentTypeSaving) return;
    const trimmedLabel = documentTypeForm.label.trim();
    if (trimmedLabel === "") {
      setDocumentTypeFormError("Document type name is required.");
      return;
    }

    setDocumentTypeSaving(true);
    setDocumentTypeFormError(null);
    try {
      const payload: DocumentTypeInput = {
        module: documentTypeForm.module,
        label: trimmedLabel,
        is_active: documentTypeForm.is_active === "true",
      };

      if (editingDocumentType?.uuid) {
        await documentTypeUpdate(editingDocumentType.uuid, payload);
        notifySuccess("Document type updated.");
      } else {
        await documentTypeCreate(payload);
        notifySuccess("Document type created.");
      }

      closeDocumentTypeForm();
      await Promise.all([refreshDocumentTypes(false), loadReferenceOptions(uploadModule)]);
    } catch (error: unknown) {
      setDocumentTypeFormError(error instanceof Error ? error.message : "Unable to save document type.");
    } finally {
      setDocumentTypeSaving(false);
    }
  }, [
    closeDocumentTypeForm,
    documentTypeForm,
    documentTypeSaving,
    editingDocumentType?.uuid,
    loadReferenceOptions,
    refreshDocumentTypes,
    uploadModule,
  ]);

  const confirmDeleteDocumentType = useCallback(async () => {
    if (!pendingDeleteType?.uuid) return;
    try {
      await documentTypeDelete(pendingDeleteType.uuid);
      notifySuccess("Document type deleted.");
      setPendingDeleteType(null);
      await Promise.all([refreshDocumentTypes(false), loadReferenceOptions(uploadModule)]);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Unable to delete document type.");
    }
  }, [loadReferenceOptions, pendingDeleteType, refreshDocumentTypes, uploadModule]);

  const documentTypeColumns = useMemo<Column<DocumentTypeRow>[]>(
    () => [
      {
        key: "label",
        label: "Document Type",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white">{item.label}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{item.code}</div>
          </div>
        ),
      },
      {
        key: "module",
        label: "Module",
        render: (item) => (
          <span>
            {DOCUMENT_MODULE_OPTIONS.find((option) => option.value === item.module)?.label ??
              String(item.module).replaceAll("_", " ")}
          </span>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        render: (item) => <Badge color={item.is_active ? "emerald" : "slate"}>{item.is_active ? "Active" : "Inactive"}</Badge>,
      },
      {
        key: "updated_at",
        label: "Updated",
        render: (item) => <span>{formatDateFromTs(item.updated_at)}</span>,
      },
    ],
    []
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      <PageHeader title="Documents" subtitle="Upload module files, preview them, and manage the document types your team can use." />

      <DocumentUploadForm
        module={uploadModule}
        moduleOptions={DOCUMENT_MODULE_OPTIONS}
        documentTypes={documentTypes}
        selectedDocumentType={selectedDocumentType}
        references={references}
        selectedReferenceId={selectedReferenceId}
        files={selectedFiles}
        loadingReferences={loadingReferences}
        saving={saving}
        onModuleChange={(module) => {
          setUploadModule(module);
          setSelectedFiles([]);
        }}
        onDocumentTypeChange={setSelectedDocumentType}
        onReferenceChange={setSelectedReferenceId}
        onFilesChange={setSelectedFiles}
        onRemoveFile={(index) => setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
        onClearFiles={() => setSelectedFiles([])}
        onSubmit={handleUpload}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Document Types</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create the document type list your team will use during uploads. Delete is available only when a type has no documents linked to it.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="block md:w-[240px]">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Filter Module</span>
              <select
                value={documentTypeModuleFilter}
                onChange={(event) => setDocumentTypeModuleFilter(event.target.value as DocumentModuleKey | "")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
              >
                <option value="">All Modules</option>
                {DOCUMENT_MODULE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={openCreateDocumentType}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Create Document Type
            </button>
          </div>
        </div>

        <DataTable
          columns={documentTypeColumns}
          data={documentTypeRows}
          loading={documentTypeLoading}
          onEdit={openEditDocumentType}
          onDelete={setPendingDeleteType}
          canDelete={(row) => row.can_delete !== false}
          searchKeys={["label", "code", "module"]}
          pageSize={DOC_TYPE_PAGE_SIZE}
          compact
          mobileStack
          noHorizontalScroll
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Documents</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Existing customer attachments, contracts, receipts, and deed files appear here.
            </p>
          </div>

          <label className="block md:w-[260px]">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Filter Module</span>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value as DocumentModuleKey | "")}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
            >
              <option value="">All Modules</option>
              {DOCUMENT_MODULE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DocumentsTable rows={rows} loading={loading} onPreview={setPreviewRow} onDelete={handleDelete} />
      </div>

      <Modal
        isOpen={documentTypeFormOpen}
        onClose={closeDocumentTypeForm}
        title={editingDocumentType ? "Edit Document Type" : "Create Document Type"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Module"
              type="select"
              value={documentTypeForm.module}
              onChange={(value) => setDocumentTypeForm((prev) => ({ ...prev, module: value as DocumentModuleKey }))}
              options={DOCUMENT_MODULE_OPTIONS}
              required
              disabled={Boolean(editingDocumentType)}
            />
            <FormField
              label="Status"
              type="select"
              value={documentTypeForm.is_active}
              onChange={(value) =>
                setDocumentTypeForm((prev) => ({ ...prev, is_active: value as DocumentTypeFormState["is_active"] }))
              }
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
              required
            />
          </div>
          <FormField
            label="Document Type Name"
            value={documentTypeForm.label}
            onChange={(value) => setDocumentTypeForm((prev) => ({ ...prev, label: String(value) }))}
            placeholder="Example: Customer Passport Copy"
            required
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
            The system generates the internal document code automatically from the name and keeps that code stable even if you later rename the type.
          </div>
          {documentTypeFormError && <p className="text-sm text-red-600">{documentTypeFormError}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeDocumentTypeForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={documentTypeSaving}
              onClick={() => {
                void handleDocumentTypeSubmit();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {documentTypeSaving ? "Saving..." : editingDocumentType ? "Update Document Type" : "Create Document Type"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteType)}
        onClose={() => setPendingDeleteType(null)}
        onConfirm={() => {
          void confirmDeleteDocumentType();
        }}
        title="Delete Document Type"
        message={
          pendingDeleteType?.delete_blocked_reason
            ? pendingDeleteType.delete_blocked_reason
            : `Delete ${pendingDeleteType?.label ?? "this document type"}?`
        }
      />

      <DocumentPreviewModal row={previewRow} onClose={() => setPreviewRow(null)} />
    </div>
  );
}
