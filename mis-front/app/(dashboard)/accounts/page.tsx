"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AccountRow, AccountTransactionRow } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  accountCreate,
  accountDelete,
  accountTransactionsListLocal,
  accountTransactionsPullToLocal,
  accountsListLocal,
  accountsPullToLocal,
  accountUpdate,
  type AccountInput,
} from "@/modules/accounts/accounts.repo";
import {
  documentTypeCreate,
  documentTypeDelete,
  documentTypesListLocal,
  documentTypesPullToLocal,
  documentTypeUpdate,
  type DocumentTypeInput,
  type DocumentTypeModuleKey,
  type DocumentTypeRow,
} from "@/modules/document-types/document-types.repo";

type AccountFormState = {
  name: string;
  account_type: string;
  bank_name: string;
  account_number: string;
  currency: string;
  opening_balance: string;
  status: "active" | "inactive";
  notes: string;
};

type AccountTypeFormState = {
  label: string;
  is_active: "true" | "false";
};

type AccountTypeOption = {
  value: string;
  label: string;
};

const ACCOUNT_TYPE_MODULE: DocumentTypeModuleKey = "accounts";
const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const ACCOUNT_TYPE_PAGE_SIZE = 8;

const DEFAULT_ACCOUNT_TYPES: AccountTypeOption[] = [
  { value: "office", label: "Office" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "personal", label: "Personal" },
];

function money(value: number, currency = "USD"): string {
  return formatMoney(value, normalizeCurrency(currency));
}

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleString();
}

function createEmptyForm(defaultType = "office"): AccountFormState {
  return {
    name: "",
    account_type: defaultType,
    bank_name: "",
    account_number: "",
    currency: "USD",
    opening_balance: "0",
    status: "active",
    notes: "",
  };
}

function createEmptyAccountTypeForm(): AccountTypeFormState {
  return {
    label: "",
    is_active: "true",
  };
}

function toForm(row: AccountRow): AccountFormState {
  return {
    name: row.name,
    account_type: String(row.account_type || "office"),
    bank_name: row.bank_name ?? "",
    account_number: row.account_number ?? "",
    currency: row.currency || "USD",
    opening_balance: String(row.opening_balance ?? 0),
    status: (row.status as AccountFormState["status"]) || "active",
    notes: row.notes ?? "",
  };
}

function toAccountTypeForm(row: DocumentTypeRow): AccountTypeFormState {
  return {
    label: row.label,
    is_active: row.is_active ? "true" : "false",
  };
}

function buildAccountTypeLabelMap(rows: DocumentTypeRow[]): Map<string, string> {
  const labels = new Map<string, string>();

  for (const item of DEFAULT_ACCOUNT_TYPES) {
    labels.set(item.value, item.label);
  }

  for (const row of rows) {
    const code = String(row.code ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!code || !label) continue;
    labels.set(code, label);
  }

  return labels;
}

function buildAccountTypeOptions(
  rows: DocumentTypeRow[],
  currentType: string | null | undefined,
): AccountTypeOption[] {
  const options = new Map<string, string>();

  for (const row of rows) {
    const code = String(row.code ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!row.is_active || !code || !label) continue;
    options.set(code, label);
  }

  for (const item of DEFAULT_ACCOUNT_TYPES) {
    if (!options.has(item.value)) {
      options.set(item.value, item.label);
    }
  }

  const currentCode = String(currentType ?? "").trim();
  if (currentCode && !options.has(currentCode)) {
    const currentLabel =
      rows.find((row) => String(row.code ?? "").trim() === currentCode)?.label ??
      DEFAULT_ACCOUNT_TYPES.find((item) => item.value === currentCode)?.label ??
      currentCode.replaceAll("_", " ");

    options.set(currentCode, currentLabel);
  }

  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function badgeColorForAccountType(code: string): "blue" | "purple" | "emerald" | "slate" {
  const normalized = code.trim().toLowerCase();
  if (normalized === "bank") return "blue";
  if (normalized === "personal") return "purple";
  if (normalized === "cash" || normalized === "office") return "emerald";
  return "slate";
}

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [transactions, setTransactions] = useState<AccountTransactionRow[]>([]);
  const [accountTypeRows, setAccountTypeRows] = useState<DocumentTypeRow[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountRow | null>(null);
  const [form, setForm] = useState<AccountFormState>(createEmptyForm());

  const [accountTypeFormOpen, setAccountTypeFormOpen] = useState(false);
  const [accountTypeFormError, setAccountTypeFormError] = useState<string | null>(null);
  const [accountTypeSaving, setAccountTypeSaving] = useState(false);
  const [editingAccountType, setEditingAccountType] = useState<DocumentTypeRow | null>(null);
  const [pendingDeleteAccountType, setPendingDeleteAccountType] = useState<DocumentTypeRow | null>(null);
  const [accountTypeForm, setAccountTypeForm] = useState<AccountTypeFormState>(createEmptyAccountTypeForm());

  const loadLocal = useCallback(async () => {
    const [accountsPage, transactionPage, typeRows] = await Promise.all([
      accountsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      accountTransactionsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      documentTypesListLocal({ module: ACCOUNT_TYPE_MODULE, includeInactive: true }),
    ]);

    setRows(accountsPage.items);
    setTransactions(transactionPage.items);
    setAccountTypeRows(typeRows);
  }, []);

  const refresh = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        await loadLocal();
        try {
          await Promise.all([
            accountsPullToLocal(),
            accountTransactionsPullToLocal(),
            documentTypesPullToLocal(),
          ]);
        } catch {
          // Keep local data if pull fails.
        }
        await loadLocal();
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [loadLocal],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh(false);
    };

    const unsubscribeDocumentTypesChanged = subscribeAppEvent("document-types:changed", () => {
      void refresh(false);
    });

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      unsubscribeDocumentTypesChanged();
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const accountTypeLabelByCode = useMemo(() => buildAccountTypeLabelMap(accountTypeRows), [accountTypeRows]);
  const accountTypeOptions = useMemo(
    () => buildAccountTypeOptions(accountTypeRows, editing?.account_type ?? form.account_type),
    [accountTypeRows, editing?.account_type, form.account_type],
  );

  const summaryCards = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const account of rows) {
      const currency = account.currency || "USD";
      grouped.set(currency, Number((grouped.get(currency) ?? 0) + Number(account.current_balance ?? 0)));
    }

    return Array.from(grouped.entries()).map(([currency, balance]) => ({
      currency,
      balance,
    }));
  }, [rows]);

  const accountColumns = useMemo<Column<AccountRow>[]>(
    () => [
      {
        key: "name",
        label: "Account",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold">{item.name}</div>
            <div className="text-xs text-slate-500">
              {item.bank_name || item.account_number || accountTypeLabelByCode.get(item.account_type) || item.account_type}
            </div>
          </div>
        ),
      },
      {
        key: "account_type",
        label: "Type",
        render: (item) => {
          const label = accountTypeLabelByCode.get(item.account_type) || item.account_type;
          return <Badge color={badgeColorForAccountType(item.account_type)}>{label}</Badge>;
        },
      },
      { key: "currency", label: "Currency", render: (item) => <span>{item.currency}</span> },
      {
        key: "opening_balance",
        label: "Opening",
        render: (item) => money(Number(item.opening_balance ?? 0), item.currency || "USD"),
      },
      {
        key: "current_balance",
        label: "Current",
        render: (item) => <span className="font-semibold">{money(Number(item.current_balance ?? 0), item.currency || "USD")}</span>,
      },
      {
        key: "status",
        label: "Status",
        render: (item) => <Badge color={item.status === "inactive" ? "purple" : "emerald"}>{item.status}</Badge>,
      },
    ],
    [accountTypeLabelByCode],
  );

  const accountTypeColumns = useMemo<Column<DocumentTypeRow>[]>(
    () => [
      {
        key: "label",
        label: "Account Type",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white">{item.label}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{item.code}</div>
          </div>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        render: (item) => <Badge color={item.is_active ? "emerald" : "slate"}>{item.is_active ? "Active" : "Inactive"}</Badge>,
      },
      {
        key: "updated_at",
        label: "Updated",
        render: (item) => <span>{toDateLabel(item.updated_at)}</span>,
      },
    ],
    [],
  );

  const transactionColumns = useMemo<Column<AccountTransactionRow>[]>(
    () => [
      {
        key: "account_name",
        label: "Account",
        render: (item) => <span className="font-semibold">{item.account_name || "-"}</span>,
      },
      {
        key: "direction",
        label: "Direction",
        render: (item) => <Badge color={item.direction === "in" ? "emerald" : "red"}>{item.direction}</Badge>,
      },
      {
        key: "amount",
        label: "Amount",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-semibold">{money(Number(item.amount ?? 0), item.currency_code || item.account_currency || "USD")}</div>
            {item.amount_usd !== null &&
            item.amount_usd !== undefined &&
            (item.currency_code || item.account_currency || "USD") !== "USD" ? (
              <div className="text-xs text-slate-500">USD equivalent: {money(Number(item.amount_usd ?? 0), "USD")}</div>
            ) : null}
          </div>
        ),
      },
      { key: "module", label: "Module", render: (item) => <span>{item.module || "-"}</span> },
      { key: "description", label: "Description", render: (item) => <span>{item.description || "-"}</span> },
      { key: "transaction_date", label: "Date", render: (item) => toDateLabel(item.transaction_date) },
      {
        key: "status",
        label: "Status",
        render: (item) => <Badge color={item.status === "reversed" ? "purple" : "blue"}>{item.status}</Badge>,
      },
    ],
    [],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm(accountTypeOptions[0]?.value ?? "office"));
    setFormError(null);
    setFormOpen(true);
  }, [accountTypeOptions]);

  const openEdit = useCallback((row: AccountRow) => {
    setEditing(row);
    setForm(toForm(row));
    setFormError(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm(accountTypeOptions[0]?.value ?? "office"));
    setFormError(null);
    setFormOpen(false);
  }, [accountTypeOptions]);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);

    try {
      const payload: AccountInput = {
        name: form.name,
        account_type: form.account_type,
        bank_name: form.bank_name || null,
        account_number: form.account_number || null,
        currency: form.currency || "USD",
        opening_balance: Number(form.opening_balance || 0),
        status: form.status,
        notes: form.notes || null,
      };

      if (editing?.uuid) {
        await accountUpdate(editing.uuid, payload);
      } else {
        await accountCreate(payload);
      }

      closeForm();
      await refresh(false);
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save account.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editing?.uuid, form, refresh, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete?.uuid) return;
    try {
      await accountDelete(pendingDelete.uuid);
      setPendingDelete(null);
      await refresh(false);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Account delete failed.");
    }
  }, [pendingDelete, refresh]);

  const openCreateAccountType = useCallback(() => {
    setEditingAccountType(null);
    setAccountTypeForm(createEmptyAccountTypeForm());
    setAccountTypeFormError(null);
    setAccountTypeFormOpen(true);
  }, []);

  const openEditAccountType = useCallback((row: DocumentTypeRow) => {
    setEditingAccountType(row);
    setAccountTypeForm(toAccountTypeForm(row));
    setAccountTypeFormError(null);
    setAccountTypeFormOpen(true);
  }, []);

  const closeAccountTypeForm = useCallback(() => {
    setEditingAccountType(null);
    setAccountTypeForm(createEmptyAccountTypeForm());
    setAccountTypeFormError(null);
    setAccountTypeFormOpen(false);
  }, []);

  const handleAccountTypeSubmit = useCallback(async () => {
    if (accountTypeSaving) return;

    const trimmedLabel = accountTypeForm.label.trim();
    if (!trimmedLabel) {
      setAccountTypeFormError("Account type name is required.");
      return;
    }

    setAccountTypeSaving(true);
    setAccountTypeFormError(null);
    try {
      const payload: DocumentTypeInput = {
        module: ACCOUNT_TYPE_MODULE,
        label: trimmedLabel,
        is_active: accountTypeForm.is_active === "true",
      };

      if (editingAccountType?.uuid) {
        await documentTypeUpdate(editingAccountType.uuid, payload);
        notifySuccess("Account type updated.");
      } else {
        await documentTypeCreate(payload);
        notifySuccess("Account type created.");
      }

      setEditingAccountType(null);
      setAccountTypeForm(createEmptyAccountTypeForm());
      setAccountTypeFormError(null);
      await refresh(false);
    } catch (error: unknown) {
      setAccountTypeFormError(error instanceof Error ? error.message : "Unable to save account type.");
    } finally {
      setAccountTypeSaving(false);
    }
  }, [accountTypeForm, accountTypeSaving, editingAccountType?.uuid, refresh]);

  const confirmDeleteAccountType = useCallback(async () => {
    if (!pendingDeleteAccountType?.uuid) return;

    try {
      await documentTypeDelete(pendingDeleteAccountType.uuid);
      notifySuccess("Account type deleted.");
      setPendingDeleteAccountType(null);
      await refresh(false);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Unable to delete account type.");
    }
  }, [pendingDeleteAccountType, refresh]);

  return (
    <RequirePermission permission="accounts.view">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Accounts" subtitle="Manage office, personal, and bank accounts with ledger visibility">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={openCreateAccountType}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Account Types
            </button>
          </div>
        </PageHeader>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Accounts</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{rows.length}</div>
          </div>
          {summaryCards.map((item) => (
            <div
              key={item.currency}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]"
            >
              <div className="text-sm font-medium text-slate-500">Current Balance ({item.currency})</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{money(item.balance, item.currency)}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Accounts List</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Every account keeps its own balance, currency, and type assignment.
            </p>
          </div>

          <DataTable
            columns={accountColumns}
            data={rows}
            loading={loading}
            onEdit={openEdit}
            onDelete={setPendingDelete}
            canDelete={(row) => row.can_delete !== false}
            searchKeys={["name", "account_type", "currency", "status", "bank_name", "account_number"]}
            pageSize={TABLE_PAGE_SIZE}
            compact
          />
        </div>

        <div className="mt-8">
          <PageHeader title="Recent Transactions" subtitle="Ledger entries generated by payroll and other account-linked actions" />
          <DataTable
            columns={transactionColumns}
            data={transactions}
            loading={loading}
            searchKeys={["account_name", "module", "description", "status"]}
            pageSize={TABLE_PAGE_SIZE}
            compact
          />
        </div>
      </div>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editing ? "Edit Account" : "Create Account"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Name"
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: String(value) }))}
              required
            />
            <FormField
              label="Account Type"
              type="select"
              value={form.account_type}
              onChange={(value) => setForm((prev) => ({ ...prev, account_type: String(value) }))}
              options={accountTypeOptions}
              required
            />
            <FormField
              label="Bank Name"
              value={form.bank_name}
              onChange={(value) => setForm((prev) => ({ ...prev, bank_name: String(value) }))}
            />
            <FormField
              label="Account Number"
              value={form.account_number}
              onChange={(value) => setForm((prev) => ({ ...prev, account_number: String(value) }))}
            />
            <FormField
              label="Currency"
              type="select"
              value={form.currency}
              onChange={(value) => setForm((prev) => ({ ...prev, currency: String(value).toUpperCase() }))}
              options={[
                { value: "USD", label: "USD" },
                { value: "AFN", label: "AFN" },
              ]}
              required
            />
            <FormField
              label="Opening Balance"
              type="number"
              value={form.opening_balance}
              onChange={(value) => setForm((prev) => ({ ...prev, opening_balance: String(value) }))}
              required
            />
            <FormField
              label="Status"
              type="select"
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: String(value) as AccountFormState["status"] }))}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
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
              {saving ? "Saving..." : editing ? "Update Account" : "Create Account"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={accountTypeFormOpen}
        onClose={closeAccountTypeForm}
        title="Account Types"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingAccountType ? "Edit Account Type" : "Create Account Type"}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create, edit, and review the full account type list in this same modal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAccountType(null);
                setAccountTypeForm(createEmptyAccountTypeForm());
                setAccountTypeFormError(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              New Account Type
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Status"
              type="select"
              value={accountTypeForm.is_active}
              onChange={(value) =>
                setAccountTypeForm((prev) => ({ ...prev, is_active: value as AccountTypeFormState["is_active"] }))
              }
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
              required
            />
          </div>
          <FormField
            label="Account Type Name"
            value={accountTypeForm.label}
            onChange={(value) => setAccountTypeForm((prev) => ({ ...prev, label: String(value) }))}
            placeholder="Example: General Office Fund"
            required
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
            The system generates the internal type code automatically from the name and keeps that code stable even if you rename the type later.
          </div>
          {accountTypeFormError && <p className="text-sm text-red-600">{accountTypeFormError}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingAccountType(null);
                setAccountTypeForm(createEmptyAccountTypeForm());
                setAccountTypeFormError(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={accountTypeSaving}
              onClick={() => {
                void handleAccountTypeSubmit();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accountTypeSaving ? "Saving..." : editingAccountType ? "Update Account Type" : "Create Account Type"}
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-[#2a2a3e]">
            {accountTypeRows.length === 0 ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-400">
                No managed account types yet. Default built-in types are still available: Office, Cash, Bank, Personal.
              </div>
            ) : null}

            <DataTable
              columns={accountTypeColumns}
              data={accountTypeRows}
              loading={loading}
              onEdit={openEditAccountType}
              onDelete={setPendingDeleteAccountType}
              canDelete={(row) => row.can_delete !== false}
              searchKeys={["label", "code"]}
              pageSize={ACCOUNT_TYPE_PAGE_SIZE}
              compact
              mobileStack
              noHorizontalScroll
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete Account"
        message={`Are you sure you want to delete account ${pendingDelete?.name ?? ""}?`}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteAccountType)}
        onClose={() => setPendingDeleteAccountType(null)}
        onConfirm={() => {
          void confirmDeleteAccountType();
        }}
        title="Delete Account Type"
        message={
          pendingDeleteAccountType?.delete_blocked_reason
            ? pendingDeleteAccountType.delete_blocked_reason
            : `Delete ${pendingDeleteAccountType?.label ?? "this account type"}?`
        }
      />
    </RequirePermission>
  );
}
