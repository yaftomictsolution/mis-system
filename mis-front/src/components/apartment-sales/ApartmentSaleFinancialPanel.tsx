"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import type { ApartmentSaleFinancialRow } from "@/db/localDB";
import type {
  MunicipalityLetter,
  MunicipalityReceipt,
} from "@/modules/apartment-sale-financials/municipality-workflow.repo";

const money = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

export type FinancialFormData = {
  delivered_to_municipality: string;
  discount_or_contractor_deduction: string;
};

export type ReceiptFormData = {
  amount: string;
  payment_date: string;
  payment_method: "cash" | "bank" | "transfer" | "cheque";
  receipt_no: string;
  notes: string;
};

export type CompanyInstallmentPaymentRow = {
  uuid: string;
  installment_no: number;
  due_date: number;
  amount: number;
  paid_amount: number;
  status: string;
  company_share_amount: number;
  company_share_paid: number;
  company_share_remaining: number;
};

export const createEmptyFinancialForm = (): FinancialFormData => ({
  delivered_to_municipality: "0",
  discount_or_contractor_deduction: "0",
});

export const toFinancialForm = (row: ApartmentSaleFinancialRow): FinancialFormData => ({
  delivered_to_municipality: String(row.delivered_to_municipality ?? 0),
  discount_or_contractor_deduction: String(row.discount_or_contractor_deduction ?? 0),
});

export const createEmptyReceiptForm = (): ReceiptFormData => ({
  amount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: "cash",
  receipt_no: "",
  notes: "",
});

type ApartmentSaleFinancialPanelProps = {
  open: boolean;
  financialLoading: boolean;
  financial: ApartmentSaleFinancialRow | null;
  financialForm: FinancialFormData;
  financialSaving: boolean;
  financialError: string | null;
  onFinancialFormChange: Dispatch<SetStateAction<FinancialFormData>>;
  onFinancialReset: () => void;
  onFinancialSave: () => void;
  deedStatus: string;
  deedIssuedAtLabel: string;
  saleLabel: string;
  deedBlockReason: string | null;
  canIssueDeed: boolean;
  deedIssuing: boolean;
  onIssueDeed: () => void;
  showIssueDeedAction?: boolean;
  municipalityLetter: MunicipalityLetter | null;
  letterLoading: boolean;
  letterError: string | null;
  onGenerateLetter: () => void;
  onPrintLetter: () => void;
  receiptForm: ReceiptFormData;
  receiptRows: MunicipalityReceipt[];
  receiptLoading: boolean;
  receiptSaving: boolean;
  receiptError: string | null;
  onReceiptFormChange: Dispatch<SetStateAction<ReceiptFormData>>;
  onReceiptSave: () => Promise<boolean>;
  companyInstallmentRows: CompanyInstallmentPaymentRow[];
  companyInstallmentLoading: boolean;
};

export default function ApartmentSaleFinancialPanel({
  open,
  financialLoading,
  financial,
  financialForm,
  financialSaving,
  financialError,
  onFinancialFormChange,
  onFinancialReset,
  onFinancialSave,
  deedStatus,
  deedIssuedAtLabel,
  saleLabel,
  deedBlockReason,
  canIssueDeed,
  deedIssuing,
  onIssueDeed,
  showIssueDeedAction = true,
  municipalityLetter,
  letterLoading,
  letterError,
  onGenerateLetter,
  onPrintLetter,
  receiptForm,
  receiptRows,
  receiptLoading,
  receiptSaving,
  receiptError,
  onReceiptFormChange,
  onReceiptSave,
  companyInstallmentRows,
  companyInstallmentLoading,
}: ApartmentSaleFinancialPanelProps) {
  if (!open) return null;

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const remainingMunicipality = Number(financial?.remaining_municipality ?? 0);
  const canAddReceipt = Number.isFinite(remainingMunicipality) && remainingMunicipality > 0;

  const toDate = (value: number): string => {
    if (!value || !Number.isFinite(value)) return "-";
    return new Date(value).toLocaleDateString();
  };

  const handleReceiptSubmit = async () => {
    const ok = await onReceiptSave();
    if (ok) {
      setReceiptModalOpen(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Sale Financial Breakdown</h2>

      {financialLoading ? (
        <p className="text-sm text-slate-500">Loading financials...</p>
      ) : !financial ? (
        <p className="text-sm text-slate-500">Financial breakdown is not available for this sale yet.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Financial Snapshot</h3>
                  <p className="text-sm text-slate-500">Auto-calculated summary based on sale, installments, and municipality receipts.</p>
                </div>
                <div className="inline-flex w-fit items-center rounded-md bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700 dark:bg-[#1a1a2e] dark:text-slate-200">
                  Accounts: {financial.accounts_status || "open"}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Municipality Share (15%)</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{money(financial.municipality_share_15)}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Remaining Municipality</div>
                  <div className="mt-1 text-base font-semibold text-amber-700 dark:text-amber-300">{money(financial.remaining_municipality)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Company Share (85%)</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{money(financial.company_share_85)}</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                  <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">Customer Debt</div>
                  <div className="mt-1 text-base font-semibold text-red-700 dark:text-red-300">{money(financial.customer_debt)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a3e] dark:bg-[#12121a]">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Delivered to Municipality</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{money(financial.delivered_to_municipality)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Adjustment Summary</h3>
              <p className="mt-1 text-sm text-slate-500">Manual adjustments currently applied to this sale.</p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Delivered to Municipality</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{money(Number(financialForm.delivered_to_municipality || 0))}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#2a2a3e] dark:bg-[#0f111a]">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Discount / Contractor Deduction</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{money(Number(financialForm.discount_or_contractor_deduction || 0))}</span>
                </div>
              </div>
            </section>
          </div>

          {financialError && <p className="mt-2 text-sm text-red-600">{financialError}</p>}

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-[#2a2a3e]">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Company Share Installments (85%)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Installment-level company share tracking derived from each installment amount and paid amount.
            </p>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a3e]">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-[#0f111a] dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Installment #</th>
                    <th className="px-3 py-2">Due Date</th>
                    <th className="px-3 py-2">Installment</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Company 85%</th>
                    <th className="px-3 py-2">Company Paid</th>
                    <th className="px-3 py-2">Company Remaining</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companyInstallmentLoading ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={8}>
                        Loading company installment rows...
                      </td>
                    </tr>
                  ) : companyInstallmentRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={8}>
                        No installment rows found for this sale.
                      </td>
                    </tr>
                  ) : (
                    companyInstallmentRows.map((row) => (
                      <tr key={row.uuid} className="border-t border-slate-200 dark:border-[#2a2a3e]">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{row.installment_no}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{toDate(row.due_date)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{money(row.amount)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{money(row.paid_amount)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{money(row.company_share_amount)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{money(row.company_share_paid)}</td>
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{money(row.company_share_remaining)}</td>
                        <td className="px-3 py-2 capitalize text-slate-600 dark:text-slate-300">{row.status || "pending"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-[#2a2a3e]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Municipality Receipts</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Record municipality payments. Each receipt automatically updates remaining municipality and apartment status.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Remaining municipality: <span className="font-semibold">{money(Math.max(0, remainingMunicipality))}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={!canAddReceipt}
                onClick={() => setReceiptModalOpen(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {canAddReceipt ? "Add Receipt" : "Municipality Settled"}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a3e]">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-[#0f111a] dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Receipt #</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptLoading ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={4}>
                        Loading receipts...
                      </td>
                    </tr>
                  ) : receiptRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={4}>
                        No municipality receipts yet.
                      </td>
                    </tr>
                  ) : (
                    receiptRows.map((item) => (
                      <tr key={item.uuid} className="border-t border-slate-200 dark:border-[#2a2a3e]">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{item.receipt_no}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.payment_date}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.payment_method}</td>
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{money(item.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Modal
              isOpen={receiptModalOpen}
              onClose={() => {
                if (receiptSaving) return;
                setReceiptModalOpen(false);
              }}
              title="Add Municipality Receipt"
              size="md"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="Receipt Amount"
                  type="number"
                  value={Number(receiptForm.amount || 0)}
                  onChange={(value) => onReceiptFormChange((prev) => ({ ...prev, amount: String(value) }))}
                  required
                />
                <FormField
                  label="Payment Date"
                  type="date"
                  value={receiptForm.payment_date}
                  onChange={(value) => onReceiptFormChange((prev) => ({ ...prev, payment_date: String(value) }))}
                  required
                />
                <FormField
                  label="Payment Method"
                  type="select"
                  value={receiptForm.payment_method}
                  onChange={(value) =>
                    onReceiptFormChange((prev) => ({
                      ...prev,
                      payment_method: String(value) as ReceiptFormData["payment_method"],
                    }))
                  }
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "bank", label: "Bank" },
                    { value: "transfer", label: "Transfer" },
                    { value: "cheque", label: "Cheque" },
                  ]}
                  required
                />
                <FormField
                  label="Receipt No (optional)"
                  value={receiptForm.receipt_no}
                  onChange={(value) => onReceiptFormChange((prev) => ({ ...prev, receipt_no: String(value) }))}
                />
                <FormField
                  label="Notes (optional)"
                  value={receiptForm.notes}
                  onChange={(value) => onReceiptFormChange((prev) => ({ ...prev, notes: String(value) }))}
                />
              </div>

                  {receiptError && <p className="mt-3 text-sm text-red-600">{receiptError}</p>}
                  {!canAddReceipt && (
                    <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                      Municipality share is fully paid. New receipts are disabled.
                    </p>
                  )}

                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={receiptSaving}
                  onClick={() => setReceiptModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                    <button
                      type="button"
                      disabled={receiptSaving || !canAddReceipt}
                      onClick={() => {
                        void handleReceiptSubmit();
                      }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {receiptSaving ? "Saving..." : "Save Receipt"}
                </button>
              </div>
            </Modal>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-[#2a2a3e]">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Ownership Deed</h3>
            <p className="mt-1 text-sm text-slate-500">
              Deed can be issued only after sale completion, zero customer debt, and zero remaining municipality share.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-[#2a2a3e]">
                <div className="text-xs text-slate-500">Deed Status</div>
                <div className="mt-1 text-base font-semibold capitalize text-slate-900 dark:text-white">{deedStatus.replace(/_/g, " ")}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-[#2a2a3e]">
                <div className="text-xs text-slate-500">Issued At</div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{deedIssuedAtLabel}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-[#2a2a3e]">
                <div className="text-xs text-slate-500">Sale</div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{saleLabel}</div>
              </div>
            </div>

            {deedBlockReason && <p className="mt-3 text-sm text-amber-600">{deedBlockReason}</p>}
            {showIssueDeedAction ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={!canIssueDeed || deedIssuing}
                  onClick={onIssueDeed}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deedIssuing ? "Issuing..." : "Issue Ownership Deed"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Use the deed action from the apartment sales list to issue ownership deed.</p>
            )}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-[#2a2a3e]">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Municipality Letter</h3>
            <p className="mt-1 text-sm text-slate-500">
              Letter is auto-generated when you create a sale. You can regenerate and print anytime.
            </p>
            {letterError && <p className="mt-2 text-sm text-red-600">{letterError}</p>}
            {municipalityLetter && (
              <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-[#2a2a3e]">
                <div className="font-medium text-slate-900 dark:text-white">{municipalityLetter.letter_no}</div>
                <div className="text-slate-500">
                  Issued: {municipalityLetter.issued_at ? new Date(municipalityLetter.issued_at).toLocaleString() : "-"}
                </div>
                <div className="text-slate-500">
                  Share: {money(municipalityLetter.municipality_share_amount)} | Remaining: {money(municipalityLetter.remaining_municipality)}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={letterLoading}
                onClick={onGenerateLetter}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                {letterLoading ? "Generating..." : "Generate / Refresh Letter"}
              </button>
              <button
                type="button"
                disabled={!municipalityLetter || letterLoading}
                onClick={onPrintLetter}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Print Letter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
