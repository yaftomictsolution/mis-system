"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError, notifySuccess } from "@/lib/notify";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import {
  documentDelete,
  documentReferenceOptions,
  documentsList,
  documentUpload,
  DOCUMENT_MODULE_OPTIONS,
  type DocumentTypeOption,
  type DocumentModuleKey,
  type DocumentReferenceOption,
  type SystemDocumentRow,
} from "@/modules/documents/documents.repo";

function shouldShowInDocumentsPage(row: SystemDocumentRow): boolean {
  return !(row.module === "customer" && row.document_type === "customer_image");
}

export default function DocumentsPage() {
  const [moduleFilter, setModuleFilter] = useState<DocumentModuleKey | "">("");
  const [uploadModule, setUploadModule] = useState<DocumentModuleKey>("customer");
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [references, setReferences] = useState<DocumentReferenceOption[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rows, setRows] = useState<SystemDocumentRow[]>([]);
  const [previewRow, setPreviewRow] = useState<SystemDocumentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const loadReferenceOptions = useCallback(async (module: DocumentModuleKey) => {
    setLoadingReferences(true);
    try {
      const result = await documentReferenceOptions(module);
      setReferences(result.references);
      setDocumentTypes(result.documentTypes);
      setSelectedReferenceId(result.references[0] ? String(result.references[0].id) : "");
      setSelectedDocumentType(result.documentTypes[0]?.value ?? "");
    } catch (error: unknown) {
      setReferences([]);
      setDocumentTypes([]);
      setSelectedReferenceId("");
      setSelectedDocumentType("");
      notifyError(error instanceof Error ? error.message : "Failed to load record options.");
    } finally {
      setLoadingReferences(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void loadReferenceOptions(uploadModule);
  }, [loadReferenceOptions, uploadModule]);

  useEffect(() => {
    const onSyncComplete = () => {
      void loadDocuments();
      void loadReferenceOptions(uploadModule);
    };
    const unsubscribeDocuments = subscribeAppEvent("documents:changed", () => {
      void loadDocuments();
      void loadReferenceOptions(uploadModule);
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeDocuments();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [loadDocuments, loadReferenceOptions, uploadModule]);

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
    if (!selectedFile) {
      notifyError("Please choose a document file.");
      return;
    }

    setSaving(true);
    try {
      const saved = await documentUpload({
        module: uploadModule,
        documentType: selectedDocumentType,
        referenceId,
        file: selectedFile,
      });
      notifySuccess(saved.local_only ? "Document saved offline. It will sync when online." : "Document uploaded successfully.");
      setSelectedFile(null);
      await Promise.all([loadDocuments(), loadReferenceOptions(uploadModule)]);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setSaving(false);
    }
  }, [loadDocuments, loadReferenceOptions, saving, selectedDocumentType, selectedFile, selectedReferenceId, uploadModule]);

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

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      <PageHeader title="Documents" subtitle="Manage customer images, deed files, and other module documents." />

      <DocumentUploadForm
        module={uploadModule}
        moduleOptions={DOCUMENT_MODULE_OPTIONS}
        documentTypes={documentTypes}
        selectedDocumentType={selectedDocumentType}
        references={references}
        selectedReferenceId={selectedReferenceId}
        file={selectedFile}
        loadingReferences={loadingReferences}
        saving={saving}
        onModuleChange={setUploadModule}
        onDocumentTypeChange={setSelectedDocumentType}
        onReferenceChange={setSelectedReferenceId}
        onFileChange={setSelectedFile}
        onSubmit={handleUpload}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Documents</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Existing customer attachments and uploaded deed documents appear here.
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

        <DocumentsTable
          rows={rows}
          loading={loading}
          onPreview={setPreviewRow}
          onDelete={handleDelete}
        />
      </div>

      <DocumentPreviewModal row={previewRow} onClose={() => setPreviewRow(null)} />
    </div>
  );
}
