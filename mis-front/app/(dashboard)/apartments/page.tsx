"use client";

import { useCallback, useEffect, useState } from "react";
import { ApartmentRow } from "@/db/localDB";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Plus } from "lucide-react";
import ApartmentForm from "@/components/apartments/ApartmentForm";
import { apartmentColumns } from "@/components/apartments/apartment.columns";
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
          columns={apartmentColumns}
          data={rows}
          loading={loading}
          onEdit={openEditForm}
          onDelete={setPendingDelete}
          searchKeys={["apartment_code", "usage_type", "unit_number", "status", "block_number"]}
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
      </div>
    </RequirePermission>
  );
}
