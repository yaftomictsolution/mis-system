"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlusCircle, Trash2 } from "lucide-react";
import { DocumentFileDropzone } from "@/components/documents/DocumentFileDropzone";
import { FormField } from "@/components/ui/FormField";
import type {
  ApartmentSaleCustomDate,
  ApartmentSaleFormData,
  InstallmentFrequency,
} from "@/components/apartment-sales/apartment-sale.type";
import { statusFromPaymentType } from "@/components/apartment-sales/apartment-sale.type";
import type { DocumentTypeOption } from "@/modules/documents/documents.repo";

type Option = { value: string; label: string };

type ApartmentSaleFormProps = {
  open: boolean;
  mode: "create" | "edit";
  value: ApartmentSaleFormData;
  error?: string | null;
  submitting?: boolean;
  customerOptions: Option[];
  apartmentOptions: Option[];
  saleDocumentTypes?: DocumentTypeOption[];
  selectedSaleDocumentType?: string;
  saleFiles?: File[];
  loadingSaleDocumentTypes?: boolean;
  onApartmentSelect: (apartmentId: string) => void;
  onSaleDocumentTypeChange?: (value: string) => void;
  onSaleFilesChange?: (files: File[]) => void;
  onRemoveSaleFile?: (index: number) => void;
  onClearSaleFiles?: () => void;
  onChange: Dispatch<SetStateAction<ApartmentSaleFormData>>;
  onCancel: () => void;
  onSubmit: () => void;
};

const normalizeCustomDates = (rows: ApartmentSaleCustomDate[]) =>
  rows.map((item, idx) => ({
    installment_no: idx + 1,
    due_date: item.due_date,
    amount: item.amount,
  }));

export default function ApartmentSaleForm({
  open,
  mode,
  value,
  error,
  submitting = false,
  customerOptions,
  apartmentOptions,
  saleDocumentTypes = [],
  selectedSaleDocumentType = "",
  saleFiles = [],
  loadingSaleDocumentTypes = false,
  onApartmentSelect,
  onSaleDocumentTypeChange = () => {},
  onSaleFilesChange = () => {},
  onRemoveSaleFile = () => {},
  onClearSaleFiles = () => {},
  onChange,
  onCancel,
  onSubmit,
}: ApartmentSaleFormProps) {
  const isEditing = mode === "edit";
  const selectedSaleDocumentTypeLabel =
    saleDocumentTypes.find((item) => item.value === selectedSaleDocumentType)?.label ?? "document type";

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mb-6 overflow-hidden"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Update Apartment Sale" : "Create Apartment Sale"}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="Apartment"
                type="select"
                value={value.apartment_id}
                onChange={(val) => onApartmentSelect(String(val))}
                options={apartmentOptions}
                placeholder={apartmentOptions.length ? "Select apartment" : "No apartments available"}
                required
              />
              <FormField
                label="Customer"
                type="select"
                value={value.customer_id}
                onChange={(val) => onChange((prev) => ({ ...prev, customer_id: String(val) }))}
                options={customerOptions}
                placeholder={customerOptions.length ? "Select customer" : "No customers available"}
                required
              />
              <FormField
                label="Sale Date"
                type="date"
                value={value.sale_date}
                onChange={(val) => onChange((prev) => ({ ...prev, sale_date: String(val) }))}
                required
              />
              <FormField
                label="Payment Type"
                type="select"
                value={value.payment_type}
                onChange={(val) =>
                  onChange((prev) => {
                    const paymentType = val as "full" | "installment";
                    return {
                      ...prev,
                      payment_type: paymentType,
                      status: statusFromPaymentType(paymentType),
                      receive_full_payment_now: paymentType === "full" ? prev.receive_full_payment_now : false,
                      payment_account_id: paymentType === "full" ? prev.payment_account_id : "",
                      payment_date: paymentType === "full" ? prev.payment_date : prev.sale_date,
                    };
                  })
                }
                options={[
                  { value: "full", label: "Full" },
                  { value: "installment", label: "Installment" },
                ]}
                required
              />
              <FormField
                label="Total Price"
                type="number"
                value={value.total_price}
                onChange={(val) => onChange((prev) => ({ ...prev, total_price: String(val) }))}
                required
              />
              <FormField
                label="Discount"
                type="number"
                value={value.discount}
                onChange={(val) => onChange((prev) => ({ ...prev, discount: String(val) }))}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Status (Auto)</label>
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium capitalize text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-200">
                  {value.status}
                </div>
              </div>

              {value.payment_type === "installment" && (
                <>
                  <FormField
                    label="Frequency"
                    type="select"
                    value={value.frequency_type}
                    onChange={(val) =>
                      onChange((prev) => ({
                        ...prev,
                        frequency_type: val as InstallmentFrequency,
                        custom_dates:
                          val === "custom_dates" && prev.custom_dates.length === 0
                            ? [{ installment_no: 1, due_date: "", amount: "" }]
                            : prev.custom_dates,
                      }))
                    }
                    options={[
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "quarterly", label: "Quarterly" },
                      { value: "custom_dates", label: "Custom Dates" },
                    ]}
                    required
                  />

                  {value.frequency_type === "custom_dates" ? (
                    <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 p-3 dark:border-[#2a2a3e]">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom Installment Dates</div>
                        <button
                          type="button"
                          onClick={() =>
                            onChange((prev) => ({
                              ...prev,
                              custom_dates: normalizeCustomDates([
                                ...prev.custom_dates,
                                { installment_no: prev.custom_dates.length + 1, due_date: "", amount: "" },
                              ]),
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <PlusCircle size={14} />
                          Add Row
                        </button>
                      </div>
                      {value.custom_dates.map((item, index) => (
                        <div key={`${item.installment_no}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr_1fr_auto]">
                          <input
                            type="text"
                            value={`#${index + 1}`}
                            disabled
                            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400"
                          />
                          <input
                            type="date"
                            value={item.due_date}
                            onChange={(e) =>
                              onChange((prev) => {
                                const next = [...prev.custom_dates];
                                const current = next[index];
                                if (!current) return prev;
                                next[index] = { ...current, due_date: e.target.value };
                                return { ...prev, custom_dates: normalizeCustomDates(next) };
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                          />
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) =>
                              onChange((prev) => {
                                const next = [...prev.custom_dates];
                                const current = next[index];
                                if (!current) return prev;
                                next[index] = { ...current, amount: e.target.value };
                                return { ...prev, custom_dates: normalizeCustomDates(next) };
                              })
                            }
                            placeholder="Amount"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onChange((prev) => ({
                                ...prev,
                                custom_dates: normalizeCustomDates(prev.custom_dates.filter((_, i) => i !== index)),
                              }))
                            }
                            className="rounded-lg border border-red-200 px-2 py-2 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <FormField
                        label="Installment Count"
                        type="number"
                        value={value.installment_count}
                        onChange={(val) => onChange((prev) => ({ ...prev, installment_count: String(val) }))}
                        required
                      />
                      <FormField
                        label="First Due Date"
                        type="date"
                        value={value.first_due_date}
                        onChange={(val) => onChange((prev) => ({ ...prev, first_due_date: String(val) }))}
                        required
                      />
                    </>
                  )}
                </>
              )}

              <div className="md:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={value.schedule_locked}
                    onChange={(e) => onChange((prev) => ({ ...prev, schedule_locked: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Lock payment schedule after approval
                </label>
              </div>

              {mode === "create" ? (
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2a2a3e] dark:bg-[#0a0a0f]">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sale Documents</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Attach one or more files while creating the sale. Document type CRUD is available from the Documents page.
                      </p>
                    </div>
                    <div className="w-full md:max-w-xs">
                      <FormField
                        label="Document Type"
                        type="select"
                        value={selectedSaleDocumentType}
                        onChange={(val) => onSaleDocumentTypeChange(String(val))}
                        options={saleDocumentTypes.map((item) => ({ value: item.value, label: item.label }))}
                        placeholder={loadingSaleDocumentTypes ? "Loading types..." : "Select document type"}
                        disabled={loadingSaleDocumentTypes || saleDocumentTypes.length === 0 || submitting}
                      />
                    </div>
                  </div>

                  <DocumentFileDropzone
                    files={saleFiles}
                    onFilesChange={onSaleFilesChange}
                    onRemoveFile={onRemoveSaleFile}
                    onClearFiles={onClearSaleFiles}
                    disabled={submitting}
                    showSummary={false}
                    title="Drop sale files here"
                    subtitle={`Upload multiple files and attach them as ${selectedSaleDocumentTypeLabel} once the sale is created.`}
                    summaryTitle="Attachment Summary"
                    summaryText="Each file will be attached as its own document record after the sale is saved."
                    summaryDetails={[
                      { label: "Document Type", value: selectedSaleDocumentTypeLabel },
                      { label: "Files Ready", value: String(saleFiles.length) },
                    ]}
                  />
                </div>
              ) : null}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (isEditing ? "Updating..." : "Saving...") : isEditing ? "Update Sale" : "Create Sale"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
