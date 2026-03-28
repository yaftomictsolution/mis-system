"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ProjectRow } from "@/db/localDB";
import { notifyError } from "@/lib/notify";
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

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const PROJECT_SYNC_ENTITIES = new Set(["projects"]);

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

function normalizeForm(row: ProjectRow): ProjectFormState {
  return {
    name: row.name || "",
    location: row.location || "",
    status: row.status === "active" || row.status === "completed" ? row.status : "planned",
    start_date: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : "",
    end_date: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : "",
  };
}

function statusBadge(status: string) {
  if (status === "active") return <Badge color="emerald">active</Badge>;
  if (status === "completed") return <Badge color="blue">completed</Badge>;
  return <Badge color="amber">planned</Badge>;
}

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(createEmptyForm());

  const loadLocal = useCallback(async () => {
    const page = await projectsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE });
    setRows(page.items);
  }, []);

  const refresh = useCallback(async (options?: { showLoader?: boolean; entitiesToPull?: string[] }) => {
    const showLoader = options?.showLoader ?? true;
    const entitiesToPull = options?.entitiesToPull ?? ["projects"];

    if (showLoader) setLoading(true);
    try {
      await loadLocal();
      if (!entitiesToPull.length) return;

      let pullFailed = false;
      try {
        if (entitiesToPull.includes("projects")) {
          await projectsPullToLocal();
        }
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

  const columns = useMemo<Column<ProjectRow>[]>(() => [
    { key: "name", label: "Project", render: (item) => <span className="font-semibold">{item.name}</span> },
    { key: "location", label: "Location", render: (item) => item.location || "-" },
    { key: "status", label: "Status", render: (item) => statusBadge(item.status) },
    { key: "start_date", label: "Start", render: (item) => toDateLabel(item.start_date) },
    { key: "end_date", label: "End", render: (item) => toDateLabel(item.end_date) },
    { key: "updated_at", label: "Updated", render: (item) => toDateLabel(item.updated_at) },
  ], []);

  return (
    <RequirePermission permission="inventory.request">
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
            data={rows}
            loading={loading}
            onEdit={openEdit}
            onDelete={setPendingDelete}
            searchKeys={["name", "location", "status"]}
            pageSize={TABLE_PAGE_SIZE}
            compact
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
