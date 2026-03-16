"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import ApartmentSalesContentView from "@/components/apartment-sales/ApartmentSalesContentView";
import { ApartmentSaleExpandedRow } from "@/components/apartment-sales/ApartmentSaleExpandedRow";
import type { ApartmentSaleTerminateFormState } from "@/components/apartment-sales/ApartmentSaleDialogs";
import type { ApartmentRow, ApartmentSaleRow, CustomerRow } from "@/db/localDB";
import { createApartmentSalesColumns } from "@/components/apartment-sales/apartment-sale.columns";
import {
  createEmptyApartmentSaleForm,
  type ApartmentSaleFormData,
} from "@/components/apartment-sales/apartment-sale.type";
import {
  DEFAULTED_MIN_CHARGE_RATE,
  DEFAULTED_SUGGESTED_CHARGE_RATE,
  LOCAL_LIST_PAGE_SIZE,
  TERMINATED_SUGGESTED_CHARGE_RATE,
  buildSalePayload,
  customerRemainingAmount,
  resolveRowEditScope,
  toCurrency,
  toDateLabel,
  toForm,
  toMoney2,
} from "@/components/apartment-sales/apartment-sale.page-helpers";

import { loadAllSaleApartments, loadAllSaleCustomers } from "@/components/apartment-sales/apartment-sale.lookups";
import {
  apartmentSaleDelete,
  apartmentSaleHandoverKey,
  apartmentSaleIssueDeed,
  apartmentSaleListLocal,
  apartmentSalePullToLocal,
  apartmentSaleTerminate,
  apartmentSaleUpdate,
  type ApartmentSaleTerminateInput,
} from "@/modules/apartment-sales/apartment-sales.repo";
import { apartmentSaleMunicipalityRemainingMapLocal } from "@/modules/apartment-sale-financials/apartment-sale-financials.repo";
import { installmentsPaidTotalsBySaleUuidLocal, installmentsPullToLocal } from "@/modules/installments/installments.repo";
import { notifyError } from "@/lib/notify";
import { subscribeAppEvent } from "@/lib/appEvents";
import { apartmentsPullToLocal } from "@/modules/apartments/apartments.repo";
import { customersPullToLocal } from "@/modules/customers/customers.repo";
import type { RootState } from "@/store/store";

type ApartmentSalesPageContentProps = {
  refreshKey?: number;
};

type SelectOption = {
  value: string;
  label: string;
};

const READ_ONLY_MESSAGE = "Read-only access. You do not have permission to create/update/delete sales.";

function getStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function buildCustomerAssignedCount(rows: ApartmentSaleRow[]): Map<number, number> {
  const countByCustomer = new Map<number, number>();
  const seenCustomerApartment = new Set<string>();

  for (const sale of rows) {
    const customerId = Number(sale.customer_id);
    const apartmentId = Number(sale.apartment_id);
    const status = getStatus(sale.status);

    if (!Number.isFinite(customerId) || customerId <= 0) continue;
    if (!Number.isFinite(apartmentId) || apartmentId <= 0) continue;
    if (status === "cancelled" || status === "terminated" || status === "defaulted") continue;

    const uniqueKey = `${customerId}:${apartmentId}`;
    if (seenCustomerApartment.has(uniqueKey)) continue;

    seenCustomerApartment.add(uniqueKey);
    countByCustomer.set(customerId, (countByCustomer.get(customerId) ?? 0) + 1);
  }
  return countByCustomer;
}

function buildCustomerOptions(customers: CustomerRow[], assignedCountById: Map<number, number>): SelectOption[] {
  return customers
    .filter((item) => typeof item.id === "number" && item.id > 0)
    .map((item) => ({
      value: String(item.id),
      label: `${item.name} - Assigned: ${assignedCountById.get(item.id ?? 0) ?? 0}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildApartmentOptions(
  apartments: ApartmentRow[],
  selectedApartmentId: string,
  isEditing: boolean
): SelectOption[] {
  return apartments
    .filter((item) => {
      if (typeof item.id !== "number" || item.id <= 0) return false;
      const isAvailable = getStatus(item.status) === "available";
      const isSelected = isEditing && String(item.id) === String(selectedApartmentId);
      return isAvailable || isSelected;
    })
    .map((item) => ({
      value: String(item.id),
      label: `${item.apartment_code} - Unit ${item.unit_number}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildCustomerLabelMap(customers: CustomerRow[]): Map<number, string> {
  
  const map = new Map<number, string>();
  for (const item of customers) {
    if (!item.id || item.id <= 0) continue;
    map.set(item.id, item.name);
  }
  return map;
}

function buildApartmentLabelMap(apartments: ApartmentRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const item of apartments) {
    if (!item.id || item.id <= 0) continue;
    map.set(item.id, `${item.apartment_code} - Unit ${item.unit_number}`);
  }
  return map;
}

export default function ApartmentSalesPageContent({ refreshKey = 0 }: ApartmentSalesPageContentProps) {
  const permissions = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const canManageSales = permissions.includes("sales.create");
  const canApproveDeed = permissions.includes("sales.approve");
  const readOnly = !canManageSales;

  const [rows, setRows] = useState<ApartmentSaleRow[]>([]);
  const [installmentPaidBySaleUuid, setInstallmentPaidBySaleUuid] = useState<Map<string, number>>(() => new Map());
  const [municipalityRemainingBySaleUuid, setMunicipalityRemainingBySaleUuid] = useState<Map<string, number>>(
    () => new Map()
  );
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [form, setForm] = useState<ApartmentSaleFormData>(createEmptyApartmentSaleForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pendingDelete, setPendingDelete] = useState<ApartmentSaleRow | null>(null);
  const [pendingHandover, setPendingHandover] = useState<ApartmentSaleRow | null>(null);
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [pendingTerminate, setPendingTerminate] = useState<ApartmentSaleRow | null>(null);
  const [terminateSubmitting, setTerminateSubmitting] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [terminateForm, setTerminateForm] = useState<ApartmentSaleTerminateFormState>({
    reason: "",
    status: "terminated",
    vacated_at: new Date().toISOString().slice(0, 10),
    termination_charge: "0",
  });
  const [pendingIssueDeed, setPendingIssueDeed] = useState<ApartmentSaleRow | null>(null);
  const [deedIssuing, setDeedIssuing] = useState(false);
  const [deedIssueError, setDeedIssueError] = useState<string | null>(null);

  const isEditing = Boolean(editingUuid);

  const getSalePaidTotal = useCallback(
    (row?: ApartmentSaleRow | null): number => {
      if (!row) return 0;

      const paidFromMap = installmentPaidBySaleUuid.get(row.uuid);
      if (typeof paidFromMap === "number" && Number.isFinite(paidFromMap)) {
        return Math.max(0, toMoney2(paidFromMap));
      }

      const paidFromRow = Number(row.installments_paid_total ?? 0);
      if (Number.isFinite(paidFromRow)) {
        return Math.max(0, toMoney2(paidFromRow));
      }

      return 0;
    },
    [installmentPaidBySaleUuid]
  );

  const defaultedMinCharge = useCallback((paidTotal: number): number => {
    return toMoney2(Math.max(0, paidTotal) * DEFAULTED_MIN_CHARGE_RATE);
  }, []);

  const suggestedCharge = useCallback(
    (status: "terminated" | "defaulted", paidTotal: number): number => {
      const safePaid = Math.max(0, paidTotal);
      const rate = status === "defaulted" ? DEFAULTED_SUGGESTED_CHARGE_RATE : TERMINATED_SUGGESTED_CHARGE_RATE;
      const charge = toMoney2(safePaid * rate);

      if (status === "defaulted") {
        return Math.max(defaultedMinCharge(safePaid), charge);
      }
      return charge;
    },
    [defaultedMinCharge]
  );

  const loadLookups = useCallback(async () => {
    const [customerRows, apartmentRows] = await Promise.all([loadAllSaleCustomers(), loadAllSaleApartments()]);
    setCustomers(customerRows);
    setApartments(apartmentRows);
  }, []);

  const loadLocal = useCallback(async () => {
    const local = await apartmentSaleListLocal({ page: 1, pageSize: LOCAL_LIST_PAGE_SIZE });
    const localRows = local.items.map((item) => ({ ...item }));

    const [remainingMap, paidMap] = await Promise.all([
      apartmentSaleMunicipalityRemainingMapLocal(localRows.map((item) => item.uuid)),
      installmentsPaidTotalsBySaleUuidLocal(localRows.map((item) => item.uuid)),
    ]);

    const patchedRows = localRows.map((item) => {
      const paid = paidMap.get(item.uuid);
      if (typeof paid !== "number" || !Number.isFinite(paid)) return item;
      return {
        ...item,
        installments_paid_total: Number(paid.toFixed(2)),
        has_paid_installments: paid > 0,
      };
    });

    setRows(patchedRows);
    setMunicipalityRemainingBySaleUuid(remainingMap);
    setInstallmentPaidBySaleUuid(paidMap);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      await Promise.all([loadLocal(), loadLookups()]);

      try {
        const [salesPull, installmentsPull, customersPull, apartmentsPull] = await Promise.all([
          apartmentSalePullToLocal(),
          installmentsPullToLocal(),
          customersPullToLocal(),
          apartmentsPullToLocal(),
        ]);

        const pulledAny =
          (salesPull?.pulled ?? 0) > 0 ||
          (installmentsPull?.pulled ?? 0) > 0 ||
          (customersPull?.pulled ?? 0) > 0 ||
          (apartmentsPull?.pulled ?? 0) > 0;

        if (pulledAny) {
          await Promise.all([loadLocal(), loadLookups()]);
        }
      } catch {
        // Keep local data if online pull fails.
      }
    } finally {
      setLoading(false);
    }
  }, [loadLocal, loadLookups]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    let loadingLocal = false;
    let loadingFull = false;
    let lastSyncAt = 0;
    let lastInstallmentEventAt = 0;

    const refreshLocalOnly = async () => {
      if (loadingLocal) return;
      loadingLocal = true;
      try {
        await loadLocal();
      } finally {
        loadingLocal = false;
      }
    };

    const refreshLocalAndLookups = async () => {
      if (loadingFull) return;
      loadingFull = true;
      try {
        await Promise.all([loadLocal(), loadLookups()]);
      } finally {
        loadingFull = false;
      }
    };

    const onSyncComplete = (event: Event) => {
      const syncedAny = Boolean((event as CustomEvent<{ syncedAny?: boolean }>).detail?.syncedAny);
      if (!syncedAny) return;

      const now = Date.now();
      if (now - lastSyncAt < 800) return;
      lastSyncAt = now;

      void refreshLocalAndLookups();
    };

    const onInstallmentsChanged = () => {
      const now = Date.now();
      if (now - lastInstallmentEventAt < 400) return;
      lastInstallmentEventAt = now;

      void refreshLocalOnly();
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    const unsubscribeInstallmentsChanged = subscribeAppEvent("installments:changed", onInstallmentsChanged);

    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      unsubscribeInstallmentsChanged();
    };
  }, [loadLocal, loadLookups]);

  const customerAssignedCountById = useMemo(() => buildCustomerAssignedCount(rows), [rows]);
  const customerOptions = useMemo(
    () => buildCustomerOptions(customers, customerAssignedCountById),
    [customers, customerAssignedCountById]
  );
  const apartmentOptions = useMemo(
    () => buildApartmentOptions(apartments, form.apartment_id, isEditing),
    [apartments, form.apartment_id, isEditing]
  );
  const customerLabelById = useMemo(() => buildCustomerLabelMap(customers), [customers]);
  const apartmentLabelById = useMemo(() => buildApartmentLabelMap(apartments), [apartments]);

  const openHandoverDialog = useCallback(
    (row: ApartmentSaleRow) => {
      const status = getStatus(row.status);
      if (status === "cancelled" || status === "terminated" || status === "defaulted") {
        notifyError("Cannot hand over keys for cancelled/terminated/defaulted sale.");
        return;
      }
      if (getStatus(row.key_handover_status) === "handed_over") {
        notifyError("Key is already handed over.");
        return;
      }

      const hasInstallmentPayment = row.payment_type === "installment" && getSalePaidTotal(row) > 0;
      const canHandover = Boolean(row.can_handover_key || row.has_first_installment_paid || hasInstallmentPayment);
      if (!canHandover) {
        notifyError("At least one installment payment must be recorded before key handover.");
        return;
      }

      setHandoverError(null);
      setPendingHandover(row);
    },
    [getSalePaidTotal]
  );

  const openTerminateDialog = useCallback(
    (row: ApartmentSaleRow) => {
      const status = getStatus(row.status);
      if (status === "cancelled" || status === "terminated" || status === "defaulted" || status === "completed") {
        notifyError("Sale is already completed/cancelled/terminated/defaulted.");
        return;
      }
      if (getStatus(row.deed_status) === "issued") {
        notifyError("Cannot terminate sale after deed issuance.");
        return;
      }

      const paidTotal = getSalePaidTotal(row);
      setTerminateError(null);
      setTerminateForm({
        reason: "",
        status: "terminated",
        vacated_at: new Date().toISOString().slice(0, 10),
        termination_charge: String(suggestedCharge("terminated", paidTotal)),
      });
      setPendingTerminate(row);
    },
    [getSalePaidTotal, suggestedCharge]
  );

  const openIssueDeedDialog = useCallback(
    (row: ApartmentSaleRow) => {
      if (getStatus(row.deed_status) === "issued") {
        notifyError("Ownership deed is already issued for this sale.");
        return;
      }

      const status = getStatus(row.status);
      if (status === "cancelled" || status === "terminated" || status === "defaulted") {
        notifyError("Cannot issue deed for cancelled/terminated/defaulted sale.");
        return;
      }

      const municipalityRemaining = Number(municipalityRemainingBySaleUuid.get(row.uuid) ?? 0);
      if (municipalityRemaining > 0) {
        notifyError(`Municipality remaining must be zero before deed issuance. Remaining: $${municipalityRemaining.toFixed(2)}`);
        return;
      }

      const customerRemaining = customerRemainingAmount(row, installmentPaidBySaleUuid);
      if (customerRemaining > 0) {
        notifyError(`Customer payment is not complete yet. Remaining: $${customerRemaining.toFixed(2)}`);
        return;
      }

      setDeedIssueError(null);
      setPendingIssueDeed(row);
    },
    [installmentPaidBySaleUuid, municipalityRemainingBySaleUuid]
  );



  const openDeedPrintPage = useCallback((row: ApartmentSaleRow) => {
    if (typeof window === "undefined") return;
    window.open(`/print/apartment-sales/${row.uuid}/deed`, "_blank", "noopener,noreferrer");
  }, []);

  const salesColumns = useMemo(
    () =>
      createApartmentSalesColumns({
        customerLabelById,
        apartmentLabelById,
        onPrintDeed: openDeedPrintPage,
        canManageSales,
        canIssueDeed: canApproveDeed,
        installmentPaidBySaleUuid,
        municipalityRemainingBySaleUuid,
        onHandoverKey: canManageSales ? openHandoverDialog : undefined,
        onTerminate: canManageSales ? openTerminateDialog : undefined,
        onIssueDeed: canApproveDeed ? openIssueDeedDialog : undefined,
      }),
    [
      apartmentLabelById,
      canApproveDeed,
      canManageSales,
      customerLabelById,
      installmentPaidBySaleUuid,
      municipalityRemainingBySaleUuid,
      openHandoverDialog,
      openIssueDeedDialog,
      openDeedPrintPage,
      openTerminateDialog,
    ]
  );

  const renderExpandedSaleRow = useCallback(
    (row: ApartmentSaleRow) => {
      const customerLabel = customerLabelById.get(row.customer_id) ?? `Customer #${row.customer_id}`;
      const apartmentLabel = apartmentLabelById.get(row.apartment_id) ?? `Apartment #${row.apartment_id}`;
      const paidTotal = getSalePaidTotal(row);
      const customerRemaining = customerRemainingAmount(row, installmentPaidBySaleUuid);

      const municipalityRemainingRaw = municipalityRemainingBySaleUuid.get(row.uuid);
      const municipalityRemaining =
        typeof municipalityRemainingRaw === "number" && Number.isFinite(municipalityRemainingRaw)
          ? Math.max(0, municipalityRemainingRaw)
          : 0;

      return (
        <ApartmentSaleExpandedRow
          row={row}
          customerLabel={customerLabel}
          apartmentLabel={apartmentLabel}
          paidTotal={paidTotal}
          customerRemaining={customerRemaining}
          municipalityRemaining={municipalityRemaining}
        />
      );
    },
    [apartmentLabelById, customerLabelById, getSalePaidTotal, installmentPaidBySaleUuid, municipalityRemainingBySaleUuid]
  );

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

  const closeForm = useCallback(() => {
    setEditingUuid(null);
    setFormError(null);
    setForm(createEmptyApartmentSaleForm());
  }, []);

  const openEditForm = useCallback(
    (row: ApartmentSaleRow) => {
      if (readOnly) {
        notifyError(READ_ONLY_MESSAGE);
        return;
      }

      const scope = resolveRowEditScope(row);
      if (scope === "none") {
        notifyError("Sale is locked. Use Financials button for breakdown and receipts.");
        return;
      }

      setEditingUuid(row.uuid);
      setFormError(null);
      setForm(toForm(row));
    },
    [readOnly]
  );

  const openDeleteDialog = useCallback(
    (row: ApartmentSaleRow) => {
      if (readOnly) {
        notifyError(READ_ONLY_MESSAGE);
        return;
      }

      if (resolveRowEditScope(row) !== "full") {
        notifyError("Sale cannot be deleted after approval, payment, completion, or cancellation.");
        return;
      }

      setPendingDelete(row);
    },
    [readOnly]
  );

  const handleSave = useCallback(async () => {
    if (readOnly) {
      notifyError(READ_ONLY_MESSAGE);
      return;
    }
    if (saving) return;

    setSaving(true);
    setFormError(null);

    try {
      const payload = buildSalePayload(form);
      if (!editingUuid) {
        setFormError("Only edit mode is allowed in this section.");
        return;
      }

      await apartmentSaleUpdate(editingUuid, payload);
      closeForm();
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editingUuid, form, readOnly, refresh, saving]);

  const handleDelete = useCallback(async () => {
    if (readOnly) {
      notifyError(READ_ONLY_MESSAGE);
      return;
    }
    if (!pendingDelete?.uuid) return;

    try {
      await apartmentSaleDelete(pendingDelete.uuid);
      if (editingUuid === pendingDelete.uuid) closeForm();
      setPendingDelete(null);
      await refresh();
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Delete failed.");
    }
  }, [closeForm, editingUuid, pendingDelete, readOnly, refresh]);

  const handleHandoverKey = useCallback(async () => {
    if (!canManageSales) {
      notifyError("You do not have permission to hand over keys.");
      return;
    }
    if (!pendingHandover?.uuid || handoverSubmitting) return;

    setHandoverSubmitting(true);
    setHandoverError(null);
    try {
      await apartmentSaleHandoverKey(pendingHandover.uuid);
      setPendingHandover(null);
      await refresh();
    } catch (error: unknown) {
      setHandoverError(error instanceof Error ? error.message : "Failed to hand over key.");
    } finally {
      setHandoverSubmitting(false);
    }
  }, [canManageSales, handoverSubmitting, pendingHandover, refresh]);

  const handleTerminate = useCallback(async () => {
    if (!canManageSales) {
      notifyError("You do not have permission to terminate sales.");
      return;
    }
    if (!pendingTerminate?.uuid || terminateSubmitting) return;

    const reason = terminateForm.reason.trim();
    if (!reason) {
      setTerminateError("Termination reason is required.");
      return;
    }

    const charge = Number(terminateForm.termination_charge);
    if (!Number.isFinite(charge) || charge < 0) {
      setTerminateError("Termination charge must be 0 or positive number.");
      return;
    }

    const paidTotal = getSalePaidTotal(pendingTerminate);
    if (charge > paidTotal + 0.0001) {
      setTerminateError(`Termination charge cannot exceed paid amount (${paidTotal.toFixed(2)} USD).`);
      return;
    }

    const minDefaultCharge = defaultedMinCharge(paidTotal);
    if (terminateForm.status === "defaulted" && charge + 0.0001 < minDefaultCharge) {
      setTerminateError(`Defaulted status requires at least ${minDefaultCharge.toFixed(2)} USD charge.`);
      return;
    }

    const payload: ApartmentSaleTerminateInput = {
      reason,
      status: terminateForm.status,
      vacated_at: terminateForm.vacated_at || undefined,
      termination_charge: charge,
    };

    setTerminateSubmitting(true);
    setTerminateError(null);
    try {
      await apartmentSaleTerminate(pendingTerminate.uuid, payload);
      setPendingTerminate(null);
      await refresh();
    } catch (error: unknown) {
      setTerminateError(error instanceof Error ? error.message : "Failed to terminate sale.");
    } finally {
      setTerminateSubmitting(false);
    }
  }, [canManageSales, defaultedMinCharge, getSalePaidTotal, pendingTerminate, refresh, terminateForm, terminateSubmitting]);

  const handleIssueDeed = useCallback(async () => {
    if (!canApproveDeed) {
      notifyError("Only admin users can approve and issue ownership deed.");
      return;
    }
    if (!pendingIssueDeed?.uuid || deedIssuing) return;

    setDeedIssuing(true);
    setDeedIssueError(null);
    try {
      await apartmentSaleIssueDeed(pendingIssueDeed.uuid);
      setPendingIssueDeed(null);
      await refresh();
    } catch (error: unknown) {
      setDeedIssueError(error instanceof Error ? error.message : "Failed to issue ownership deed.");
    } finally {
      setDeedIssuing(false);
    }
  }, [canApproveDeed, deedIssuing, pendingIssueDeed, refresh]);

  const terminatePaidTotal = useMemo(() => getSalePaidTotal(pendingTerminate), [getSalePaidTotal, pendingTerminate]);
  const terminateDefaultedMinCharge = useMemo(
    () => defaultedMinCharge(terminatePaidTotal),
    [defaultedMinCharge, terminatePaidTotal]
  );
  const terminateSuggestedCharge = useMemo(
    () => suggestedCharge(terminateForm.status, terminatePaidTotal),
    [suggestedCharge, terminateForm.status, terminatePaidTotal]
  );

  return (
    <ApartmentSalesContentView
      formOpen={Boolean(editingUuid)}
      form={form}
      formError={formError}
      saving={saving}
      customerOptions={customerOptions}
      apartmentOptions={apartmentOptions}
      onApartmentSelect={applyApartmentSelection}
      onFormChange={setForm}
      onFormCancel={closeForm}
      onFormSubmit={() => {
        void handleSave();
      }}
      rows={rows}
      loading={loading}
      salesColumns={salesColumns}
      renderExpandedSaleRow={renderExpandedSaleRow}
      onEdit={readOnly ? undefined : openEditForm}
      onDelete={readOnly ? undefined : openDeleteDialog}
      dialogsProps={{
        pendingDelete,
        onCloseDelete: () => setPendingDelete(null),
        onConfirmDelete: () => {
          void handleDelete();
        },
        pendingHandover,
        handoverSubmitting,
        handoverError,
        onCloseHandover: () => {
          if (handoverSubmitting) return;
          setPendingHandover(null);
          setHandoverError(null);
        },
        onConfirmHandover: () => {
          void handleHandoverKey();
        },
        pendingTerminate,
        terminateSubmitting,
        terminateError,
        terminateForm,
        onTerminateFormChange: setTerminateForm,
        onTerminateStatusChange: (nextStatus) => {
          const paidTotal = getSalePaidTotal(pendingTerminate);
          const charge = suggestedCharge(nextStatus, paidTotal);
          setTerminateForm((prev) => ({
            ...prev,
            status: nextStatus,
            termination_charge: String(charge),
          }));
        },
        terminatePaidTotal,
        terminateSuggestedCharge,
        terminateDefaultedMinCharge,
        onCloseTerminate: () => {
          if (terminateSubmitting) return;
          setPendingTerminate(null);
          setTerminateError(null);
        },
        onConfirmTerminate: () => {
          void handleTerminate();
        },
        pendingIssueDeed,
        deedIssuing,
        deedIssueError,
        onCloseIssueDeed: () => {
          if (deedIssuing) return;
          setPendingIssueDeed(null);
          setDeedIssueError(null);
        },
        onConfirmIssueDeed: () => {
          void handleIssueDeed();
        },
      }}
    />
  );
}
