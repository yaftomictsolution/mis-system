"use client";

import type {
  DocumentModuleKey,
  DocumentReferenceOption,
  DocumentTypeOption,
} from "@/modules/documents/documents.repo";

type ModuleOption = {
  value: DocumentModuleKey;
  label: string;
};

type Props = {
  module: DocumentModuleKey;
  moduleOptions: ModuleOption[];
  documentTypes: DocumentTypeOption[];
  selectedDocumentType: string;
  references: DocumentReferenceOption[];
  selectedReferenceId: string;
  file: File | null;
  loadingReferences: boolean;
  saving: boolean;
  onModuleChange: (module: DocumentModuleKey) => void;
  onDocumentTypeChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
};

export function DocumentUploadForm({
  module,
  moduleOptions,
  documentTypes,
  selectedDocumentType,
  references,
  selectedReferenceId,
  file,
  loadingReferences,
  saving,
  onModuleChange,
  onDocumentTypeChange,
  onReferenceChange,
  onFileChange,
  onSubmit,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upload Document</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Attach document to customer, apartment, sale deed, or rental record.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
            disabled={saving}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 disabled:opacity-60 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            <option value="">Select type</option>
            {documentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Record</span>
          <select
            value={selectedReferenceId}
            onChange={(event) => onReferenceChange(event.target.value)}
            disabled={loadingReferences || saving}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 disabled:opacity-60 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            <option value="">{loadingReferences ? "Loading..." : "Select record"}</option>
            {references.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Document File</span>
          <input
            type="file"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white dark:file:bg-[#1a1a2e]"
          />
          {file && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{file.name}</p>}
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || loadingReferences}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Uploading..." : "Upload Document"}
        </button>
      </div>
    </div>
  );
}
