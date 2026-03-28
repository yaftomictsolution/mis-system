"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { EmployeeRow, MaterialRequestRow, MaterialRow, ProjectRow, WarehouseRow } from "@/db/localDB";
import { notifyError } from "@/lib/notify";
import { employeePullToLocal, employeesListLocal } from "@/modules/employees/employees.repo";
import { materialsListLocal, materialsPullToLocal, warehousesListLocal, warehousesPullToLocal } from "@/modules/inventories/inventories.repo";
import {
  materialRequestApprove,
  materialRequestCreate,
  materialRequestDelete,
  materialRequestIssue,
  materialRequestReject,
  materialRequestUpdate,
  materialRequestsListLocal,
  materialRequestsPullToLocal,
  type MaterialIssueInput,
  type MaterialRequestInput,
} from "@/modules/inventory-workflow/inventory-workflow.repo";
import { projectsListLocal, projectsPullToLocal } from "@/modules/projects/projects.repo";
import type { RootState } from "@/store/store";

type MaterialRequestSyncEntity = "material_requests" | "materials" | "employees" | "warehouses" | "projects";
type SyncCompleteDetail = { syncedAny?: boolean; cleaned?: boolean; entities?: string[] };
type MaterialRequestFormItemState = { uuid: string; material_id: string; quantity_requested: string; unit: string; notes: string };
type MaterialRequestFormState = {
  project_id: string;
  warehouse_id: string;
  requested_by_employee_id: string;
  notes: string;
  items: MaterialRequestFormItemState[];
};
type IssueFormItemState = {
  uuid: string;
  material_name: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_issued: number;
  available_stock: number;
  quantity_issue_now: string;
};
type IssueFormState = { issue_date: string; notes: string; items: IssueFormItemState[] };
type MaterialRequestTableRow = MaterialRequestRow & { search_materials: string; project_label: string };

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const SYNC_ENTITIES = new Set<MaterialRequestSyncEntity>(["material_requests", "materials", "employees", "warehouses", "projects"]);
const today = () => new Date().toISOString().slice(0, 10);
const actionBtn = "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors";

function qty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function createItem(): MaterialRequestFormItemState {
  return { uuid: crypto.randomUUID(), material_id: "", quantity_requested: "", unit: "", notes: "" };
}

function createEmptyForm(): MaterialRequestFormState {
  return {
    project_id: "",
    warehouse_id: "",
    requested_by_employee_id: "",
    notes: "",
    items: [createItem()],
  };
}

function createIssueForm(row: MaterialRequestRow, materials: MaterialRow[]): IssueFormState {
  return {
    issue_date: today(),
    notes: "",
    items: (row.items ?? []).map((item) => {
      const remaining = Math.max(0, Number(item.quantity_approved ?? 0) - Number(item.quantity_issued ?? 0));
      const material = materials.find((entry) => Number(entry.id) === Number(item.material_id));
      return {
        uuid: item.uuid,
        material_name: item.material_name || material?.name || "Material",
        quantity_requested: Number(item.quantity_requested ?? 0),
        quantity_approved: Number(item.quantity_approved ?? 0),
        quantity_issued: Number(item.quantity_issued ?? 0),
        available_stock: Number(material?.quantity ?? 0),
        quantity_issue_now: remaining > 0 ? String(remaining) : "",
      };
    }),
  };
}

function normalizeForm(row: MaterialRequestRow): MaterialRequestFormState {
  return {
    project_id: row.project_id ? String(row.project_id) : "",
    warehouse_id: String(row.warehouse_id || ""),
    requested_by_employee_id: String(row.requested_by_employee_id || ""),
    notes: row.notes || "",
    items: (row.items?.length ? row.items : [createItem()]).map((item) => ({
      uuid: item.uuid || crypto.randomUUID(),
      material_id: item.material_id ? String(item.material_id) : "",
      quantity_requested: String(item.quantity_requested ?? ""),
      unit: item.unit || "",
      notes: item.notes || "",
    })),
  };
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge color="blue">approved</Badge>;
  if (status === "partial_issued") return <Badge color="amber">partial issued</Badge>;
  if (status === "issued") return <Badge color="emerald">issued</Badge>;
  if (status === "rejected") return <Badge color="red">rejected</Badge>;
  return <Badge color="slate">pending</Badge>;
}

function openRequestPrint(uuid: string): void {
  if (!uuid) return;
  window.open(`/print/material-requests/${uuid}/receipt`, "_blank", "noopener,noreferrer");
}

export default function MaterialRequestsPage() {
  const permissions = useSelector((state: RootState) => state.auth.user?.permissions ?? []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MaterialRequestRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRequestRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MaterialRequestRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialRequestFormState>(createEmptyForm());
  const [issueTarget, setIssueTarget] = useState<MaterialRequestRow | null>(null);
  const [issueForm, setIssueForm] = useState<IssueFormState>({ issue_date: today(), notes: "", items: [] });

  const hasExplicitWorkflowPerms = useMemo(
    () => permissions.some((permission) => permission === "inventory.approve" || permission === "inventory.issue"),
    [permissions]
  );
  const canApprove = permissions.includes("inventory.approve") || (!hasExplicitWorkflowPerms && permissions.includes("inventory.request"));
  const canIssue = permissions.includes("inventory.issue") || (!hasExplicitWorkflowPerms && permissions.includes("inventory.request"));

  const loadLocal = useCallback(async () => {
    const [requestPage, materialPage, warehousePage, employeePage, projectPage] = await Promise.all([
      materialRequestsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      materialsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehousesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      employeesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      projectsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
    ]);

    setRows(requestPage.items);
    setMaterials(materialPage.items);
    setWarehouses(warehousePage.items);
    setEmployees(employeePage.items);
    setProjects(projectPage.items);
  }, []);

  const refresh = useCallback(async (options?: { showLoader?: boolean; showFailureToast?: boolean; entitiesToPull?: MaterialRequestSyncEntity[] }) => {
    const showLoader = options?.showLoader ?? true;
    const showFailureToast = options?.showFailureToast ?? true;
    const entitiesToPull = options?.entitiesToPull ?? ["material_requests", "materials", "employees", "warehouses", "projects"];

    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      if (!entitiesToPull.length) return;

      let pullFailed = false;
      try {
        const tasks: Promise<unknown>[] = [];
        if (entitiesToPull.includes("material_requests")) tasks.push(materialRequestsPullToLocal());
        if (entitiesToPull.includes("materials")) tasks.push(materialsPullToLocal());
        if (entitiesToPull.includes("employees")) tasks.push(employeePullToLocal());
        if (entitiesToPull.includes("warehouses")) tasks.push(warehousesPullToLocal());
        if (entitiesToPull.includes("projects")) tasks.push(projectsPullToLocal());
        await Promise.all(tasks);
      } catch {
        pullFailed = true;
      }

      await loadLocal();
      if (showFailureToast && pullFailed && rows.length === 0) {
        notifyError("Unable to refresh material requests from server. Using local data only.");
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
      const touched = entities.filter((entity): entity is MaterialRequestSyncEntity => SYNC_ENTITIES.has(entity as MaterialRequestSyncEntity));
      if (!touched.length) return;
      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: touched });
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  const materialOptions = useMemo(
    () => materials.map((item) => ({ value: String(item.id ?? ""), label: `${item.name} (${item.unit})` })),
    [materials]
  );
  const warehouseOptions = useMemo(
    () => warehouses.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [warehouses]
  );
  const employeeOptions = useMemo(
    () => employees.map((item) => ({ value: String(item.id ?? ""), label: [item.first_name, item.last_name].filter(Boolean).join(" ").trim() || item.email })),
    [employees]
  );
  const projectOptions = useMemo(
    () => projects.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [projects]
  );

  const summary = useMemo(() => ({
    pending: rows.filter((row) => row.status === "pending").length,
    approved: rows.filter((row) => row.status === "approved").length,
    partial: rows.filter((row) => row.status === "partial_issued").length,
    issued: rows.filter((row) => row.status === "issued").length,
  }), [rows]);

  const tableRows = useMemo<MaterialRequestTableRow[]>(() => rows.map((row) => ({
    ...row,
    project_label: row.project_name || (row.project_id ? `Project ${row.project_id}` : "No project"),
    search_materials: (row.items ?? []).map((item) => item.material_name || "").join(" "),
  })), [rows]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormError(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: MaterialRequestRow) => {
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

  const openIssue = useCallback((row: MaterialRequestRow) => {
    setIssueTarget(row);
    setIssueForm(createIssueForm(row, materials));
    setIssueError(null);
    setIssueOpen(true);
  }, [materials]);

  const closeIssue = useCallback(() => {
    setIssueOpen(false);
    setIssueTarget(null);
    setIssueError(null);
    setIssueForm({ issue_date: today(), notes: "", items: [] });
  }, []);

  const setItemField = useCallback((uuid: string, field: keyof MaterialRequestFormItemState, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.uuid !== uuid) return item;
        if (field === "material_id") {
          const material = materials.find((entry) => String(entry.id) === value);
          return { ...item, material_id: value, unit: material?.unit || item.unit };
        }
        return { ...item, [field]: value };
      }),
    }));
  }, [materials]);

  const submitForm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: MaterialRequestInput = {
        project_id: form.project_id ? Number(form.project_id) : null,
        warehouse_id: Number(form.warehouse_id),
        requested_by_employee_id: Number(form.requested_by_employee_id),
        notes: form.notes,
        items: form.items.map((item) => ({
          uuid: item.uuid,
          material_id: Number(item.material_id),
          quantity_requested: Number(item.quantity_requested),
          unit: item.unit,
          notes: item.notes,
        })),
      };

      if (editing?.uuid) {
        await materialRequestUpdate(editing.uuid, payload);
      } else {
        await materialRequestCreate(payload);
      }

      closeForm();
      await loadLocal();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save material request.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editing?.uuid, form, loadLocal, saving]);

  const submitIssue = useCallback(async () => {
    if (!issueTarget || saving) return;
    setSaving(true);
    setIssueError(null);
    try {
      const items = issueForm.items
        .map((item) => ({ uuid: item.uuid, quantity_issued: Number(item.quantity_issue_now) }))
        .filter((item) => Number.isFinite(item.quantity_issued) && item.quantity_issued > 0);

      const payload: MaterialIssueInput = { items, issue_date: issueForm.issue_date, notes: issueForm.notes };
      await materialRequestIssue(issueTarget.uuid, payload);
      closeIssue();
      await loadLocal();
    } catch (error: unknown) {
      setIssueError(error instanceof Error ? error.message : "Unable to issue material request.");
    } finally {
      setSaving(false);
    }
  }, [closeIssue, issueForm, issueTarget, loadLocal, saving]);

  const handleApprove = useCallback(async (row: MaterialRequestRow) => {
    try {
      await materialRequestApprove(row.uuid);
      await loadLocal();
    } catch {
      // repo already surfaces a message
    }
  }, [loadLocal]);

  const handleReject = useCallback(async (row: MaterialRequestRow) => {
    try {
      await materialRequestReject(row.uuid);
      await loadLocal();
    } catch {
      // repo already surfaces a message
    }
  }, [loadLocal]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await materialRequestDelete(pendingDelete.uuid);
      setPendingDelete(null);
      await loadLocal();
    } catch {
      // repo already surfaces a message
    }
  }, [loadLocal, pendingDelete]);

  const columns = useMemo<Column<MaterialRequestTableRow>[]>(() => [
    { key: "request_no", label: "Request", render: (item) => <span className="font-semibold">{item.request_no}</span> },
    { key: "requested_by_employee_name", label: "Requested By", render: (item) => item.requested_by_employee_name || "-" },
    { key: "warehouse_name", label: "Warehouse", render: (item) => item.warehouse_name || "-" },
    { key: "project_label", label: "Project", render: (item) => item.project_label },
    { key: "items_count", label: "Items", render: (item) => String(item.items?.length ?? 0) },
    { key: "status", label: "Status", render: (item) => statusBadge(item.status) },
    { key: "requested_at", label: "Requested", render: (item) => toDateLabel(item.requested_at) },
    {
      key: "workflow",
      label: "Workflow",
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-2">
          {item.status === "pending" && (
            <>
              <button type="button" onClick={() => openEdit(item)} className={`${actionBtn} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}>Edit</button>
              <button type="button" onClick={() => setPendingDelete(item)} className={`${actionBtn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}>Delete</button>
            </>
          )}
          {canApprove && item.status === "pending" && (
            <>
              <button type="button" onClick={() => { void handleApprove(item); }} className={`${actionBtn} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>Approve</button>
              <button type="button" onClick={() => { void handleReject(item); }} className={`${actionBtn} border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200`}>Reject</button>
            </>
          )}
          {canIssue && (item.status === "approved" || item.status === "partial_issued") && (
            <button type="button" onClick={() => openIssue(item)} className={`${actionBtn} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>Issue</button>
          )}
          <button
            type="button"
            onClick={() => openRequestPrint(item.uuid)}
            className={`${actionBtn} border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100`}
          >
            {item.issue_receipt_no ? "Print Receipt" : "Print Record"}
          </button>
        </div>
      ),
    },
  ], [canApprove, canIssue, handleApprove, handleReject, openEdit, openIssue]);

  return (
    <RequirePermission permission="inventory.request">
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Material Requests" subtitle="Local-first request entry with online approval and issue workflow.">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void refresh(); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Sync Requests</button>
            <button type="button" onClick={openCreate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700">Create Request</button>
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Pending", value: summary.pending }, { label: "Approved", value: summary.approved }, { label: "Partial Issued", value: summary.partial }, { label: "Issued", value: summary.issued }].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="text-sm font-medium text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <DataTable
            columns={columns}
            data={tableRows}
            loading={loading}
            searchKeys={["request_no", "requested_by_employee_name", "warehouse_name", "project_label", "status", "issue_receipt_no", "search_materials"]}
            pageSize={TABLE_PAGE_SIZE}
            expandableRows
            compact
            renderExpandedRow={(row) => (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Project</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{row.project_label}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Requested</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.requested_at)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Issued At</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.issued_at)}</div></div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Receipt</div>
                      <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.issue_receipt_no || "-"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openRequestPrint(row.uuid)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:bg-[#1a1a2e] dark:text-slate-200 dark:hover:bg-[#23233a]"
                    >
                      {row.issue_receipt_no ? "Print Receipt" : "Print Record"}
                    </button>
                  </div>
                </div>
                {row.notes && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300">{row.notes}</div>}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a3e]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a0a0f] dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Requested</th>
                        <th className="px-4 py-3">Approved</th>
                        <th className="px-4 py-3">Issued</th>
                        <th className="px-4 py-3">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(row.items ?? []).map((item) => (
                        <tr key={item.uuid} className="border-t border-slate-200 dark:border-[#2a2a3e]">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{item.material_name || "Material"}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.unit}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(item.quantity_requested)}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(item.quantity_approved)}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(item.quantity_issued)}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(Math.max(0, Number(item.quantity_approved ?? 0) - Number(item.quantity_issued ?? 0)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <Modal isOpen={formOpen} onClose={closeForm} title={editing ? "Edit Material Request" : "Create Material Request"} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Warehouse" type="select" value={form.warehouse_id} onChange={(value) => setForm((prev) => ({ ...prev, warehouse_id: String(value) }))} options={warehouseOptions} required />
            <FormField label="Requested By" type="select" value={form.requested_by_employee_id} onChange={(value) => setForm((prev) => ({ ...prev, requested_by_employee_id: String(value) }))} options={employeeOptions} required />
            <FormField
              label="Project"
              type="select"
              value={form.project_id}
              onChange={(value) => setForm((prev) => ({ ...prev, project_id: String(value) }))}
              options={projectOptions}
              placeholder="Select project"
            />
          </div>
          <FormField label="Notes" type="textarea" value={form.notes} onChange={(value) => setForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />

          <div className="rounded-xl border border-slate-200 dark:border-[#2a2a3e]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#2a2a3e]">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Requested Items</h3>
                <p className="text-xs text-slate-500">Add one or more materials to this request.</p>
              </div>
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, createItem()] }))} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100">Add Item</button>
            </div>
            <div className="space-y-4 p-4">
              {form.items.map((item, index) => (
                <div key={item.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-[#2a2a3e]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Item {index + 1}</div>
                    {form.items.length > 1 && <button type="button" onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((entry) => entry.uuid !== item.uuid) }))} className="text-xs font-semibold text-red-600 hover:text-red-700">Remove</button>}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FormField label="Material" type="select" value={item.material_id} onChange={(value) => setItemField(item.uuid, "material_id", String(value))} options={materialOptions} required />
                    <FormField label="Unit" value={item.unit} onChange={(value) => setItemField(item.uuid, "unit", String(value))} required />
                    <FormField label="Quantity Requested" type="number" value={item.quantity_requested} onChange={(value) => setItemField(item.uuid, "quantity_requested", String(value))} required />
                  </div>
                  <div className="mt-3">
                    <FormField label="Item Notes" type="textarea" value={item.notes} onChange={(value) => setItemField(item.uuid, "notes", String(value))} rows={2} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitForm(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editing ? "Update Request" : "Create Request"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={issueOpen} onClose={closeIssue} title={issueTarget ? `Issue ${issueTarget.request_no}` : "Issue Material Request"} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="Issue Date" type="date" value={issueForm.issue_date} onChange={(value) => setIssueForm((prev) => ({ ...prev, issue_date: String(value) }))} required />
          </div>
          <FormField label="Issue Notes" type="textarea" value={issueForm.notes} onChange={(value) => setIssueForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />
          <div className="space-y-3">
            {issueForm.items.map((item) => (
              <div key={item.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-[#2a2a3e]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Material</div><div className="mt-1 font-medium text-slate-900 dark:text-white">{item.material_name}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Requested</div><div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.quantity_requested)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Approved</div><div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.quantity_approved)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Issued</div><div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.quantity_issued)}</div></div>
                  <div><div className="text-xs uppercase tracking-wide text-slate-500">Available Stock</div><div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.available_stock)}</div></div>
                  <FormField label="Issue Now" type="number" value={item.quantity_issue_now} onChange={(value) => setIssueForm((prev) => ({ ...prev, items: prev.items.map((entry) => entry.uuid === item.uuid ? { ...entry, quantity_issue_now: String(value) } : entry) }))} />
                </div>
              </div>
            ))}
          </div>
          {issueError && <p className="text-sm text-red-600">{issueError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeIssue} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitIssue(); }} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Issuing..." : "Issue Materials"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { void confirmDelete(); }}
        title="Delete Material Request"
        message="Are you sure you want to delete this material request?"
      />
    </RequirePermission>
  );
}
