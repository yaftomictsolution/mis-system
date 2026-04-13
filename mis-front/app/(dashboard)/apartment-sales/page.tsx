"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSelector } from "react-redux";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import ApartmentSaleForm from "@/components/apartment-sales/ApartmentSaleForm";
import ApartmentSalesPageContent from "@/components/apartment-sales/ApartmentSalesPageContent";
import type { ApartmentRow, CustomerRow } from "@/db/localDB";
import {
  createEmptyApartmentSaleForm,
  type ApartmentSaleFormData,
} from "@/components/apartment-sales/apartment-sale.type";
import {
  LOOKUP_PAGE_SIZE,
  buildSalePayload,
  normalizeCustomDates,
  normalizeFrequency,
} from "@/components/apartment-sales/apartment-sale.page-helpers";
import { apartmentSaleCreate, apartmentSaleListLocal } from "@/modules/apartment-sales/apartment-sales.repo";
import { apartmentsListLocal, apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { customersListLocal, customersPullToLocal } from "@/modules/customers/customers.repo";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { subscribeAppEvent } from "@/lib/appEvents";
import {
  documentTypeOptionsLocal,
  documentTypesPullToLocal,
} from "@/modules/document-types/document-types.repo";
import { documentUpload, type DocumentTypeOption } from "@/modules/documents/documents.repo";
import type { RootState } from "@/store/store";

export default function ApartmentSalesPage() {
  
  const perms = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const canManageSales = useMemo(() => perms.includes("sales.create"), [perms]);
  const readOnly = !canManageSales;

  const [form, setForm] = useState<ApartmentSaleFormData>(createEmptyApartmentSaleForm());
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [saleDocumentTypes, setSaleDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [selectedSaleDocumentType, setSelectedSaleDocumentType] = useState("");
  const [saleFiles, setSaleFiles] = useState<File[]>([]);
  const [loadingSaleDocumentTypes, setLoadingSaleDocumentTypes] = useState(true);
  const [customerAssignedCountById, setCustomerAssignedCountById] = useState<Map<number, number>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  // Loads all customers for create form select options.
  const loadAllCustomers = useCallback(async (): Promise<CustomerRow[]> => {
    let page = 1;
    const all: CustomerRow[] = [];
    while (true) {
      const local = await customersListLocal({ page, pageSize: LOOKUP_PAGE_SIZE });
      all.push(...local.items);
      if (!local.hasMore) break;
      page += 1;
    }
    return all;
  }, []);

  // Loads all apartments for create form select options.
  const loadAllApartments = useCallback(async (): Promise<ApartmentRow[]> => {
    let page = 1;
    const all: ApartmentRow[] = [];
    while (true) {
      const local = await apartmentsListLocal({ page, pageSize: LOOKUP_PAGE_SIZE });
      all.push(...local.items);
      if (!local.hasMore) break;
      page += 1;
    }
    return all;
  }, []);

  // Loads active customer->apartment assignment counts for create form labels.
  const loadCustomerAssignedCount = useCallback(async (): Promise<Map<number, number>> => {
    const countByCustomer = new Map<number, number>();
    const seenCustomerApartment = new Set<string>();
    let page = 1;
    while (true) {
      const local = await apartmentSaleListLocal({ page, pageSize: LOOKUP_PAGE_SIZE });
      for (const sale of local.items) {
        const customerId = Number(sale.customer_id);
        const apartmentId = Number(sale.apartment_id);
        const status = String(sale.status ?? "").trim().toLowerCase();

        if (!Number.isFinite(customerId) || customerId <= 0) continue;
        if (!Number.isFinite(apartmentId) || apartmentId <= 0) continue;
        if (status === "cancelled" || status === "terminated" || status === "defaulted") continue;

        const uniqueKey = `${customerId}:${apartmentId}`;
        if (seenCustomerApartment.has(uniqueKey)) continue;
        seenCustomerApartment.add(uniqueKey);
        countByCustomer.set(customerId, (countByCustomer.get(customerId) ?? 0) + 1);
      }
      if (!local.hasMore) break;
      page += 1;
    }

    return countByCustomer;
  }, []);

  const loadSaleDocumentTypes = useCallback(async (): Promise<DocumentTypeOption[]> => {
    const local = await documentTypeOptionsLocal("apartment_sale");
    return local;
  }, []);

  const refreshSaleDocumentTypes = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingSaleDocumentTypes(true);
    try {
      const local = await loadSaleDocumentTypes();
      if (local.length > 0) {
        setSaleDocumentTypes(local);
        setSelectedSaleDocumentType((current) => (local.some((item) => item.value === current) ? current : local[0]?.value ?? ""));
      }

      try {
        await documentTypesPullToLocal();
      } catch {
        // Keep local document types if pull fails.
      }

      const fresh = await loadSaleDocumentTypes();
      setSaleDocumentTypes(fresh);
      setSelectedSaleDocumentType((current) => (fresh.some((item) => item.value === current) ? current : fresh[0]?.value ?? ""));
    } finally {
      if (showLoader) setLoadingSaleDocumentTypes(false);
    }
  }, [loadSaleDocumentTypes]);

  // Refreshes create lookups from local and online pull.
  const refreshLookups = useCallback(async () => {
    const [localCustomers, localApartments, localAssignedCount] = await Promise.all([
      loadAllCustomers(),
      loadAllApartments(),
      loadCustomerAssignedCount(),
    ]);
    setCustomers(localCustomers);
    setApartments(localApartments);
    setCustomerAssignedCountById(localAssignedCount);

    try {
      const [customersPull, apartmentsPull] = await Promise.all([
        customersPullToLocal(),
        apartmentsPullToLocal(),
      ]);
      const pulledAny =
        (customersPull?.pulled ?? 0) > 0 ||
        (apartmentsPull?.pulled ?? 0) > 0;
      if (pulledAny) {
        const [freshCustomers, freshApartments, freshAssignedCount] = await Promise.all([
          loadAllCustomers(),
          loadAllApartments(),
          loadCustomerAssignedCount(),
        ]);
        setCustomers(freshCustomers);
        setApartments(freshApartments);
        setCustomerAssignedCountById(freshAssignedCount);
      }
    } catch {}
  }, [loadAllApartments, loadAllCustomers, loadCustomerAssignedCount]);

  // Initial bootstrap for create form lookups.
  useEffect(() => {
    void refreshLookups();
  }, [refreshLookups]);

  useEffect(() => {
    void refreshSaleDocumentTypes();
  }, [refreshSaleDocumentTypes]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refreshLookups();
      void refreshSaleDocumentTypes(false);
    };
    const unsubscribeTypes = subscribeAppEvent("document-types:changed", () => {
      void refreshSaleDocumentTypes(false);
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeTypes();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refreshLookups, refreshSaleDocumentTypes]);

  // Customer dropdown options for create form.
  const customerOptions = useMemo(
    () =>
      customers
        .filter((item) => typeof item.id === "number" && item.id > 0)
        .map((item) => ({
          value: String(item.id),
          label: `${item.name} - Assigned: ${customerAssignedCountById.get(item.id ?? 0) ?? 0}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [customerAssignedCountById, customers]
  );

  // Apartment dropdown options (available units only) for create form.
  const apartmentOptions = useMemo(
    () =>
      apartments
        .filter((item) => {
          if (typeof item.id !== "number" || item.id <= 0) return false;
          const status = String(item.status ?? "").trim().toLowerCase();
          return status === "available";
        })
        .map((item) => ({
          value: String(item.id),
          label: `${item.apartment_code} - Unit ${item.unit_number}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apartments]
  );

  // Auto-fills total price when apartment selection changes.
  const applyApartmentSelection = useCallback(
    (apartmentId: string) => {
      setForm((prev) => {
        const selected = apartments.find((item) => String(item.id) === apartmentId);
        const totalPrice =
          selected && typeof selected.total_price === "number" && Number.isFinite(selected.total_price)
            ? selected.total_price
            : null;

        return {
          ...prev,
          apartment_id: apartmentId,
          total_price: totalPrice !== null ? String(totalPrice) : prev.total_price,
        };
      });
    },
    [apartments]
  );

  // Resets create form state.
  const closeCreateForm = useCallback(() => {
    setFormOpen(false);
    setFormError(null);
    setForm(createEmptyApartmentSaleForm());
    setSaleFiles([]);
    setSelectedSaleDocumentType((current) =>
      saleDocumentTypes.some((item) => item.value === current) ? current : saleDocumentTypes[0]?.value ?? ""
    );
  }, [saleDocumentTypes]);

  const handleSaleDocumentUploads = useCallback(
    async (sale: { id?: number; uuid: string; sale_id?: string }): Promise<void> => {
      if (saleFiles.length === 0) return;

      const selectedTypeLabel = saleDocumentTypes.find((item) => item.value === selectedSaleDocumentType)?.label;
      const referenceId = typeof sale.id === "number" && sale.id > 0 ? sale.id : undefined;
      const referenceLabel = sale.sale_id?.trim()
        ? `${sale.sale_id} - ${referenceId ? "Apartment Sale" : "Awaiting sale sync"}`
        : referenceId
          ? "Apartment Sale"
          : "Pending apartment sale sync";
      const results = await Promise.allSettled(
        saleFiles.map((file) =>
          documentUpload({
            module: "apartment_sale",
            documentType: selectedSaleDocumentType,
            documentTypeLabel: selectedTypeLabel,
            referenceId,
            referenceUuid: sale.uuid,
            referenceLabel,
            file,
          })
        )
      );

      const succeeded = results.filter((item) => item.status === "fulfilled").length;
      const failed = results.length - succeeded;
      const offlineSaved = results.filter(
        (item) => item.status === "fulfilled" && item.value.local_only
      ).length;

      if (succeeded > 0) {
        notifySuccess(
          offlineSaved === succeeded
            ? `${succeeded} sale document${succeeded === 1 ? "" : "s"} saved offline. They will sync when online.`
            : `${succeeded} sale document${succeeded === 1 ? "" : "s"} attached successfully.`
        );
      }

      if (failed > 0) {
        notifyInfo(
          `Sale created, but ${failed} attachment${failed === 1 ? "" : "s"} could not be uploaded. You can add them later from Documents.`
        );
      }
    },
    [saleDocumentTypes, saleFiles, selectedSaleDocumentType]
  );

  // Validates and creates a new sale from page-level create form.
  const handleCreateSale = useCallback(async () => {
    if (readOnly) {
      notifyError("Read-only access. You do not have permission to create sales.");
      return;
    }
    if (saving) return;

    const apartmentId = Number(form.apartment_id);
    const customerId = Number(form.customer_id);
    const totalPrice = Number(form.total_price);
    const discount = Number(form.discount || 0);

    if (!Number.isFinite(apartmentId) || apartmentId <= 0) {
      setFormError("Please select an apartment.");
      return;
    }
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setFormError("Please select a customer.");
      return;
    }
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      setFormError("Total price must be greater than 0.");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > totalPrice) {
      setFormError("Discount must be between 0 and total price.");
      return;
    }
    if (saleFiles.length > 0 && !selectedSaleDocumentType) {
      setFormError("Please choose a document type for the sale attachments.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = buildSalePayload(form);

      if (form.payment_type === "installment") {
        payload.frequency_type = normalizeFrequency(form.frequency_type);

        if (form.frequency_type === "custom_dates") {
          const customDates = normalizeCustomDates(form.custom_dates)
            .map((item, idx) => ({
              installment_no: idx + 1,
              due_date: item.due_date.trim(),
              amount: Number(item.amount),
            }))
            .filter((item) => item.due_date && Number.isFinite(item.amount) && item.amount > 0);

          if (!customDates.length) {
            setFormError("Custom dates must include at least one valid installment row.");
            return;
          }

          payload.custom_dates = customDates;
          payload.installment_count = customDates.length;
        } else {
          const installmentCount = Number(form.installment_count);
          if (!Number.isFinite(installmentCount) || installmentCount <= 0) {
            setFormError("Installment count must be greater than 0.");
            return;
          }
          if (!form.first_due_date.trim()) {
            setFormError("First due date is required for installment plans.");
            return;
          }
          payload.installment_count = Math.trunc(installmentCount);
          payload.first_due_date = form.first_due_date.trim();
        }
      }

      const saved = await apartmentSaleCreate(payload);
      if (saleFiles.length > 0) {
        await handleSaleDocumentUploads(saved);
      }
      closeCreateForm();
      setRefreshKey((prev) => prev + 1);
      await refreshLookups();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }, [
    closeCreateForm,
    form,
    handleSaleDocumentUploads,
    readOnly,
    refreshLookups,
    saleFiles.length,
    saving,
    selectedSaleDocumentType,
  ]);

  return (
    <RequirePermission permission={["sales.create", "sales.approve"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Apartment Sales"
          subtitle={
            readOnly
              ? "Review and approve pending sales"
              : "Manage sales with full/installment plans"
          }
          >
          {!readOnly && (
            <button
              type="button"
              onClick={() => setFormOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={16} />
              {formOpen ? "Hide Form" : "Create Sale"}
            </button>
          )}
        </PageHeader>
        
        <ApartmentSaleForm
          open={formOpen}
          mode="create"
          value={form}
          error={formError}
          submitting={saving}
          customerOptions={customerOptions}
          apartmentOptions={apartmentOptions}
          saleDocumentTypes={saleDocumentTypes}
          selectedSaleDocumentType={selectedSaleDocumentType}
          saleFiles={saleFiles}
          loadingSaleDocumentTypes={loadingSaleDocumentTypes}
          onApartmentSelect={applyApartmentSelection}
          onSaleDocumentTypeChange={setSelectedSaleDocumentType}
          onSaleFilesChange={setSaleFiles}
          onRemoveSaleFile={(index) => setSaleFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
          onClearSaleFiles={() => setSaleFiles([])}
          onChange={setForm}
          onCancel={closeCreateForm}
          onSubmit={() => {
            void handleCreateSale();
          }}
        />
        <ApartmentSalesPageContent refreshKey={refreshKey} />
      </div>
    </RequirePermission>
  );
}


