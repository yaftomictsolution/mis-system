"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useSelector } from "react-redux";
import type { ApartmentRow, CustomerRow } from "@/db/localDB";
import {
  createEmptyApartmentSaleForm,
  type ApartmentSaleFormData,
} from "@/components/apartment-sales/apartment-sale.type";
import { buildSalePayload } from "@/components/apartment-sales/apartment-sale.page-helpers";
import { loadAllSaleApartments, loadAllSaleCustomers } from "@/components/apartment-sales/apartment-sale.lookups";
import { apartmentSaleCreate } from "@/modules/apartment-sales/apartment-sales.repo";
import { municipalityLetterGenerate } from "@/modules/apartment-sale-financials/municipality-workflow.repo";
import { apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { customersPullToLocal } from "@/modules/customers/customers.repo";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { RootState } from "@/store/store";

type Option = { value: string; label: string };

export type ApartmentSalesCreateModel = {
  readOnly: boolean;
  formOpen: boolean;
  form: ApartmentSaleFormData;
  formError: string | null;
  saving: boolean;
  customerOptions: Option[];
  apartmentOptions: Option[];
  refreshKey: number;
  setForm: Dispatch<SetStateAction<ApartmentSaleFormData>>;
  toggleCreateForm: () => void;
  closeCreateForm: () => void;
  applyApartmentSelection: (apartmentId: string) => void;
  submitCreate: () => void;
};

/**
 * Encapsulates create-sale state, lookup loading, and create submit flow.
 */
export function useApartmentSalesCreate(): ApartmentSalesCreateModel {
  const perms = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const canManageSales = useMemo(() => perms.includes("sales.create"), [perms]);
  const readOnly = !canManageSales;

  const [form, setForm] = useState<ApartmentSaleFormData>(createEmptyApartmentSaleForm());
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshLookups = useCallback(async () => {
    const [localCustomers, localApartments] = await Promise.all([loadAllSaleCustomers(), loadAllSaleApartments()]);
    setCustomers(localCustomers);
    setApartments(localApartments);
    try {
      const [customersPull, apartmentsPull] = await Promise.all([customersPullToLocal(), apartmentsPullToLocal()]);
      const pulledAny = (customersPull?.pulled ?? 0) > 0 || (apartmentsPull?.pulled ?? 0) > 0;
      if (pulledAny) {
        const [freshCustomers, freshApartments] = await Promise.all([loadAllSaleCustomers(), loadAllSaleApartments()]);
        setCustomers(freshCustomers);
        setApartments(freshApartments);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshLookups();
  }, [refreshLookups]);

  const customerOptions = useMemo(
    () =>
      customers
        .filter((item) => typeof item.id === "number" && item.id > 0)
        .map((item) => ({ value: String(item.id), label: item.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [customers]
  );

  const apartmentOptions = useMemo(
    () =>
      apartments
        .filter((item) => typeof item.id === "number" && item.id > 0 && String(item.status ?? "").trim().toLowerCase() === "available")
        .map((item) => ({ value: String(item.id), label: `${item.apartment_code} - Unit ${item.unit_number}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apartments]
  );

  const applyApartmentSelection = useCallback(
    (apartmentId: string) => {
      setForm((prev) => {
        const selected = apartments.find((item) => String(item.id) === apartmentId);
        const totalPrice = selected && typeof selected.total_price === "number" && Number.isFinite(selected.total_price)
          ? selected.total_price
          : null;
        return { ...prev, apartment_id: apartmentId, total_price: totalPrice !== null ? String(totalPrice) : prev.total_price };
      });
    },
    [apartments]
  );

  const closeCreateForm = useCallback(() => {
    setFormOpen(false);
    setFormError(null);
    setForm(createEmptyApartmentSaleForm());
  }, []);

  const handleCreateSale = useCallback(async () => {
    if (readOnly) {
      notifyError("Read-only access. You do not have permission to create sales.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildSalePayload(form);
      const created = await apartmentSaleCreate(payload);
      if (created?.uuid) {
        try {
          await municipalityLetterGenerate(created.uuid);
          notifySuccess("Sale created. Municipality share auto-calculated and letter generated.");
        } catch {
          notifySuccess("Sale created. Municipality share auto-calculated.");
        }
      }
      closeCreateForm();
      setRefreshKey((prev) => prev + 1);
      await refreshLookups();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }, [closeCreateForm, form, readOnly, refreshLookups, saving]);

  return {
    readOnly,
    formOpen,
    form,
    formError,
    saving,
    customerOptions,
    apartmentOptions,
    refreshKey,
    setForm,
    toggleCreateForm: () => setFormOpen((prev) => !prev),
    closeCreateForm,
    applyApartmentSelection,
    submitCreate: () => {
      void handleCreateSale();
    },
  };
}
