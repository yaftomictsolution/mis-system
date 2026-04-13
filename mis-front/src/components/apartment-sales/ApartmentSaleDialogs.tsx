"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/modal";
import type { ApartmentSaleRow } from "@/db/localDB";

export type ApartmentSaleTerminateFormState = {
  reason: string;
  status: "terminated" | "defaulted";
  vacated_at: string;
  termination_charge: string;
};

type ApartmentSaleDialogsProps = {
  pendingDelete: ApartmentSaleRow | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  pendingApprove: ApartmentSaleRow | null;
  onCloseApprove: () => void;
  onConfirmApprove: () => void;
  pendingReject: ApartmentSaleRow | null;
  onCloseReject: () => void;
  onConfirmReject: () => void;
  pendingHandover: ApartmentSaleRow | null;
  handoverSubmitting: boolean;
  handoverError: string | null;
  onCloseHandover: () => void;
  onConfirmHandover: () => void;
  pendingTerminate: ApartmentSaleRow | null;
  terminateSubmitting: boolean;
  terminateError: string | null;
  terminateForm: ApartmentSaleTerminateFormState;
  onTerminateFormChange: (next: ApartmentSaleTerminateFormState) => void;
  onTerminateStatusChange: (nextStatus: "terminated" | "defaulted") => void;
  terminatePaidTotal: number;
  terminateSuggestedCharge: number;
  terminateDefaultedMinCharge: number;
  onCloseTerminate: () => void;
  onConfirmTerminate: () => void;
  pendingIssueDeed: ApartmentSaleRow | null;
  deedIssuing: boolean;
  deedIssueError: string | null;
  onCloseIssueDeed: () => void;
  onConfirmIssueDeed: () => void;
};

/**
 * Centralized dialogs for sale actions (delete, handover, terminate, deed).
 */
export function ApartmentSaleDialogs({
  pendingDelete,
  onCloseDelete,
  onConfirmDelete,
  pendingApprove,
  onCloseApprove,
  onConfirmApprove,
  pendingReject,
  onCloseReject,
  onConfirmReject,
  pendingHandover,
  handoverSubmitting,
  handoverError,
  onCloseHandover,
  onConfirmHandover,
  pendingTerminate,
  terminateSubmitting,
  terminateError,
  terminateForm,
  onTerminateFormChange,
  onTerminateStatusChange,
  terminatePaidTotal,
  terminateSuggestedCharge,
  terminateDefaultedMinCharge,
  onCloseTerminate,
  onConfirmTerminate,
  pendingIssueDeed,
  deedIssuing,
  deedIssueError,
  onCloseIssueDeed,
  onConfirmIssueDeed,
}: ApartmentSaleDialogsProps) {
  return (
    <>
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Delete Sale"
        message={`Are you sure you want to delete sale ${pendingDelete?.sale_id ?? pendingDelete?.uuid ?? ""}? This action cannot be undone.`}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingApprove)}
        onClose={onCloseApprove}
        onConfirm={onConfirmApprove}
        title="Approve Sale"
        message={`Approve sale ${pendingApprove?.sale_id ?? pendingApprove?.uuid ?? ""}? This will unlock payment, municipality, and the rest of the sale workflow.`}
        confirmLabel="Approve Sale"
        confirmVariant="success"
      />

      <ConfirmDialog
        isOpen={Boolean(pendingReject)}
        onClose={onCloseReject}
        onConfirm={onConfirmReject}
        title="Reject Sale"
        message={`Reject sale ${pendingReject?.sale_id ?? pendingReject?.uuid ?? ""}? This will cancel the sale and block payment workflow.`}
        confirmLabel="Reject Sale"
      />

      <Modal isOpen={Boolean(pendingHandover)} onClose={onCloseHandover} title="Handover Apartment Key" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Confirm key handover for sale{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {pendingHandover?.sale_id || pendingHandover?.uuid || "-"}
            </span>
            . This marks possession as started and apartment status as handed over.
          </p>
          {handoverError && <p className="text-sm text-red-600">{handoverError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={handoverSubmitting}
              onClick={onCloseHandover}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={handoverSubmitting}
              onClick={onConfirmHandover}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {handoverSubmitting ? "Processing..." : "Confirm Handover"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(pendingTerminate)} onClose={onCloseTerminate} title="Terminate / Default Sale" size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Termination Reason *</label>
            <textarea
              value={terminateForm.reason}
              onChange={(event) => onTerminateFormChange({ ...terminateForm, reason: event.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
              placeholder="Reason for default/termination"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select
                value={terminateForm.status}
                onChange={(event) => onTerminateStatusChange(event.target.value as "terminated" | "defaulted")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
              >
                <option value="terminated">Terminated</option>
                <option value="defaulted">Defaulted</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Vacated Date</label>
              <input
                type="date"
                value={terminateForm.vacated_at}
                onChange={(event) => onTerminateFormChange({ ...terminateForm, vacated_at: event.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Termination Charge (USD)</label>
            <input
              type="number"
              value={terminateForm.termination_charge}
              onChange={(event) => onTerminateFormChange({ ...terminateForm, termination_charge: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-[#0f111a] dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {`Paid total: ${terminatePaidTotal.toFixed(2)} USD | Suggested: ${terminateSuggestedCharge.toFixed(2)} USD`}
              {terminateForm.status === "defaulted"
                ? ` | Minimum for defaulted: ${terminateDefaultedMinCharge.toFixed(2)} USD`
                : ""}
            </p>
          </div>

          {terminateError && <p className="text-sm text-red-600">{terminateError}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={terminateSubmitting}
              onClick={onCloseTerminate}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={terminateSubmitting}
              onClick={onConfirmTerminate}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {terminateSubmitting ? "Processing..." : "Confirm Termination"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(pendingIssueDeed)} onClose={onCloseIssueDeed} title="Issue Ownership Deed" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Issue ownership deed for sale{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {pendingIssueDeed?.sale_id || pendingIssueDeed?.uuid || "-"}
            </span>
            . The system will verify installment completion and municipality settlement before issuing.
          </p>
          {deedIssueError && <p className="text-sm text-red-600">{deedIssueError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={deedIssuing}
              onClick={onCloseIssueDeed}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deedIssuing}
              onClick={onConfirmIssueDeed}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deedIssuing ? "Issuing..." : "Issue Deed"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
