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
  statusFromPaymentType,
} from "@/components/apartment-sales/apartment-sale.type";
import {
  LOOKUP_PAGE_SIZE,
  normalizeCustomDates,
  normalizeFrequency,
} from "@/components/apartment-sales/apartment-sale.page-helpers";
import { apartmentSaleCreate, apartmentSaleListLocal } from "@/modules/apartment-sales/apartment-sales.repo";
import { municipalityLetterGenerate } from "@/modules/apartment-sale-financials/municipality-workflow.repo";
import { apartmentsListLocal, apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { customersListLocal, customersPullToLocal } from "@/modules/customers/customers.repo";
import { notifyError, notifySuccess } from "@/lib/notify";
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
      const [customersPull, apartmentsPull] = await Promise.all([customersPullToLocal(), apartmentsPullToLocal()]);
      const pulledAny = (customersPull?.pulled ?? 0) > 0 || (apartmentsPull?.pulled ?? 0) > 0;
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
  }, []);

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

    setSaving(true);
    setFormError(null);

    try {
      const payload: Record<string, unknown> = {
        apartment_id: apartmentId,
        customer_id: customerId,
        sale_date: form.sale_date || new Date().toISOString().slice(0, 10),
        total_price: totalPrice,
        discount,
        payment_type: form.payment_type,
        status: statusFromPaymentType(form.payment_type),
        schedule_locked: form.schedule_locked,
      };

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

  return (
    <RequirePermission permission="sales.create">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Apartment Sales"
          subtitle={readOnly ? "Read-only mode for non-admin users" : "Manage sales with full/installment plans"}
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
          onApartmentSelect={applyApartmentSelection}
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


