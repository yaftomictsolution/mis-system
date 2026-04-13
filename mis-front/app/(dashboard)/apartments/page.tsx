"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApartmentRow } from "@/db/localDB";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/modal";
import { Plus } from "lucide-react";
import ApartmentForm from "@/components/apartments/ApartmentForm";
import ApartmentExpandedRow from "@/components/apartments/ApartmentExpandedRow";
import { createApartmentColumns } from "@/components/apartments/apartment.columns";
import SecureQrCode from "@/components/qr/SecureQrCode";
import { buildQrAccessPath, buildQrAccessUrl } from "@/lib/secureQr";
import { notifyError, notifySuccess } from "@/lib/notify";

import {
  createEmptyApartmentForm,
  type ApartmentFormData,
  type ApartmentStatus,
  type FormMode,
  type UsageType,
} from "@/components/apartments/apartment.types";

import {
  apartmentCreate,
  apartmentDelete,
  apartmentsListLocal,
  apartmentsPullToLocal,
  apartmentUpdate,
} from "@/modules/apartments/apartments.repo";

const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;

const normalizeStatus = (value: string | null | undefined): ApartmentStatus => {
  const status = (value ?? "").trim().toLowerCase();
  if (status === "reserved" || status === "handed_over" || status === "sold" || status === "rented" || status === "company_use") return status;
  return "available";
};

const normalizeUsageType = (value: string | null | undefined): UsageType => {
  return (value ?? "").trim().toLowerCase() === "commercial" ? "commercial" : "residential";
};

const toForm = (row: ApartmentRow): ApartmentFormData => ({
  apartment_code: row.apartment_code,
  usage_type: normalizeUsageType(row.usage_type),
  block_number: row.block_number ?? "",
  unit_number: row.unit_number,
  floor_number: row.floor_number ?? "",
  bedrooms: row.bedrooms,
  halls: row.halls,
  bathrooms: row.bathrooms,
  kitchens: row.kitchens,
  balcony: row.balcony ? "yes" : "no",
  area_sqm: String(row.area_sqm ?? ""),
  apartment_shape: row.apartment_shape ?? "",
  corridor: row.corridor ?? "",
  north_boundary: row.north_boundary ?? "",
  south_boundary: row.south_boundary ?? "",
  east_boundary: row.east_boundary ?? "",
  west_boundary: row.west_boundary ?? "",
  status: normalizeStatus(row.status),
  qr_code: row.qr_code ?? "",
  additional_info: row.additional_info ?? "",
});

export default function ApartmentsPage() {

  const [rows, setRows] = useState<ApartmentRow[]>([]);
  const [form, setForm] = useState<ApartmentFormData>(createEmptyApartmentForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApartmentRow | null>(null);
  const [qrPreviewRow, setQrPreviewRow] = useState<ApartmentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const isEditing = formMode === "edit";

  const loadLocal = useCallback(async () => {
    const local = await apartmentsListLocal({
      page: 1,
      pageSize: LOCAL_LIST_PAGE_SIZE,
    });
    setRows(local.items.map((item) => ({ ...item })));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadLocal();
      try {
        await apartmentsPullToLocal();
      } catch {}
      await loadLocal();
    } finally {
      setLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const closeForm = useCallback(() => {
    setFormMode(null);
    setEditingUuid(null);
    setFormError(null);
    setForm(createEmptyApartmentForm());
  }, []);

  const openCreateForm = useCallback(() => {
    if (formMode === "create") {
      closeForm();
      return;
    }
    setFormMode("create");
    setEditingUuid(null);
    setFormError(null);
    setForm(createEmptyApartmentForm());
  }, [closeForm, formMode]);

  const openEditForm = useCallback((row: ApartmentRow) => {
    setFormMode("edit");
    setEditingUuid(row.uuid);
    setFormError(null);
    setForm(toForm(row));
  }, []);

  const handleSave = useCallback(async () => {

    if (saving) return;

    const apartmentCode = form.apartment_code.trim().toUpperCase();
    const unitNumber = form.unit_number.trim();
    if (!apartmentCode || !unitNumber) {
      setFormError("Apartment code and unit number are required.");
    }

    const areaRaw = form.area_sqm.trim();
    const areaValue = areaRaw === "" ? 0 : Number(areaRaw);
    if (areaRaw !== "" && (!Number.isFinite(areaValue) || areaValue < 0)) {
      setFormError("Area must be a non-negative number.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
        const payload = {
        apartment_code: apartmentCode,
        usage_type: normalizeUsageType(form.usage_type),
        block_number: form.block_number.trim(),
        unit_number: unitNumber,
        floor_number: form.floor_number.trim(),
        bedrooms: Number(form.bedrooms) || 0,
        halls: Number(form.halls) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        kitchens: Number(form.kitchens) || 0,
        balcony: form.balcony === "yes",
        area_sqm: areaValue,
        apartment_shape: form.apartment_shape.trim(),
        corridor: form.corridor.trim(),
        north_boundary: form.north_boundary.trim(),
        south_boundary: form.south_boundary.trim(),
        east_boundary: form.east_boundary.trim(),
        west_boundary: form.west_boundary.trim(),
        status: normalizeStatus(form.status),
        qr_code: form.qr_code.trim(),
      };
      if (editingUuid) {
        await apartmentUpdate(editingUuid, payload);
      } else {
        await apartmentCreate(payload);
      }
      closeForm();
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editingUuid, form, refresh, saving]);

  const handleDelete = useCallback(async () => {
    if (!pendingDelete?.uuid) return;
    try {
      await apartmentDelete(pendingDelete.uuid);
      if (editingUuid === pendingDelete.uuid) {
        closeForm();
      }
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }, [closeForm, editingUuid, pendingDelete, refresh]);

  const handleViewQr = useCallback((row: ApartmentRow) => {
    setQrPreviewRow(row);
  }, []);

  const handleCopyQrLink = useCallback(async () => {
    const token = String(qrPreviewRow?.qr_access_token ?? "").trim();
    if (!token) return;

    try {
      await navigator.clipboard.writeText(buildQrAccessUrl(token));
      notifySuccess("QR access link copied.");
    } catch {
      notifyError("Could not copy QR access link.");
    }
  }, [qrPreviewRow?.qr_access_token]);

  const columns = useMemo(
    () => createApartmentColumns(),
    []
  );

  const renderExpandedApartmentRow = useCallback(
    (row: ApartmentRow) => <ApartmentExpandedRow row={row} onViewQr={handleViewQr} />,
    [handleViewQr]
  );

  const qrPreviewToken = String(qrPreviewRow?.qr_access_token ?? "").trim();
  const qrPreviewStatus = String(qrPreviewRow?.qr_access_status ?? "").trim() || "Ready";
  const qrPreviewUnit = qrPreviewRow
    ? `${qrPreviewRow.block_number ? `${qrPreviewRow.block_number}-` : ""}${qrPreviewRow.unit_number}`
    : "-";

  return (
    <RequirePermission permission="apartments.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Apartments" subtitle="Manage apartment records with online and offline CRUD">
          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            {formMode === "create" ? "Hide Form" : "Create Apartment"}
          </button>
        </PageHeader>

        <ApartmentForm
          open={Boolean(formMode)}
          mode={isEditing ? "edit" : "create"}
          value={form}
          error={formError}
          submitting={saving}
          onChange={setForm}
          onCancel={closeForm}
          onSubmit={() => {
            void handleSave();
          }}
        />

        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          compact
          mobileStack
          noHorizontalScroll
          expandableRows
          renderExpandedRow={renderExpandedApartmentRow}
          onEdit={openEditForm}
          onDelete={setPendingDelete}
          searchKeys={[
            "apartment_code",
            "usage_type",
            "unit_number",
            "status",
            "block_number",
            "floor_number",
            "apartment_shape",
            "corridor",
            "north_boundary",
            "south_boundary",
            "east_boundary",
            "west_boundary",
            "additional_info",
          ]}
          pageSize={TABLE_PAGE_SIZE}
        />

        <ConfirmDialog
          isOpen={Boolean(pendingDelete)}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            void handleDelete();
          }}
          title="Delete Apartment"
          message={`Are you sure you want to delete apartment ${pendingDelete?.apartment_code ?? ""}? This action cannot be undone.`}
        />

        <Modal
          isOpen={Boolean(qrPreviewRow)}
          onClose={() => setQrPreviewRow(null)}
          title={qrPreviewRow ? `QR Access - ${qrPreviewRow.apartment_code}` : "QR Access"}
          size="md"
        >
          {qrPreviewRow ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Apartment</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{qrPreviewRow.apartment_code}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Unit</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{qrPreviewUnit}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">QR Status</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{qrPreviewStatus}</div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#2a2a3e] dark:bg-[#101018]">
                <SecureQrCode
                  token={qrPreviewToken}
                  size={220}
                  label="Scan to open the secure apartment access page"
                  captionClassName="max-w-[240px]"
                />
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.open(buildQrAccessPath(qrPreviewToken), "_blank", "noopener,noreferrer")}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
                  >
                    Open Page
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyQrLink();
                    }}
                    className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </RequirePermission>
  );
}
