"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import RequirePermission from "@/components/auth/RequirePermission";
import AssetTypeManagerModal from "@/components/inventories/AssetTypeManagerModal";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { AssetRequestRow, CompanyAssetRow, ProjectRow, WarehouseRow } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";
import { hasAnyRole } from "@/lib/permissions";
import { notifyError } from "@/lib/notify";
import {
  ASSET_TYPE_MODULE,
  buildAssetTypeLabelMap,
  buildAssetTypeOptions,
} from "@/modules/document-types/asset-type-helpers";
import {
  documentTypesListLocal,
  documentTypesPullToLocal,
  type DocumentTypeRow,
} from "@/modules/document-types/document-types.repo";
import { companyAssetsListLocal, companyAssetsPullToLocal, warehousesListLocal, warehousesPullToLocal } from "@/modules/inventories/inventories.repo";
import {
  assetRequestAllocate,
  assetRequestApprove,
  assetRequestCreate,
  assetRequestDelete,
  assetRequestReject,
  assetRequestReturn,
  assetRequestUpdate,
  assetRequestsListLocal,
  assetRequestsPullToLocal,
  type AssetAllocationInput,
  type AssetRequestInput,
  type AssetReturnInput,
} from "@/modules/inventory-workflow/inventory-workflow.repo";
import { projectsListLocal, projectsPullToLocal } from "@/modules/projects/projects.repo";
import type { RootState } from "@/store/store";

type AssetRequestSyncEntity = "asset_requests" | "company_assets" | "projects" | "warehouses";
type SyncCompleteDetail = { syncedAny?: boolean; cleaned?: boolean; entities?: string[] };
type AssetRequestFormState = {
  project_id: string;
  requested_asset_id: string;
  asset_type: string;
  quantity_requested: string;
  reason: string;
  notes: string;
};
type AssetAllocateFormState = {
  asset_id: string;
  quantity_allocated: string;
  assigned_date: string;
  condition_on_issue: string;
  notes: string;
};
type AssetReturnFormState = {
  return_date: string;
  return_status: "returned" | "damaged" | "lost";
  quantity_returned: string;
  warehouse_id: string;
  condition_on_return: string;
  notes: string;
};
type AssetRequestTableRow = AssetRequestRow & { search_assets: string; project_label: string; requested_by_label: string };
type AssetRequestQueueFilter = "all" | "waiting-approval" | "allocate-ready" | "allocated" | "returned";

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const SYNC_ENTITIES = new Set<AssetRequestSyncEntity>(["asset_requests", "company_assets", "projects", "warehouses"]);
const today = () => new Date().toISOString().slice(0, 10);
const actionBtn = "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors";

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function createEmptyForm(): AssetRequestFormState {
  return {
    project_id: "",
    requested_asset_id: "",
    asset_type: "",
    quantity_requested: "1",
    reason: "",
    notes: "",
  };
}

function createAllocateForm(row: AssetRequestRow): AssetAllocateFormState {
  return {
    asset_id: row.requested_asset_id ? String(row.requested_asset_id) : "",
    quantity_allocated: String(Math.max(0, Number(row.quantity_requested ?? 0) - Number(row.quantity_allocated ?? 0)) || 1),
    assigned_date: today(),
    condition_on_issue: "",
    notes: "",
  };
}

function createReturnForm(): AssetReturnFormState {
  return {
    return_date: today(),
    return_status: "returned",
    quantity_returned: "1",
    warehouse_id: "",
    condition_on_return: "",
    notes: "",
  };
}

function normalizeForm(row: AssetRequestRow): AssetRequestFormState {
  return {
    project_id: row.project_id ? String(row.project_id) : "",
    requested_asset_id: row.requested_asset_id ? String(row.requested_asset_id) : "",
    asset_type: row.asset_type || "",
    quantity_requested: String(row.quantity_requested ?? 1),
    reason: row.reason || "",
    notes: row.notes || "",
  };
}

function isPendingApprovalStatus(status?: string | null): boolean {
  return status === "pending_admin_approval" || status === "pending";
}

function normalizeQueueFilter(value: string | null): AssetRequestQueueFilter {
  if (value === "waiting-approval" || value === "allocate-ready" || value === "allocated" || value === "returned") return value;
  return "all";
}

function statusBadge(status: string) {
  if (isPendingApprovalStatus(status)) return <Badge color="amber">waiting approval</Badge>;
  if (status === "approved") return <Badge color="blue">approved</Badge>;
  if (status === "allocated") return <Badge color="emerald">allocated</Badge>;
  if (status === "returned") return <Badge color="amber">returned</Badge>;
  if (status === "rejected") return <Badge color="red">rejected</Badge>;
  return <Badge color="slate">{status || "draft"}</Badge>;
}

export default function AssetRequestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const permissions = useSelector((state: RootState) => state.auth.user?.permissions ?? []);
  const roles = useSelector((state: RootState) => state.auth.user?.roles ?? []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AssetRequestRow[]>([]);
  const [assets, setAssets] = useState<CompanyAssetRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [assetTypeRows, setAssetTypeRows] = useState<DocumentTypeRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assetTypeModalOpen, setAssetTypeModalOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<AssetRequestRow | null>(null);
  const [editing, setEditing] = useState<AssetRequestRow | null>(null);
  const [allocateTarget, setAllocateTarget] = useState<AssetRequestRow | null>(null);
  const [returnTarget, setReturnTarget] = useState<AssetRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AssetRequestRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AssetRequestRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [form, setForm] = useState<AssetRequestFormState>(createEmptyForm());
  const [allocateForm, setAllocateForm] = useState<AssetAllocateFormState>(createAllocateForm({} as AssetRequestRow));
  const [returnForm, setReturnForm] = useState<AssetReturnFormState>(createReturnForm());
  const [rejectReason, setRejectReason] = useState("");

  const canCreate = useMemo(
    () => hasAnyRole(roles, ["Admin", "ProjectManager"]),
    [roles]
  );
  const canApprove = useMemo(
    () => hasAnyRole(roles, "Admin") || permissions.includes("inventory.approve"),
    [permissions, roles]
  );
  const canIssue = useMemo(
    () => hasAnyRole(roles, ["Admin", "Storekeeper"]) || permissions.includes("inventory.issue"),
    [permissions, roles]
  );
  const canReturn = useMemo(
    () => hasAnyRole(roles, "ProjectManager"),
    [roles]
  );
  const activeQueue = useMemo<AssetRequestQueueFilter>(() => normalizeQueueFilter(searchParams.get("queue")), [searchParams]);

  const loadLocal = useCallback(async () => {
    const [requestPage, assetPage, projectPage, warehousePage, typeRows] = await Promise.all([
      assetRequestsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      companyAssetsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      projectsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehousesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      documentTypesListLocal({ module: ASSET_TYPE_MODULE, includeInactive: true }),
    ]);

    setRows(requestPage.items);
    setAssets(assetPage.items);
    setProjects(projectPage.items);
    setWarehouses(warehousePage.items);
    setAssetTypeRows(typeRows);
  }, []);

  const refresh = useCallback(async (options?: { showLoader?: boolean; showFailureToast?: boolean; entitiesToPull?: AssetRequestSyncEntity[] }) => {
    const showLoader = options?.showLoader ?? true;
    const showFailureToast = options?.showFailureToast ?? true;
    const entitiesToPull = options?.entitiesToPull ?? ["asset_requests", "company_assets", "projects", "warehouses"];

    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      if (!entitiesToPull.length) return;

      let pullFailed = false;
      try {
        const tasks: Promise<unknown>[] = [];
        if (entitiesToPull.includes("asset_requests")) tasks.push(assetRequestsPullToLocal());
        if (entitiesToPull.includes("company_assets")) tasks.push(companyAssetsPullToLocal());
        if (entitiesToPull.includes("projects")) tasks.push(projectsPullToLocal());
        if (entitiesToPull.includes("warehouses")) tasks.push(warehousesPullToLocal());
        tasks.push(documentTypesPullToLocal());
        await Promise.all(tasks);
      } catch {
        pullFailed = true;
      }

      await loadLocal();
      if (showFailureToast && pullFailed && rows.length === 0) {
        notifyError("Unable to refresh asset requests from server. Using local data only.");
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [loadLocal, rows.length]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<SyncCompleteDetail>).detail;
      if (detail?.cleaned) {
        void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: [] });
        return;
      }

      const entities = Array.isArray(detail?.entities) ? detail.entities : [];
      const touched = entities.filter((entity): entity is AssetRequestSyncEntity => SYNC_ENTITIES.has(entity as AssetRequestSyncEntity));
      if (!touched.length) return;
      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: touched });
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  useEffect(() => {
    const unsubscribeDocumentTypes = subscribeAppEvent("document-types:changed", () => {
      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: [] });
    });

    return unsubscribeDocumentTypes;
  }, [refresh]);

  const assetOptions = useMemo(
    () =>
      assets.map((item) => ({
        value: String(item.id ?? ""),
        label: `${item.asset_code} - ${item.asset_name} (available ${Number(item.quantity ?? 0)})`,
      })),
    [assets]
  );
  const projectOptions = useMemo(
    () => projects.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [projects]
  );
  const warehouseOptions = useMemo(
    () => warehouses.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [warehouses]
  );
  const assetTypeLabelByCode = useMemo(() => buildAssetTypeLabelMap(assetTypeRows), [assetTypeRows]);
  const assetTypeOptions = useMemo(
    () => buildAssetTypeOptions(assetTypeRows, editing?.asset_type ?? form.asset_type),
    [assetTypeRows, editing?.asset_type, form.asset_type],
  );
  const availableAssetOptions = useMemo(
    () =>
      assets
        .filter((item) => Number(item.quantity ?? 0) > 0)
        .map((item) => ({
          value: String(item.id ?? ""),
          label: `${item.asset_code} - ${item.asset_name} (available ${Number(item.quantity ?? 0)})`,
        })),
    [assets]
  );

  const summary = useMemo(() => ({
    pending: rows.filter((row) => isPendingApprovalStatus(row.status)).length,
    approved: rows.filter((row) => row.status === "approved").length,
    allocated: rows.filter((row) => row.status === "allocated").length,
    returned: rows.filter((row) => row.status === "returned").length,
  }), [rows]);

  const tableRows = useMemo<AssetRequestTableRow[]>(() => rows.map((row) => ({
    ...row,
    project_label: row.project_name || (row.project_id ? `Project ${row.project_id}` : "No project"),
    requested_by_label: row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "-",
    search_assets: [
      row.requested_asset_code,
      row.requested_asset_name,
      row.assigned_asset_code,
      row.assigned_asset_name,
      row.requested_by_name,
      row.requested_by_user_name,
      row.requested_by_employee_name,
    ].filter(Boolean).join(" "),
  })), [rows]);

  const filteredTableRows = useMemo(() => {
    if (activeQueue === "waiting-approval") {
      return tableRows.filter((row) => isPendingApprovalStatus(row.status));
    }
    if (activeQueue === "allocate-ready") {
      return tableRows.filter((row) => row.status === "approved");
    }
    if (activeQueue === "allocated") {
      return tableRows.filter((row) => row.status === "allocated");
    }
    if (activeQueue === "returned") {
      return tableRows.filter((row) => row.status === "returned");
    }
    return tableRows;
  }, [activeQueue, tableRows]);

  const setQueueFilter = useCallback((nextFilter: AssetRequestQueueFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") {
      params.delete("queue");
    } else {
      params.set("queue", nextFilter);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormError(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: AssetRequestRow) => {
    setEditing(row);
    setForm(normalizeForm(row));
    setFormError(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
    setForm(createEmptyForm());
  }, []);

  const openAllocate = useCallback((row: AssetRequestRow) => {
    setAllocateTarget(row);
    setAllocateForm(createAllocateForm(row));
    setAllocateError(null);
    setAllocateOpen(true);
  }, []);

  const closeAllocate = useCallback(() => {
    setAllocateOpen(false);
    setAllocateTarget(null);
    setAllocateError(null);
    setAllocateForm(createAllocateForm({} as AssetRequestRow));
  }, []);

  const openReturn = useCallback((row: AssetRequestRow) => {
    setReturnTarget(row);
    setReturnForm({
      ...createReturnForm(),
      quantity_returned: String(row.assigned_quantity ?? row.quantity_allocated ?? 1),
    });
    setReturnError(null);
    setReturnOpen(true);
  }, []);

  const closeReturn = useCallback(() => {
    setReturnOpen(false);
    setReturnTarget(null);
    setReturnError(null);
    setReturnForm(createReturnForm());
  }, []);

  const openReject = useCallback((row: AssetRequestRow) => {
    setRejectTarget(row);
    setRejectReason("");
    setRejectError(null);
    setRejectOpen(true);
  }, []);

  const closeReject = useCallback(() => {
    setRejectOpen(false);
    setRejectTarget(null);
    setRejectReason("");
    setRejectError(null);
  }, []);

  const submitForm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: AssetRequestInput = {
        project_id: form.project_id ? Number(form.project_id) : null,
        requested_asset_id: form.requested_asset_id ? Number(form.requested_asset_id) : null,
        asset_type: form.asset_type || null,
        quantity_requested: Number(form.quantity_requested || 0),
        reason: form.reason,
        notes: form.notes,
      };

      if (editing?.uuid) {
        await assetRequestUpdate(editing.uuid, payload);
      } else {
        await assetRequestCreate(payload);
      }

      closeForm();
      await loadLocal();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save asset request.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editing?.uuid, form, loadLocal, saving]);

  const submitAllocate = useCallback(async () => {
    if (!allocateTarget || saving) return;
    setSaving(true);
    setAllocateError(null);
    try {
      const payload: AssetAllocationInput = {
        asset_id: Number(allocateForm.asset_id),
        quantity_allocated: Number(allocateForm.quantity_allocated || 0),
        assigned_date: allocateForm.assigned_date,
        condition_on_issue: allocateForm.condition_on_issue,
        notes: allocateForm.notes,
      };
      await assetRequestAllocate(allocateTarget.uuid, payload);
      closeAllocate();
      await loadLocal();
    } catch (error: unknown) {
      setAllocateError(error instanceof Error ? error.message : "Unable to allocate asset request.");
    } finally {
      setSaving(false);
    }
  }, [allocateForm, allocateTarget, closeAllocate, loadLocal, saving]);

  const submitReturn = useCallback(async () => {
    if (!returnTarget || saving) return;
    setSaving(true);
    setReturnError(null);
    try {
      const payload: AssetReturnInput = {
        return_date: returnForm.return_date,
        return_status: returnForm.return_status,
        quantity_returned: Number(returnForm.quantity_returned || 0),
        warehouse_id: returnForm.warehouse_id ? Number(returnForm.warehouse_id) : null,
        condition_on_return: returnForm.condition_on_return,
        notes: returnForm.notes,
      };
      await assetRequestReturn(returnTarget.uuid, payload);
      closeReturn();
      await loadLocal();
    } catch (error: unknown) {
      setReturnError(error instanceof Error ? error.message : "Unable to return asset.");
    } finally {
      setSaving(false);
    }
  }, [closeReturn, loadLocal, returnForm, returnTarget, saving]);

  const handleApprove = useCallback(async (row: AssetRequestRow) => {
    try {
      await assetRequestApprove(row.uuid);
      await loadLocal();
    } catch {
      // repo already surfaces the error
    }
  }, [loadLocal]);

  const handleReject = useCallback(async (row: AssetRequestRow, reason: string) => {
    await assetRequestReject(row.uuid, reason);
    await loadLocal();
  }, [loadLocal]);

  const submitReject = useCallback(async () => {
    if (!rejectTarget || saving) return;

    const normalizedReason = rejectReason.trim();
    if (!normalizedReason) {
      setRejectError("Rejection reason is required.");
      return;
    }

    setSaving(true);
    setRejectError(null);
    try {
      await handleReject(rejectTarget, normalizedReason);
      closeReject();
    } catch (error: unknown) {
      setRejectError(error instanceof Error ? error.message : "Unable to reject asset request.");
    } finally {
      setSaving(false);
    }
  }, [closeReject, handleReject, rejectReason, rejectTarget, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await assetRequestDelete(pendingDelete.uuid);
      setPendingDelete(null);
      await loadLocal();
    } catch {
      // repo already surfaces the error
    }
  }, [loadLocal, pendingDelete]);

  const columns = useMemo<Column<AssetRequestTableRow>[]>(() => [
    { key: "request_no", label: "Request", render: (item) => <span className="font-semibold">{item.request_no}</span> },
    { key: "requested_by_label", label: "Requested By", render: (item) => item.requested_by_label },
    {
      key: "requested_asset_name",
      label: "Requested Asset",
      render: (item) => item.requested_asset_name || assetTypeLabelByCode.get(item.asset_type || "") || item.asset_type || "-",
    },
    { key: "quantity_requested", label: "Requested Qty", render: (item) => String(item.quantity_requested ?? "-") },
    { key: "assigned_asset_name", label: "Assigned Asset", render: (item) => item.assigned_asset_name || "-" },
    { key: "quantity_allocated", label: "Allocated Qty", render: (item) => String(item.quantity_allocated ?? "-") },
    { key: "project_label", label: "Project", render: (item) => item.project_label },
    { key: "status", label: "Status", render: (item) => statusBadge(item.status) },
    { key: "requested_at", label: "Requested", render: (item) => toDateLabel(item.requested_at) },
    {
      key: "workflow",
      label: "Workflow",
      render: (item) => {
        const canEdit = item.can_edit ?? item.status === "rejected";
        const canDelete = item.can_delete ?? (isPendingApprovalStatus(item.status) || item.status === "rejected");

        return (
          <div className="flex flex-wrap justify-end gap-2">
            {canCreate && canEdit && (
              <button type="button" onClick={() => openEdit(item)} className={`${actionBtn} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}>Edit</button>
            )}
            {canCreate && canDelete && (
              <button type="button" onClick={() => setPendingDelete(item)} className={`${actionBtn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}>Delete</button>
            )}
            {canApprove && isPendingApprovalStatus(item.status) && (
              <>
                <button type="button" onClick={() => setApproveTarget(item)} className={`${actionBtn} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>Approve</button>
                <button type="button" onClick={() => openReject(item)} className={`${actionBtn} border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200`}>Reject</button>
              </>
            )}
            {canIssue && item.status === "approved" && (
              <button type="button" onClick={() => openAllocate(item)} className={`${actionBtn} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>Allocate</button>
            )}
            {canReturn && item.status === "allocated" && (
              <button type="button" onClick={() => openReturn(item)} className={`${actionBtn} border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100`}>Return</button>
            )}
          </div>
        );
      },
    },
  ], [assetTypeLabelByCode, canApprove, canCreate, canIssue, canReturn, openAllocate, openEdit, openReject, openReturn]);

  return (
    <RequirePermission permission={["asset_requests.view", "inventory.request"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Asset Requests" subtitle="Project managers request assets, admins approve them, storekeepers allocate them, and project managers handle returns.">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void refresh(); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Sync Requests</button>
            <button type="button" onClick={() => setAssetTypeModalOpen(true)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Asset Types</button>
            {canCreate && <button type="button" onClick={openCreate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700">Create Request</button>}
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Waiting Approval", value: summary.pending }, { label: "Approved", value: summary.approved }, { label: "Allocated", value: summary.allocated }, { label: "Returned", value: summary.returned }].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="text-sm font-medium text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { key: "all", label: "All Requests", count: tableRows.length },
            { key: "waiting-approval", label: "Waiting Approval", count: summary.pending },
            { key: "allocate-ready", label: "Ready To Allocate", count: summary.approved },
            { key: "allocated", label: "Allocated", count: summary.allocated },
            { key: "returned", label: "Returned", count: summary.returned },
          ].map((item) => {
            const selected = activeQueue === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setQueueFilter(item.key as AssetRequestQueueFilter)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  selected
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300 dark:hover:bg-[#1a1a2e]"
                }`}
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{item.count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <DataTable
            columns={columns}
            data={filteredTableRows}
            loading={loading}
            searchKeys={["request_no", "requested_by_label", "requested_asset_name", "assigned_asset_name", "project_label", "status", "search_assets"]}
            pageSize={TABLE_PAGE_SIZE}
            expandableRows
            compact
            renderExpandedRow={(row) => (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Project</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.project_label}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Requested By</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.requested_by_label}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Requested</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.requested_at)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Approved At</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.approved_at)}</div></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Requested Asset</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.requested_asset_code ? `${row.requested_asset_code} - ${row.requested_asset_name}` : assetTypeLabelByCode.get(row.asset_type || "") || row.asset_type || "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Assigned Asset</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.assigned_asset_code ? `${row.assigned_asset_code} - ${row.assigned_asset_name}` : "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Assigned Date</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.assigned_date)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Return Date</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.return_date)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Requested Qty</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.quantity_requested ?? "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Assigned Qty</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.assigned_quantity ?? row.quantity_allocated ?? "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Assignment Status</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.assignment_status || "-"}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Receipt</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.allocation_receipt_no || "-"}</div></div>
                </div>
                {row.reason && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300">Reason: {row.reason}</div>}
                {row.rejection_reason && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">Rejection reason: {row.rejection_reason}</div>}
                {row.notes && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300">Notes: {row.notes}</div>}
              </div>
            )}
          />
        </div>
      </div>

      <Modal isOpen={formOpen} onClose={closeForm} title={editing ? "Edit Asset Request" : "Create Asset Request"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              label="Project"
              type="select"
              value={form.project_id}
              onChange={(value) => setForm((prev) => ({ ...prev, project_id: String(value) }))}
              options={projectOptions}
              placeholder="Select project"
              required
            />
            <FormField label="Requested Asset" type="select" value={form.requested_asset_id} onChange={(value) => {
              const asset = assets.find((entry) => String(entry.id) === String(value));
              setForm((prev) => ({ ...prev, requested_asset_id: String(value), asset_type: asset?.asset_type || prev.asset_type }));
            }} options={assetOptions} placeholder="Optional exact asset" />
            <div className="space-y-2">
              <FormField
                label="Asset Type"
                type="select"
                value={form.asset_type}
                onChange={(value) => setForm((prev) => ({ ...prev, asset_type: String(value) }))}
                options={assetTypeOptions}
                placeholder="Optional type"
              />
              <button
                type="button"
                onClick={() => setAssetTypeModalOpen(true)}
                className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Manage asset types
              </button>
            </div>
            <FormField label="Requested Quantity" type="number" value={form.quantity_requested} onChange={(value) => setForm((prev) => ({ ...prev, quantity_requested: String(value) }))} required />
          </div>
          <FormField label="Reason" type="textarea" value={form.reason} onChange={(value) => setForm((prev) => ({ ...prev, reason: String(value) }))} rows={3} />
          <FormField label="Notes" type="textarea" value={form.notes} onChange={(value) => setForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitForm(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editing ? "Update Request" : "Create Request"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={allocateOpen} onClose={closeAllocate} title={allocateTarget ? `Allocate ${allocateTarget.request_no}` : "Allocate Asset"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Asset" type="select" value={allocateForm.asset_id} onChange={(value) => setAllocateForm((prev) => ({ ...prev, asset_id: String(value) }))} options={availableAssetOptions} required />
            <FormField label="Assigned Date" type="date" value={allocateForm.assigned_date} onChange={(value) => setAllocateForm((prev) => ({ ...prev, assigned_date: String(value) }))} required />
          </div>
          <FormField label="Allocate Quantity" type="number" value={allocateForm.quantity_allocated} onChange={(value) => setAllocateForm((prev) => ({ ...prev, quantity_allocated: String(value) }))} required />
          <FormField label="Condition On Issue" value={allocateForm.condition_on_issue} onChange={(value) => setAllocateForm((prev) => ({ ...prev, condition_on_issue: String(value) }))} placeholder="good, serviced, etc." />
          <FormField label="Notes" type="textarea" value={allocateForm.notes} onChange={(value) => setAllocateForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />
          {allocateError && <p className="text-sm text-red-600">{allocateError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeAllocate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitAllocate(); }} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Allocating..." : "Allocate Asset"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={returnOpen} onClose={closeReturn} title={returnTarget ? `Return ${returnTarget.request_no}` : "Return Asset"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Return Date" type="date" value={returnForm.return_date} onChange={(value) => setReturnForm((prev) => ({ ...prev, return_date: String(value) }))} required />
            <FormField label="Return Status" type="select" value={returnForm.return_status} onChange={(value) => setReturnForm((prev) => ({ ...prev, return_status: String(value) as AssetReturnFormState["return_status"] }))} options={[{ value: "returned", label: "Returned" }, { value: "damaged", label: "Damaged" }, { value: "lost", label: "Lost" }]} required />
          </div>
          <FormField label="Return Quantity" type="number" value={returnForm.quantity_returned} onChange={(value) => setReturnForm((prev) => ({ ...prev, quantity_returned: String(value) }))} required />
          <FormField
            label={returnForm.return_status === "lost" ? "Warehouse (Not Needed)" : "Return Warehouse"}
            type="select"
            value={returnForm.warehouse_id}
            onChange={(value) => setReturnForm((prev) => ({ ...prev, warehouse_id: String(value) }))}
            options={warehouseOptions}
            placeholder="Select warehouse"
            disabled={returnForm.return_status === "lost"}
          />
          <FormField label="Condition On Return" value={returnForm.condition_on_return} onChange={(value) => setReturnForm((prev) => ({ ...prev, condition_on_return: String(value) }))} placeholder="good, damaged, missing parts..." />
          <FormField label="Notes" type="textarea" value={returnForm.notes} onChange={(value) => setReturnForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />
          {returnError && <p className="text-sm text-red-600">{returnError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeReturn} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitReturn(); }} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Return Asset"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={rejectOpen} onClose={closeReject} title={rejectTarget ? `Reject ${rejectTarget.request_no}` : "Reject Asset Request"} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter the reason for rejection. The requester will see this reason when they review the rejected record.
          </p>
          <FormField
            label="Rejection Reason"
            type="textarea"
            value={rejectReason}
            onChange={(value) => setRejectReason(String(value))}
            rows={4}
            required
          />
          {rejectError && <p className="text-sm text-red-600">{rejectError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeReject} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitReject(); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Rejecting..." : "Reject Request"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) {
            void handleApprove(approveTarget);
          }
        }}
        title="Approve Asset Request"
        message={`Approve asset request ${approveTarget?.request_no ?? ""}?`}
        confirmLabel="Approve"
        confirmVariant="success"
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { void confirmDelete(); }}
        title="Delete Asset Request"
        message="Are you sure you want to delete this asset request?"
      />

      <AssetTypeManagerModal
        isOpen={assetTypeModalOpen}
        onClose={() => setAssetTypeModalOpen(false)}
      />
    </RequirePermission>
  );
}
