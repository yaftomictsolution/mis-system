"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { EmployeeRow, ProjectRow } from "@/db/localDB";
import { notifyError } from "@/lib/notify";
import { employeePullToLocal, employeesListLocal } from "@/modules/employees/employees.repo";
import {
  projectCreate,
  projectDelete,
  projectsListLocal,
  projectsPullToLocal,
  projectUpdate,
  type ProjectInput,
} from "@/modules/projects/projects.repo";

type SyncCompleteDetail = { syncedAny?: boolean; cleaned?: boolean; entities?: string[] };
type ProjectFormState = {
  name: string;
  location: string;
  status: "planned" | "active" | "completed";
  start_date: string;
  end_date: string;
};
type ProjectTableRow = ProjectRow & { assigned_employee_names: string };
type ProjectAssignmentDraft = { id: string; name: string; job_title?: string | null };

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const PROJECT_SYNC_ENTITIES = new Set(["projects", "employees"]);

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function createEmptyForm(): ProjectFormState {
  return {
    name: "",
    location: "",
    status: "planned",
    start_date: "",
    end_date: "",
  };
}

function toDateInput(value?: number | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function normalizeAssignmentIds(row: Pick<ProjectRow, "assigned_employee_ids">): string[] {
  return (row.assigned_employee_ids ?? []).map((id) => String(id));
}

function normalizeForm(row: ProjectRow): ProjectFormState {
  return {
    name: row.name || "",
    location: row.location || "",
    status: row.status === "active" || row.status === "completed" ? row.status : "planned",
    start_date: toDateInput(row.start_date),
    end_date: toDateInput(row.end_date),
  };
}

function statusBadge(status: string) {
  if (status === "active") return <Badge color="emerald">active</Badge>;
  if (status === "completed") return <Badge color="blue">completed</Badge>;
  return <Badge color="amber">planned</Badge>;
}

function employeeDisplayName(employee: Pick<EmployeeRow, "first_name" | "last_name" | "email">): string {
  return [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || employee.email || "Employee";
}

function buildAssignmentPayload(project: ProjectRow, assignedEmployeeIds: string[]): ProjectInput {
  return {
    name: project.name,
    location: project.location || null,
    status: project.status === "active" || project.status === "completed" ? project.status : "planned",
    start_date: toDateInput(project.start_date) || null,
    end_date: toDateInput(project.end_date) || null,
    assigned_employee_ids: assignedEmployeeIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0),
  };
}

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [assignmentProject, setAssignmentProject] = useState<ProjectRow | null>(null);
  const [assignmentDraftIds, setAssignmentDraftIds] = useState<string[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(createEmptyForm());

  const loadLocal = useCallback(async () => {
    const [projectPage, employeePage] = await Promise.all([
      projectsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      employeesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
    ]);
    setRows(projectPage.items);
    setEmployees(employeePage.items);
  }, []);

  const refresh = useCallback(async (options?: { showLoader?: boolean; entitiesToPull?: string[] }) => {
    const showLoader = options?.showLoader ?? true;
    const entitiesToPull = options?.entitiesToPull ?? ["projects", "employees"];

    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      if (!entitiesToPull.length) return;

      let pullFailed = false;
      try {
        const tasks: Promise<unknown>[] = [];
        if (entitiesToPull.includes("projects")) tasks.push(projectsPullToLocal());
        if (entitiesToPull.includes("employees")) tasks.push(employeePullToLocal());
        await Promise.all(tasks);
      } catch {
        pullFailed = true;
      }

      await loadLocal();
      if (pullFailed && rows.length === 0) {
        notifyError("Unable to refresh projects from server. Using local data only.");
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
        void refresh({ showLoader: false, entitiesToPull: [] });
        return;
      }

      const entities = Array.isArray(detail?.entities) ? detail.entities : [];
      const touched = entities.filter((entity) => PROJECT_SYNC_ENTITIES.has(entity));
      if (!touched.length) return;
      void refresh({ showLoader: false, entitiesToPull: touched });
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  const summary = useMemo(() => ({
    total: rows.length,
    planned: rows.filter((row) => row.status === "planned").length,
    active: rows.filter((row) => row.status === "active").length,
    completed: rows.filter((row) => row.status === "completed").length,
  }), [rows]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormError(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: ProjectRow) => {
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

  const openAssignmentModal = useCallback((row: ProjectRow) => {
    setAssignmentProject(row);
    setAssignmentDraftIds(normalizeAssignmentIds(row));
    setAssignmentSaving(false);
    setAssignmentError(null);
  }, []);

  const closeAssignmentModal = useCallback(() => {
    setAssignmentProject(null);
    setAssignmentDraftIds([]);
    setAssignmentSaving(false);
    setAssignmentError(null);
  }, []);

  const submitForm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: ProjectInput = {
        name: form.name,
        location: form.location || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };

      if (editing?.uuid) {
        await projectUpdate(editing.uuid, payload);
      } else {
        await projectCreate(payload);
      }

      closeForm();
      await loadLocal();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save project.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editing?.uuid, form, loadLocal, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await projectDelete(pendingDelete.uuid);
      setPendingDelete(null);
      await loadLocal();
    } catch {
      // Repo already surfaces a readable message.
    }
  }, [loadLocal, pendingDelete]);

  const submitAssignment = useCallback(async () => {
    if (!assignmentProject?.uuid || assignmentSaving) return;
    setAssignmentSaving(true);
    setAssignmentError(null);
    try {
      await projectUpdate(assignmentProject.uuid, buildAssignmentPayload(assignmentProject, assignmentDraftIds));
      closeAssignmentModal();
      await loadLocal();
    } catch (error: unknown) {
      setAssignmentError(error instanceof Error ? error.message : "Unable to save employee assignments.");
    } finally {
      setAssignmentSaving(false);
    }
  }, [assignmentDraftIds, assignmentProject, assignmentSaving, closeAssignmentModal, loadLocal]);

  const tableRows = useMemo<ProjectTableRow[]>(() => rows.map((row) => ({
    ...row,
    assigned_employee_names: (row.assigned_employees ?? []).map((employee) => employee.name ?? "").filter(Boolean).join(", "),
  })), [rows]);

  const assignedEmployeeDrafts = useMemo<ProjectAssignmentDraft[]>(
    () =>
      assignmentDraftIds.reduce<ProjectAssignmentDraft[]>((acc, employeeId) => {
        const employee = employees.find((item) => String(item.id ?? "") === employeeId);
        if (employee) {
          acc.push({
            id: employeeId,
            name: employeeDisplayName(employee),
            job_title: employee.job_title || null,
          });
          return acc;
        }

        const assignedEmployee = assignmentProject?.assigned_employees?.find((item) => String(item.id ?? "") === employeeId);
        if (!assignedEmployee) return acc;

        acc.push({
          id: employeeId,
          name: assignedEmployee.name || `Employee ${employeeId}`,
          job_title: assignedEmployee.job_title || null,
        });
        return acc;
      }, []),
    [assignmentDraftIds, assignmentProject?.assigned_employees, employees]
  );

  const assignmentEmployeeIds = useMemo(() => new Set(assignmentDraftIds), [assignmentDraftIds]);

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((left, right) => {
        const leftId = String(left.id ?? "");
        const rightId = String(right.id ?? "");
        const leftAssigned = assignmentEmployeeIds.has(leftId);
        const rightAssigned = assignmentEmployeeIds.has(rightId);
        if (leftAssigned !== rightAssigned) return leftAssigned ? -1 : 1;
        return employeeDisplayName(left).localeCompare(employeeDisplayName(right));
      }),
    [assignmentEmployeeIds, employees]
  );

  const columns = useMemo<Column<ProjectTableRow>[]>(() => [
    { key: "name", label: "Project", render: (item) => <span className="font-semibold">{item.name}</span> },
    { key: "location", label: "Location", render: (item) => item.location || "-" },
    { key: "project_manager_name", label: "Manager", render: (item) => item.project_manager_name || "-" },
    {
      key: "assigned_employee_names",
      label: "Assigned",
      render: (item) => {
        const count = item.assigned_employee_ids?.length ?? 0;
        return (
          <div className="flex min-w-[8rem] flex-col items-start gap-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {count ? `${count} employee${count === 1 ? "" : "s"} assigned` : "No employees assigned"}
            </span>
            <button
              type="button"
              onClick={() => openAssignmentModal(item)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
            >
              Assign Employee
            </button>
          </div>
        );
      },
    },
    { key: "status", label: "Status", render: (item) => statusBadge(item.status) },
    { key: "start_date", label: "Start", render: (item) => toDateLabel(item.start_date) },
    { key: "end_date", label: "End", render: (item) => toDateLabel(item.end_date) },
    { key: "updated_at", label: "Updated", render: (item) => toDateLabel(item.updated_at) },
  ], [openAssignmentModal]);

  return (
    <RequirePermission permission={["projects.view", "inventory.request"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Projects" subtitle="Offline-first project master data for inventory and asset workflows.">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void refresh(); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Sync Projects
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Create Project
            </button>
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Total", value: summary.total }, { label: "Planned", value: summary.planned }, { label: "Active", value: summary.active }, { label: "Completed", value: summary.completed }].map((card) => (
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
            onEdit={openEdit}
            onDelete={setPendingDelete}
            searchKeys={["name", "location", "status", "project_manager_name", "assigned_employee_names"]}
            pageSize={TABLE_PAGE_SIZE}
            expandableRows
            compact
            renderExpandedRow={(row) => (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Manager</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.project_manager_name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Start</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.start_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">End</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{toDateLabel(row.end_date)}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Assigned Employees</div>
                  {row.assigned_employees?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.assigned_employees.map((employee) => (
                        <span key={`${row.uuid}-${employee.id ?? employee.uuid ?? employee.name}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-200">
                          {employee.name || "Employee"}{employee.job_title ? ` • ${employee.job_title}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-slate-500">No employees assigned.</div>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <Modal isOpen={formOpen} onClose={closeForm} title={editing ? "Edit Project" : "Create Project"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Project Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: String(value) }))} required />
            <FormField label="Location" value={form.location} onChange={(value) => setForm((prev) => ({ ...prev, location: String(value) }))} />
            <FormField
              label="Status"
              type="select"
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: String(value) as ProjectFormState["status"] }))}
              options={[
                { value: "planned", label: "Planned" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
              ]}
              required
            />
            <FormField label="Start Date" type="date" value={form.start_date} onChange={(value) => setForm((prev) => ({ ...prev, start_date: String(value) }))} />
            <FormField label="End Date" type="date" value={form.end_date} onChange={(value) => setForm((prev) => ({ ...prev, end_date: String(value) }))} />
          </div>
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
              onClick={() => { void submitForm(); }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : editing ? "Update Project" : "Create Project"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(assignmentProject)}
        onClose={closeAssignmentModal}
        title={assignmentProject ? `Assign Employees To ${assignmentProject.name}` : "Assign Employees To Project"}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Available Employees</h3>
              <p className="text-xs text-slate-500">
                Choose employees for {assignmentProject?.name || "this project"} from the list below.
              </p>
            </div>
            <div className="text-xs text-slate-500">{assignedEmployeeDrafts.length} selected</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedEmployees.map((employee) => {
              const employeeId = String(employee.id ?? "");
              const checked = assignmentEmployeeIds.has(employeeId);
              const fullName = employeeDisplayName(employee);
              return (
                <label key={employee.uuid} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${checked ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10" : "border-slate-200 bg-white dark:border-[#2a2a3e] dark:bg-[#12121a]"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setAssignmentDraftIds((prev) =>
                        event.target.checked
                          ? Array.from(new Set([...prev, employeeId]))
                          : prev.filter((value) => value !== employeeId)
                      )
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{fullName}</div>
                    <div className="mt-1 text-xs text-slate-500">{employee.job_title || "Employee"}</div>
                  </div>
                </label>
              );
            })}
          </div>
          {!employees.length && <div className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-[#2a2a3e]">No employees available yet.</div>}

          <div className="rounded-xl border border-slate-200 p-4 dark:border-[#2a2a3e]">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Assigned Employees</div>
            {assignedEmployeeDrafts.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {assignedEmployeeDrafts.map((employee) => (
                  <span key={employee.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-200">
                    {employee.name}{employee.job_title ? ` | ${employee.job_title}` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-500">No employees assigned yet.</div>
            )}
          </div>

          {assignmentError && <p className="text-sm text-red-600">{assignmentError}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeAssignmentModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={assignmentSaving || !assignmentProject}
              onClick={() => { void submitAssignment(); }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assignmentSaving ? "Saving..." : "Save Assignment"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { void confirmDelete(); }}
        title="Delete Project"
        message="Are you sure you want to delete this project? This delete will also sync when the device is online."
      />
    </RequirePermission>
  );
}
