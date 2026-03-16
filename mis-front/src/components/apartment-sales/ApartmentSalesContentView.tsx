"use client";

import type { ComponentProps, Dispatch, ReactNode, SetStateAction } from "react";
import type { Column } from "@/components/ui/DataTable";
import { DataTable } from "@/components/ui/DataTable";
import ApartmentSaleForm from "@/components/apartment-sales/ApartmentSaleForm";
import { ApartmentSaleDialogs } from "@/components/apartment-sales/ApartmentSaleDialogs";
import type { ApartmentSaleFormData } from "@/components/apartment-sales/apartment-sale.type";
import type { ApartmentSaleRow } from "@/db/localDB";
import { TABLE_PAGE_SIZE } from "@/components/apartment-sales/apartment-sale.page-helpers";

type SelectOption = { value: string; label: string };

type ApartmentSalesContentViewProps = {
  formOpen: boolean;
  form: ApartmentSaleFormData;
  formError: string | null;
  saving: boolean;
  customerOptions: SelectOption[];
  apartmentOptions: SelectOption[];
  onApartmentSelect: (apartmentId: string) => void;
  onFormChange: Dispatch<SetStateAction<ApartmentSaleFormData>>;
  onFormCancel: () => void;
  onFormSubmit: () => void;
  rows: ApartmentSaleRow[];
  loading: boolean;
  salesColumns: Column<ApartmentSaleRow>[];
  renderExpandedSaleRow: (row: ApartmentSaleRow) => ReactNode;
  onEdit?: (row: ApartmentSaleRow) => void;
  onDelete?: (row: ApartmentSaleRow) => void;
  dialogsProps: ComponentProps<typeof ApartmentSaleDialogs>;
};

export default function ApartmentSalesContentView({
  formOpen,
  form,
  formError,
  saving,
  customerOptions,
  apartmentOptions,
  onApartmentSelect,
  onFormChange,
  onFormCancel,
  onFormSubmit,
  rows,
  loading,
  salesColumns,
  renderExpandedSaleRow,
  onEdit,
  onDelete,
  dialogsProps,
}: ApartmentSalesContentViewProps) {
  return (
    <div className="space-y-6">
      <ApartmentSaleForm
        open={formOpen}
        mode="edit"
        value={form}
        error={formError}
        submitting={saving}
        customerOptions={customerOptions}
        apartmentOptions={apartmentOptions}
        onApartmentSelect={onApartmentSelect}
        onChange={onFormChange}
        onCancel={onFormCancel}
        onSubmit={onFormSubmit}
      />

      <DataTable
        columns={salesColumns}
        data={rows}
        loading={loading}
        compact
        mobileStack
        noHorizontalScroll
        expandableRows
        renderExpandedRow={renderExpandedSaleRow}
        onEdit={onEdit}
        onDelete={onDelete}
        searchKeys={["sale_id", "customer_id", "apartment_id", "payment_type", "status", "frequency_type", "actual_net_revenue"]}
        pageSize={TABLE_PAGE_SIZE}
      />

      <ApartmentSaleDialogs {...dialogsProps} />
    </div>
  );
}
