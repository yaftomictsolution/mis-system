"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, RefreshCw, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

type ManagedModuleKey =
  | "customers"
  | "apartments"
  | "apartment_sales"
  | "employees"
  | "salary_advances"
  | "salary_payments"
  | "users"
  | "roles"
  | "projects"
  | "vendors"
  | "warehouses"
  | "materials"
  | "company_assets"
  | "material_requests"
  | "purchase_requests"
  | "asset_requests";

type OrderKey = "deleted_desc" | "deleted_asc" | "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

type ManagedRecord = {
  id: string;
  deleteKey: string;
  title: string;
  subtitle: string;
  detail: string;
  updatedAt: number;
  deletedAt: number;
};

type DeleteDependency = {
  table: string;
  tableLabel: string;
  column: string;
  count: number;
  exampleIds: string[];
  action: string;
};

type DeleteConflict = {
  recordTitle: string;
  message: string;
  dependencies: DeleteDependency[];
};

type ModuleConfig = {
  label: string;
  listPath: string;
  deletePath: (key: string) => string;
  supportsSoftDelete: boolean;
};

function formatDateTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getApiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data?.errors && typeof data.errors === "object") {
    for (const key of Object.keys(data.errors)) {
      const value = (data.errors as Record<string, unknown>)[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  return "Failed to delete record from the database.";
}

function getDeleteConflict(error: unknown, recordTitle: string): DeleteConflict | null {
  const data = (error as {
    response?: {
      data?: {
        message?: unknown;
        dependencies?: Array<{
          table?: unknown;
          table_label?: unknown;
          column?: unknown;
          count?: unknown;
          example_ids?: unknown;
          action?: unknown;
        }>;
      };
    };
  }).response?.data;

  const rawDependencies = Array.isArray(data?.dependencies) ? data.dependencies : [];
  if (!rawDependencies.length) return null;

  const dependencies = rawDependencies.map((item) => ({
    table: typeof item.table === "string" ? item.table : "",
    tableLabel:
      typeof item.table_label === "string" && item.table_label.trim()
        ? item.table_label.trim()
        : typeof item.table === "string"
          ? item.table.replaceAll("_", " ")
          : "Related records",
    column: typeof item.column === "string" ? item.column : "",
    count: typeof item.count === "number" && Number.isFinite(item.count) ? item.count : 0,
    exampleIds: Array.isArray(item.example_ids)
      ? item.example_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [],
    action:
      typeof item.action === "string" && item.action.trim()
        ? item.action.trim()
        : "Delete the related records first, then try this permanent delete again.",
  }));

  return {
    recordTitle,
    message: typeof data?.message === "string" && data.message.trim() ? data.message : "This record still has related data.",
    dependencies,
  };
}

function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function recordFromApi(moduleKey: ManagedModuleKey, row: Record<string, unknown>): ManagedRecord | null {
  const deletedAt = toTimestamp(row.deleted_at);
  if (deletedAt <= 0) return null;

  const uuid = String(row.uuid ?? row.id ?? "").trim();
  if (!uuid) return null;

  if (moduleKey === "customers") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, uuid),
      subtitle: stringOrFallback(row.phone, stringOrFallback(row.email, "No contact info")),
      detail: stringOrFallback(row.status, stringOrFallback(row.address, "Customer record")),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "apartments") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.apartment_code, uuid),
      subtitle: `${stringOrFallback(row.block_number, "-")} / ${stringOrFallback(row.unit_number, "-")}`,
      detail: stringOrFallback(row.status, stringOrFallback(row.usage_type, "Apartment record")),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "apartment_sales") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.sale_id, uuid),
      subtitle: `Status: ${stringOrFallback(row.status, "-")}`,
      detail: `Customer ID ${String(row.customer_id ?? 0)} / Apartment ID ${String(row.apartment_id ?? 0)}`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "employees") {
    const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
    const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    return {
      id: uuid,
      deleteKey: uuid,
      title: fullName || stringOrFallback(row.email, uuid),
      subtitle: stringOrFallback(row.email, typeof row.phone === "number" ? String(row.phone) : "No email"),
      detail: stringOrFallback(row.job_title, stringOrFallback(row.status, "Employee record")),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "salary_advances") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.employee_name, `Advance ${uuid}`),
      subtitle: `Amount: ${String(row.amount ?? 0)}`,
      detail: stringOrFallback(row.status, stringOrFallback(row.reason, "Salary advance")),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "salary_payments") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.employee_name, `Payment ${uuid}`),
      subtitle: `Period: ${stringOrFallback(row.period, "-")}`,
      detail: `Net salary ${String(row.net_salary ?? 0)} / ${stringOrFallback(row.status, "Salary payment")}`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "users") {
    const roles = Array.isArray(row.roles)
      ? row.roles.filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ")
      : "";

    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, stringOrFallback(row.email, uuid)),
      subtitle: stringOrFallback(row.email, "No email"),
      detail: roles || "User record",
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "roles") {
    const permissionsCount = Array.isArray(row.permissions) ? row.permissions.length : 0;

    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, uuid),
      subtitle: stringOrFallback(row.guard_name, "Role"),
      detail: `${permissionsCount} permissions`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "projects") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, uuid),
      subtitle: stringOrFallback(row.location, "No location"),
      detail: stringOrFallback(row.status, "Project"),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "vendors") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, uuid),
      subtitle: stringOrFallback(row.phone, stringOrFallback(row.email, "No contact info")),
      detail: stringOrFallback(row.address, stringOrFallback(row.status, "Vendor")),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "warehouses") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, uuid),
      subtitle: stringOrFallback(row.location, "No location"),
      detail: stringOrFallback(row.status, "Warehouse"),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "materials") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.name, uuid),
      subtitle: `${stringOrFallback(row.material_type, "Material")} / ${stringOrFallback(row.unit, "-")}`,
      detail: stringOrFallback(row.supplier_name, stringOrFallback(row.status, "Material")),
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "company_assets") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.asset_name, uuid),
      subtitle: `${stringOrFallback(row.asset_code, "-")} / ${stringOrFallback(row.asset_type, "-")}`,
      detail: `${stringOrFallback(row.status, "Company asset")} / Qty ${String(row.quantity ?? 0)}`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "material_requests") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.request_no, uuid),
      subtitle: stringOrFallback(row.requested_by_employee_name, "No requester"),
      detail: `${stringOrFallback(row.status, "Material request")} / ${stringOrFallback(row.warehouse_name, "No warehouse")}`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "purchase_requests") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.request_no, uuid),
      subtitle: `${stringOrFallback(row.request_type, "purchase")} / ${stringOrFallback(row.vendor_name, "No supplier")}`,
      detail: `${stringOrFallback(row.status, "Purchase request")} / ${stringOrFallback(row.warehouse_name, "No warehouse")}`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  if (moduleKey === "asset_requests") {
    return {
      id: uuid,
      deleteKey: uuid,
      title: stringOrFallback(row.request_no, uuid),
      subtitle: stringOrFallback(row.requested_by_employee_name, "No requester"),
      detail: `${stringOrFallback(row.status, "Asset request")} / ${stringOrFallback(row.requested_asset_name, stringOrFallback(row.asset_type, "No asset"))}`,
      updatedAt: toTimestamp(row.updated_at),
      deletedAt,
    };
  }

  return null;
}

const MODULE_CONFIG: Record<ManagedModuleKey, ModuleConfig> = {
  customers: {
    label: "Customers",
    listPath: "/api/customers",
    deletePath: (uuid) => `/api/customers/${uuid}/force`,
    supportsSoftDelete: true,
  },
  apartments: {
    label: "Apartments",
    listPath: "/api/apartments",
    deletePath: (uuid) => `/api/apartments/${uuid}/force`,
    supportsSoftDelete: true,
  },
  apartment_sales: {
    label: "Apartment Sales",
    listPath: "/api/apartment-sales",
    deletePath: (uuid) => `/api/apartment-sales/${uuid}/force`,
    supportsSoftDelete: true,
  },
  employees: {
    label: "Employees",
    listPath: "/api/employees",
    deletePath: (uuid) => `/api/employees/${uuid}/force`,
    supportsSoftDelete: true,
  },
  salary_advances: {
    label: "Salary Advances",
    listPath: "/api/salary-advances",
    deletePath: (uuid) => `/api/salary-advances/${uuid}/force`,
    supportsSoftDelete: true,
  },
  salary_payments: {
    label: "Salary Payments",
    listPath: "/api/salary-payments",
    deletePath: (uuid) => `/api/salary-payments/${uuid}/force`,
    supportsSoftDelete: true,
  },
  users: {
    label: "Users",
    listPath: "/api/users",
    deletePath: (uuid) => `/api/users/${uuid}/force`,
    supportsSoftDelete: true,
  },
  roles: {
    label: "User Roles",
    listPath: "/api/roles",
    deletePath: (uuid) => `/api/roles/${uuid}/force`,
    supportsSoftDelete: true,
  },
  projects: {
    label: "Projects",
    listPath: "/api/projects",
    deletePath: (uuid) => `/api/projects/${uuid}/force`,
    supportsSoftDelete: true,
  },
  vendors: {
    label: "Vendors",
    listPath: "/api/vendors",
    deletePath: (uuid) => `/api/vendors/${uuid}/force`,
    supportsSoftDelete: true,
  },
  warehouses: {
    label: "Warehouses",
    listPath: "/api/warehouses",
    deletePath: (uuid) => `/api/warehouses/${uuid}/force`,
    supportsSoftDelete: true,
  },
  materials: {
    label: "Materials",
    listPath: "/api/materials",
    deletePath: (uuid) => `/api/materials/${uuid}/force`,
    supportsSoftDelete: true,
  },
  company_assets: {
    label: "Company Assets",
    listPath: "/api/company-assets",
    deletePath: (uuid) => `/api/company-assets/${uuid}/force`,
    supportsSoftDelete: true,
  },
  material_requests: {
    label: "Material Requests",
    listPath: "/api/material-requests",
    deletePath: (uuid) => `/api/material-requests/${uuid}/force`,
    supportsSoftDelete: true,
  },
  purchase_requests: {
    label: "Purchase Requests",
    listPath: "/api/purchase-requests",
    deletePath: (uuid) => `/api/purchase-requests/${uuid}/force`,
    supportsSoftDelete: true,
  },
  asset_requests: {
    label: "Asset Requests",
    listPath: "/api/asset-requests",
    deletePath: (uuid) => `/api/asset-requests/${uuid}/force`,
    supportsSoftDelete: true,
  },
};

async function fetchDeletedRecords(moduleKey: ManagedModuleKey): Promise<ManagedRecord[]> {
  const config = MODULE_CONFIG[moduleKey];
  if (!config.supportsSoftDelete) return [];

  const items: ManagedRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await api.get<{
      data?: Array<Record<string, unknown>>;
      meta?: { has_more?: boolean };
    }>(config.listPath, {
      params: {
        offline: 1,
        per_page: 200,
        page,
      },
    });

    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    items.push(
      ...rows.map((row) => recordFromApi(moduleKey, row)).filter((row): row is ManagedRecord => Boolean(row)),
    );

    hasMore = Boolean(response.data?.meta?.has_more);
    page += 1;
  }

  return items;
}

export default function DataManagementPanel() {
  const [moduleKey, setModuleKey] = useState<ManagedModuleKey>("customers");
  const [order, setOrder] = useState<OrderKey>("deleted_desc");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [deleteConflict, setDeleteConflict] = useState<DeleteConflict | null>(null);

  const loadRecords = useCallback(async (key: ManagedModuleKey) => {
    setLoading(true);
    setDeleteConflict(null);
    try {
      const items = await fetchDeletedRecords(key);
      setRecords(items);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to load module records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords(moduleKey);
  }, [loadRecords, moduleKey]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    let next = records;

    if (term) {
      next = next.filter((record) =>
        [record.title, record.subtitle, record.detail].some((value) => value.toLowerCase().includes(term)),
      );
    }

    return [...next].sort((left, right) => {
      if (order === "deleted_desc") return right.deletedAt - left.deletedAt;
      if (order === "deleted_asc") return left.deletedAt - right.deletedAt;
      if (order === "updated_desc") return right.updatedAt - left.updatedAt;
      if (order === "updated_asc") return left.updatedAt - right.updatedAt;
      if (order === "title_desc") return right.title.localeCompare(left.title);
      return left.title.localeCompare(right.title);
    });
  }, [order, records, search]);

  const syncModule = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      notifyError("Sync requires internet connection.");
      return;
    }

    setSyncing(true);
    setDeleteConflict(null);
    try {
      await loadRecords(moduleKey);
      notifySuccess(`${MODULE_CONFIG[moduleKey].label} synced. Showing soft-deleted records ready for permanent removal.`);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : "Failed to sync module records.");
    } finally {
      setSyncing(false);
    }
  };

  const deleteRecord = async (record: ManagedRecord) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      notifyError("Permanent delete requires internet connection.");
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${record.title}" from ${MODULE_CONFIG[moduleKey].label}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(record.id);
    setDeleteConflict(null);
    try {
      await api.delete(MODULE_CONFIG[moduleKey].deletePath(record.deleteKey));
      await loadRecords(moduleKey);
      notifySuccess(`${record.title} was permanently deleted from the database.`);
    } catch (error: unknown) {
      const conflict = getDeleteConflict(error, record.title);
      if (conflict) {
        setDeleteConflict(conflict);
        notifyError(conflict.message);
      } else {
        notifyError(error instanceof Error ? error.message : getApiErrorMessage(error));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 dark:border-[#2a2a3e]">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Data Management</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Select a module, sync soft-deleted records, and permanently remove individual records from the database.
        </p>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300" />
          <div>
            <p className="font-medium text-rose-800 dark:text-rose-200">Permanent delete</p>
            <p className="mt-1 text-sm text-rose-700 dark:text-rose-200/80">
              This section lists records whose deleted_at value is already set and lets you permanently remove them from
              the server database table.
            </p>
          </div>
        </div>
      </div>

      {deleteConflict ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {deleteConflict.recordTitle} cannot be permanently deleted yet
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-100/90">{deleteConflict.message}</p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-200/80">
                  Remove the related records below first, then retry the permanent delete.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDeleteConflict(null)}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/20"
            >
              Dismiss
            </button>
          </div>

          {deleteConflict.dependencies.length ? (
            <div className="mt-4 space-y-3">
              {deleteConflict.dependencies.map((dependency) => (
                <div
                  key={`${dependency.table}:${dependency.column}`}
                  className="rounded-lg border border-amber-200 bg-white/70 px-4 py-3 dark:border-amber-500/20 dark:bg-[#12121a]/50"
                >
                  <div className="font-medium text-slate-900 dark:text-white">
                    {dependency.tableLabel} via <span className="font-mono text-xs">{dependency.column}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Found {dependency.count} related record{dependency.count === 1 ? "" : "s"} in{" "}
                    <span className="font-mono text-xs">{dependency.table}</span>.
                  </div>
                  {dependency.exampleIds.length ? (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Example ID{dependency.exampleIds.length === 1 ? "" : "s"}: {dependency.exampleIds.join(", ")}
                    </div>
                  ) : null}
                  <div className="mt-2 text-sm text-amber-800 dark:text-amber-100">{dependency.action}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label className="space-y-2 md:col-span-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Module</span>
          <select
            value={moduleKey}
            onChange={(event) => setModuleKey(event.target.value as ManagedModuleKey)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            {Object.entries(MODULE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Order</span>
          <select
            value={order}
            onChange={(event) => setOrder(event.target.value as OrderKey)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
          >
            <option value="deleted_desc">Deleted newest first</option>
            <option value="deleted_asc">Deleted oldest first</option>
            <option value="updated_desc">Updated newest first</option>
            <option value="updated_asc">Updated oldest first</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the selected module"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-white"
            />
          </div>
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-[#2a2a3e] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Database className="h-4 w-4" />
          <span>
            Showing {filteredRecords.length} of {records.length} soft-deleted records in {MODULE_CONFIG[moduleKey].label}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            void syncModule();
          }}
          disabled={syncing || !MODULE_CONFIG[moduleKey].supportsSoftDelete}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1a1a2e] dark:text-slate-300 dark:hover:bg-[#2a2a3e]"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync Deleted Records"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-[#2a2a3e]">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading records...</div>
        ) : filteredRecords.length ? (
          <div className="max-h-[520px] divide-y divide-slate-200 overflow-y-auto dark:divide-[#2a2a3e]">
            {filteredRecords.map((record) => (
              <div key={record.id} className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900 dark:text-white">{record.title}</div>
                  <div className="truncate text-sm text-slate-500 dark:text-slate-400">{record.subtitle}</div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{record.detail}</div>
                  <div className="mt-1 text-xs font-mono text-slate-400 dark:text-slate-500">
                    Deleted {formatDateTime(record.deletedAt)} | Updated {formatDateTime(record.updatedAt)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void deleteRecord(record);
                  }}
                  disabled={deletingId === record.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                >
                  <Trash2 size={16} />
                  {deletingId === record.id ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {MODULE_CONFIG[moduleKey].supportsSoftDelete
              ? "No soft-deleted records found for this module. Sync deleted records to refresh the list."
              : "This module does not use deleted_at, so there are no soft-deleted records to list here."}
          </div>
        )}
      </div>
    </div>
  );
}
