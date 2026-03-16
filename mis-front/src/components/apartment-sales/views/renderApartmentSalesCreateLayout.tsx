"use client";

import { Plus } from "lucide-react";
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import ApartmentSaleForm from "@/components/apartment-sales/ApartmentSaleForm";
import ApartmentSalesPageContent from "@/components/apartment-sales/ApartmentSalesPageContent";
import type { ApartmentSalesCreateModel } from "@/components/apartment-sales/hooks/useApartmentSalesCreate";

/**
 * Renders the create section and embeds the sales content area.
 */
export function renderApartmentSalesCreateLayout(model: ApartmentSalesCreateModel) {
  return (
    <RequirePermission permission="sales.create">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Apartment Sales" subtitle={model.readOnly ? "Read-only mode for non-admin users" : "Manage sales with full/installment plans"}>
          {!model.readOnly && <button type="button" onClick={model.toggleCreateForm} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"><Plus size={16} />{model.formOpen ? "Hide Form" : "Create Sale"}</button>}
        </PageHeader>
        <ApartmentSaleForm open={model.formOpen} mode="create" value={model.form} error={model.formError} submitting={model.saving} customerOptions={model.customerOptions} apartmentOptions={model.apartmentOptions} onApartmentSelect={model.applyApartmentSelection} onChange={model.setForm} onCancel={model.closeCreateForm} onSubmit={model.submitCreate} />
        <ApartmentSalesPageContent refreshKey={model.refreshKey} />
      </div>
    </RequirePermission>
  );
}

