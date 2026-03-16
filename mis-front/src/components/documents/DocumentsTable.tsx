"use client";

import { Download, Eye } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  getDocumentPreviewKind,
  type SystemDocumentRow,
} from "@/modules/documents/documents.repo";

type Props = {
  rows: SystemDocumentRow[];
  loading: boolean;
  onPreview: (row: SystemDocumentRow) => void;
  onDelete: (row: SystemDocumentRow) => void;
};

function downloadLocalBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function toDateTimeLabel(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export function DocumentsTable({ rows, loading, onPreview, onDelete }: Props) {
  const columns: Column<SystemDocumentRow>[] = [
    { key: "module_label", label: "Module" },
    { key: "document_type_label", label: "Type" },
    { key: "reference_label", label: "Record" },
    { key: "file_name", label: "File" },
    {
      key: "created_at",
      label: "Uploaded",
      render: (item) => <span>{toDateTimeLabel(item.created_at)}</span>,
    },
    {
      key: "preview",
      label: "Preview",
      render: (item) => {
        const previewKind = getDocumentPreviewKind(item);

        return (
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
          >
            <Eye size={14} />
            {previewKind === "none" ? "Details" : "Preview"}
          </button>
        );
      },
    },
    {
      key: "download",
      label: "Download",
      render: (item) =>
        item.local_blob ? (
          <button
            type="button"
            onClick={() => downloadLocalBlob(item.local_blob as Blob, item.file_name)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
          >
            <Download size={14} />
            Download
          </button>
        ) : (
          <a
            href={item.download_url}
            target="_blank"
            rel="noreferrer"
            download={item.file_name}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
          >
            <Download size={14} />
            Download
          </a>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      compact
      mobileStack
      noHorizontalScroll
      pageSize={15}
      searchKeys={["module_label", "document_type_label", "reference_label", "file_name"]}
      onDelete={onDelete}
    />
  );
}
