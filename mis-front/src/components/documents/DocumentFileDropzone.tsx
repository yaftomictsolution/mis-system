"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  disabled?: boolean;
  showSummary?: boolean;
  title?: string;
  subtitle?: string;
  summaryTitle?: string;
  summaryText?: string;
  summaryDetails?: Array<{ label: string; value: string }>;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function mergeFiles(existing: File[], incoming: File[]): File[] {
  const seen = new Set(existing.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const merged = [...existing];

  incoming.forEach((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(file);
    }
  });

  return merged;
}

export function DocumentFileDropzone({
  files,
  onFilesChange,
  onRemoveFile,
  onClearFiles,
  disabled = false,
  showSummary = true,
  title = "Drop files here",
  subtitle = "Drag and drop multiple files, or browse from your device.",
  summaryTitle = "Upload Summary",
  summaryText = "The files will be attached individually so each one can be previewed, downloaded, or removed later.",
  summaryDetails = [],
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handlePickedFiles = (picked: FileList | null): void => {
    if (disabled || !picked || picked.length === 0) return;
    onFilesChange(mergeFiles(files, Array.from(picked)));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    handlePickedFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handlePickedFiles(event.dataTransfer.files);
  };

  const dropzoneClass = useMemo(() => {
    if (disabled) {
      return "border-slate-200 bg-slate-100 opacity-70 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]";
    }
    return dragActive
      ? "border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-500/10"
      : "border-dashed border-slate-300 bg-slate-50 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]";
  }, [disabled, dragActive]);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div
        className={`rounded-xl border-2 p-6 transition ${dropzoneClass}`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm dark:bg-[#12121a] dark:text-blue-400">
            <Upload size={24} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Browse Files
            </button>
            {files.length > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={onClearFiles}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Selected Files</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{files.length} file(s)</span>
          </div>

          {files.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
              No files selected yet.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveFile(index)}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-[#1a1a2e] dark:hover:text-red-400"
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {showSummary ? (
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] lg:max-w-sm">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{summaryTitle}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{summaryText}</p>
              {summaryDetails.length > 0 && (
                <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {summaryDetails.map((detail) => (
                    <div key={`${detail.label}:${detail.value}`}>
                      {detail.label}: {detail.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
