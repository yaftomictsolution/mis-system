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
type SaleFilterTab = "all" | "pending-approval";

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
  showApprovalFilterTabs?: boolean;
  activeFilterTab?: SaleFilterTab;
  pendingApprovalCount?: number;
  onFilterTabChange?: (tab: SaleFilterTab) => void;
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
  showApprovalFilterTabs = false,
  activeFilterTab = "all",
  pendingApprovalCount = 0,
  onFilterTabChange,
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

      {showApprovalFilterTabs ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sales Review</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch to pending approvals to review newly created sales faster.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
              <button
                type="button"
                onClick={() => onFilterTabChange?.("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilterTab === "all"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#12121a] dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All Sales
              </button>
              <button
                type="button"
                onClick={() => onFilterTabChange?.("pending-approval")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilterTab === "pending-approval"
                    ? "bg-amber-50 text-amber-800 shadow-sm dark:bg-amber-500/10 dark:text-amber-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Pending Sales Approval
                <span className="ml-2 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] dark:bg-[#12121a]">
                  {pendingApprovalCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
