"use client";

import { useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import {
  getDocumentPreviewKind,
  type SystemDocumentRow,
} from "@/modules/documents/documents.repo";

type Props = {
  row: SystemDocumentRow | null;
  onClose: () => void;
};

export function DocumentPreviewModal({ row, onClose }: Props) {
  const kind = row ? getDocumentPreviewKind(row) : "none";
  const objectUrl = useMemo(() => {
    if (!row?.local_blob) return null;
    return URL.createObjectURL(row.local_blob);
  }, [row]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const source = objectUrl || row?.file_url || row?.download_url || "";

  return (
    <Modal
      isOpen={Boolean(row)}
      onClose={onClose}
      title={row ? `Preview: ${row.file_name}` : "Preview"}
      size="xl"
    >
      {!row ? null : kind === "image" ? (
        <div className="flex justify-center">
          <img
            src={source}
            alt={row.file_name}
            className="max-h-[70vh] w-auto max-w-full rounded-lg border border-slate-200 object-contain dark:border-[#2a2a3e]"
          />
        </div>
      ) : kind === "pdf" ? (
        <iframe
          src={source}
          title={row.file_name}
          className="h-[70vh] w-full rounded-lg border border-slate-200 dark:border-[#2a2a3e]"
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This file type cannot be previewed inside the system.
          </p>
          <a
            href={source}
            target="_blank"
            rel="noreferrer"
            download={row.file_name}
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Download File
          </a>
        </div>
      )}
    </Modal>
  );
}
