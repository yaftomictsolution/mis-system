"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import {
  documentTypeCreate,
  documentTypeDelete,
  documentTypesListLocal,
  documentTypesPullToLocal,
  documentTypeUpdate,
  type DocumentTypeInput,
  type DocumentTypeRow,
} from "@/modules/document-types/document-types.repo";
import { ASSET_TYPE_MODULE } from "@/modules/document-types/asset-type-helpers";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

type AssetTypeFormState = {
  label: string;
  is_active: "true" | "false";
};

const TABLE_PAGE_SIZE = 8;

function createEmptyAssetTypeForm(): AssetTypeFormState {
  return {
    label: "",
    is_active: "true",
  };
}

function toAssetTypeForm(row: DocumentTypeRow): AssetTypeFormState {
  return {
    label: row.label,
    is_active: row.is_active ? "true" : "false",
  };
}

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleString();
}

export default function AssetTypeManagerModal({
  isOpen,
  onClose,
  title = "Asset Types",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<DocumentTypeRow[]>([]);
  const [editing, setEditing] = useState<DocumentTypeRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocumentTypeRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<AssetTypeFormState>(createEmptyAssetTypeForm());

  const loadLocal = useCallback(async () => {
    const typeRows = await documentTypesListLocal({ module: ASSET_TYPE_MODULE, includeInactive: true });
    setRows(typeRows);
  }, []);

  const refresh = useCallback(
    async (showLoader = true) => {
      if (!isOpen) return;
      if (showLoader) setLoading(true);
      try {
        await loadLocal();
        try {
          await documentTypesPullToLocal();
        } catch {
          // Keep local rows when remote pull is not available.
        }
        await loadLocal();
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [isOpen, loadLocal],
  );

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;

    const onSyncComplete = () => {
      void refresh(false);
    };
    const unsubscribe = subscribeAppEvent("document-types:changed", () => {
      void refresh(false);
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribe();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [isOpen, refresh]);

  const columns = useMemo<Column<DocumentTypeRow>[]>(
    () => [
      {
        key: "label",
        label: "Asset Type",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white">{item.label}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{item.code}</div>
          </div>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        render: (item) => (
          <span className={item.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
            {item.is_active ? "Active" : "Inactive"}
          </span>
        ),
      },
      {
        key: "updated_at",
        label: "Updated",
        render: (item) => <span>{toDateLabel(item.updated_at)}</span>,
      },
    ],
    [],
  );

  const resetForm = useCallback(() => {
    setEditing(null);
    setForm(createEmptyAssetTypeForm());
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (saving) return;

    const trimmedLabel = form.label.trim();
    if (!trimmedLabel) {
      setFormError("Asset type name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: DocumentTypeInput = {
        module: ASSET_TYPE_MODULE,
        label: trimmedLabel,
        is_active: form.is_active === "true",
      };

      if (editing?.uuid) {
        await documentTypeUpdate(editing.uuid, payload);
        notifySuccess("Asset type updated.");
      } else {
        await documentTypeCreate(payload);
        notifySuccess("Asset type created.");
      }

      resetForm();
      await refresh(false);
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save asset type.");
    } finally {
      setSaving(false);
    }
  }, [editing?.uuid, form, refresh, resetForm, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete?.uuid) return;

    try {
      await documentTypeDelete(pendingDelete.uuid);
      notifySuccess("Asset type deleted.");
      setPendingDelete(null);
      await refresh(false);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Unable to delete asset type.");
    }
  }, [pendingDelete, refresh]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editing ? "Edit Asset Type" : "Create Asset Type"}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create, edit, and manage the asset type list in this same modal.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              New Asset Type
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Status"
              type="select"
              value={form.is_active}
              onChange={(value) => setForm((prev) => ({ ...prev, is_active: value as AssetTypeFormState["is_active"] }))}
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
              required
            />
          </div>

          <FormField
            label="Asset Type Name"
            value={form.label}
            onChange={(value) => setForm((prev) => ({ ...prev, label: String(value) }))}
            placeholder="Example: Heavy Equipment"
            required
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
            The system generates the internal asset type code automatically from the name and keeps that code stable even if the label changes later.
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void handleSubmit();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editing ? "Update Asset Type" : "Create Asset Type"}
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-[#2a2a3e]">
            {rows.length === 0 ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
                No managed asset types yet. Default built-in types are still available: Vehicle, Machine, Tool, IT Equipment.
              </div>
            ) : null}

            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              onEdit={(row) => {
                setEditing(row);
                setForm(toAssetTypeForm(row));
                setFormError(null);
              }}
              onDelete={setPendingDelete}
              canDelete={(row) => row.can_delete !== false}
              searchKeys={["label", "code"]}
              pageSize={TABLE_PAGE_SIZE}
              compact
              mobileStack
              noHorizontalScroll
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete Asset Type"
        message={
          pendingDelete?.delete_blocked_reason
            ? pendingDelete.delete_blocked_reason
            : `Delete ${pendingDelete?.label ?? "this asset type"}?`
        }
      />
    </>
  );
}
