"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ExchangeRateRow } from "@/db/localDB";
import { formatExchangeRate } from "@/lib/currency";
import {
  exchangeRateCreate,
  exchangeRateDelete,
  exchangeRatesListLocal,
  exchangeRatesPullToLocal,
  exchangeRateUpdate,
  getActiveExchangeRateLocal,
  type ExchangeRateInput,
} from "@/modules/exchange-rates/exchange-rates.repo";

type ExchangeRateFormState = {
  rate: string;
  effective_date: string;
  is_active: "true" | "false";
  notes: string;
};

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;

function createEmptyForm(): ExchangeRateFormState {
  return {
    rate: "",
    effective_date: new Date().toISOString().slice(0, 10),
    is_active: "true",
    notes: "",
  };
}

function toForm(row: ExchangeRateRow): ExchangeRateFormState {
  return {
    rate: String(row.rate ?? 0),
    effective_date: row.effective_date ? new Date(row.effective_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    is_active: row.is_active ? "true" : "false",
    notes: row.notes ?? "",
  };
}

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

export default function ExchangeRatesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ExchangeRateRow[]>([]);
  const [activeRate, setActiveRate] = useState<ExchangeRateRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExchangeRateRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExchangeRateRow | null>(null);
  const [form, setForm] = useState<ExchangeRateFormState>(createEmptyForm());

  const loadLocal = useCallback(async () => {
    const [page, currentActive] = await Promise.all([
      exchangeRatesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      getActiveExchangeRateLocal(),
    ]);
    setRows(page.items);
    setActiveRate(currentActive);
  }, []);

  const refresh = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      try {
        await exchangeRatesPullToLocal();
      } catch {
        // Keep local data if pull fails.
      }
      await loadLocal();
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh(false);
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const columns = useMemo<Column<ExchangeRateRow>[]>(
    () => [
      {
        key: "rate",
        label: "Official Rate",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold">{formatExchangeRate(Number(item.rate ?? 0))}</div>
            <div className="text-xs text-slate-500">{item.notes || item.source || "Manual official rate"}</div>
          </div>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        render: (item) => <Badge color={item.is_active ? "emerald" : "slate"}>{item.is_active ? "Active" : "Inactive"}</Badge>,
      },
      { key: "effective_date", label: "Effective Date", render: (item) => <span>{toDateLabel(item.effective_date)}</span> },
      { key: "approved_by_user_name", label: "Updated By", render: (item) => <span>{item.approved_by_user_name || "-"}</span> },
      { key: "updated_at", label: "Updated", render: (item) => <span>{toDateLabel(item.updated_at)}</span> },
    ],
    []
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormError(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: ExchangeRateRow) => {
    setEditing(row);
    setForm(toForm(row));
    setFormError(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormError(null);
    setFormOpen(false);
  }, []);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: ExchangeRateInput = {
        rate: Number(form.rate),
        effective_date: form.effective_date,
        is_active: form.is_active === "true",
        notes: form.notes || null,
        source: "manual",
      };

      if (editing?.uuid) {
        await exchangeRateUpdate(editing.uuid, payload);
      } else {
        await exchangeRateCreate(payload);
      }

      closeForm();
      await refresh(false);
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save exchange rate.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editing?.uuid, form, refresh, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete?.uuid) return;
    try {
      await exchangeRateDelete(pendingDelete.uuid);
      setPendingDelete(null);
      await refresh(false);
    } catch (error) {
      console.error("Exchange rate delete failed", error);
    }
  }, [pendingDelete, refresh]);

  return (
    <RequirePermission permission="exchange_rates.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Exchange Rates"
          subtitle="Maintain the official daily USD to AFN rate used for account postings and offline salary conversion"
        >
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Create Exchange Rate
          </button>
        </PageHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Active Official Rate</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
              {activeRate ? formatExchangeRate(Number(activeRate.rate ?? 0)) : "No active rate"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Effective Date</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{toDateLabel(activeRate?.effective_date)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Cached Rate Records</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{rows.length}</div>
          </div>
        </div>

        <div className="mt-6">
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            onEdit={openEdit}
            onDelete={setPendingDelete}
            canDelete={(row) => row.can_delete !== false}
            searchKeys={["base_currency", "quote_currency", "source", "approved_by_user_name", "notes"]}
            pageSize={TABLE_PAGE_SIZE}
            compact
          />
        </div>
      </div>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Exchange Rate" : "Create Exchange Rate"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Official Rate (AFN per 1 USD)"
              type="number"
              value={form.rate}
              onChange={(value) => setForm((prev) => ({ ...prev, rate: String(value) }))}
              required
            />
            <FormField
              label="Effective Date"
              type="date"
              value={form.effective_date}
              onChange={(value) => setForm((prev) => ({ ...prev, effective_date: String(value) }))}
              required
            />
            <FormField
              label="Status"
              type="select"
              value={form.is_active}
              onChange={(value) => setForm((prev) => ({ ...prev, is_active: String(value) as ExchangeRateFormState["is_active"] }))}
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
              required
            />
          </div>
          <FormField
            label="Notes"
            type="textarea"
            value={form.notes}
            onChange={(value) => setForm((prev) => ({ ...prev, notes: String(value) }))}
            rows={4}
            placeholder="Optional note about where this official rate came from."
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void submit();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editing ? "Update Exchange Rate" : "Create Exchange Rate"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete Exchange Rate"
        message={`Are you sure you want to delete the rate ${pendingDelete ? formatExchangeRate(Number(pendingDelete.rate ?? 0)) : ""}?`}
      />
    </RequirePermission>
  );
}
