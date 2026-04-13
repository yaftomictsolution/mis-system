"use client";

import { useMemo } from "react";
import type {
  DocumentModuleKey,
  DocumentReferenceOption,
  DocumentTypeOption,
} from "@/modules/documents/documents.repo";
import { DocumentFileDropzone } from "@/components/documents/DocumentFileDropzone";

type Props = {
  module: DocumentModuleKey;
  moduleOptions: Array<{ value: DocumentModuleKey; label: string }>;
  documentTypes: DocumentTypeOption[];
  selectedDocumentType: string;
  references: DocumentReferenceOption[];
  selectedReferenceId: string;
  files: File[];
  loadingReferences: boolean;
  saving: boolean;
  onModuleChange: (module: DocumentModuleKey) => void;
  onDocumentTypeChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onSubmit: () => void;
};

export function DocumentUploadForm({
  module,
  moduleOptions,
  documentTypes,
  selectedDocumentType,
  references,
  selectedReferenceId,
  files,
  loadingReferences,
  saving,
  onModuleChange,
  onDocumentTypeChange,
  onReferenceChange,
  onFilesChange,
  onRemoveFile,
  onClearFiles,
  onSubmit,
}: Props) {
  const selectedTypeLabel = useMemo(
    () => documentTypes.find((item) => item.value === selectedDocumentType)?.label ?? "document type",
    [documentTypes, selectedDocumentType]
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upload Documents</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Drag and drop multiple files, or browse from your device, then attach them to the selected record.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Module</span>
          <select
            value={module}
            onChange={(event) => onModuleChange(event.target.value as DocumentModuleKey)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            {moduleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Document Type</span>
          <select
            value={selectedDocumentType}
            onChange={(event) => onDocumentTypeChange(event.target.value)}
            disabled={documentTypes.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            {documentTypes.length === 0 ? (
              <option value="">No document types configured</option>
            ) : (
              documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Record</span>
          <select
            value={selectedReferenceId}
            onChange={(event) => onReferenceChange(event.target.value)}
            disabled={loadingReferences || references.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            {loadingReferences ? (
              <option value="">Loading records...</option>
            ) : references.length === 0 ? (
              <option value="">No records available</option>
            ) : (
              references.map((reference) => (
                <option key={reference.id} value={String(reference.id)}>
                  {reference.label}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <DocumentFileDropzone
        files={files}
        onFilesChange={onFilesChange}
        onRemoveFile={onRemoveFile}
        onClearFiles={onClearFiles}
        disabled={saving}
        title="Drop files here"
        subtitle={`Upload multiple files at once and attach them as ${selectedTypeLabel} to the selected record.`}
        summaryDetails={[
          { label: "Module", value: moduleOptions.find((item) => item.value === module)?.label ?? module },
          { label: "Type", value: selectedTypeLabel },
          { label: "Files Ready", value: String(files.length) },
        ]}
      />

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={saving || files.length === 0 || !selectedReferenceId || !selectedDocumentType}
          onClick={onSubmit}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Uploading..." : `Upload ${files.length || ""} ${files.length === 1 ? "Document" : "Documents"}`.trim()}
        </button>
      </div>
    </section>
  );
}
