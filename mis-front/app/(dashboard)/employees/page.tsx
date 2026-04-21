"use client";
import {useState,useCallback,useEffect} from 'react'
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { employeeColumns } from "@/components/employees/employee.columns";
import { EmployeeRow } from "@/db/localDB";
import EmployeeForm from "@/components/employees/EmployeeForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import {
  createEmptyEmployeeForm,
  type EmployeeStatus,
  type SalaryType,
  type EmployeeFormData,
  type FormMode,
} from "@/components/employees/employee.types";
import {
  employeesListLocal,
  employeePullToLocal,
  employeeCreate,
  employeeDelete,
  employeeUpdate
} from "@/modules/employees/employees.repo";

const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;

function normalizeSalaryType(value: string | null | undefined): SalaryType {
  return value === "daily" || value === "project" ? value : "fixed";
}

function normalizeEmployeeStatus(value: string | null | undefined): EmployeeStatus {
  return value === "resign" ? "resign" : "active";
}

const toDateInput = (v?: number | null): string => {
  if (!v || !Number.isFinite(v)) return new Date().toISOString().slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
};



const toForm = (row: EmployeeRow): EmployeeFormData => ({

    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    biometric_user_id: row.biometric_user_id ?? "",
    job_title: row.job_title ?? "",
    salary_type: normalizeSalaryType(row.salary_type),
    base_salary: row.base_salary ?? 0,
    salary_currency_code: (String(row.salary_currency_code ?? "USD").toUpperCase() === "AFN" ? "AFN" : "USD"),
    salary_effective_from: toDateInput(row.hire_date),
    salary_change_reason: "",
    address: row.address ?? "",
    email: row.email ?? "",
    phone: row.phone ?? 0,
    status: normalizeEmployeeStatus(row.status),
    hire_date: toDateInput(row.hire_date),
  });

export default function EmployeePage() {

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EmployeeFormData>(createEmptyEmployeeForm());
  const [pendingDelete, setPendingDelete] = useState<EmployeeRow | null>(null);
  
  const [saving, setSaving] = useState(false);
  const isEditing = formMode === "edit";

  const loadLocal = useCallback(async () => {
    const local = await employeesListLocal({
      page: 1,
      pageSize: LOCAL_LIST_PAGE_SIZE,
    });
    setRows(local.items.map((item) => ({ ...item })));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadLocal();
      try {
        await employeePullToLocal();
      } catch {}
      await loadLocal();
    } finally {
      setLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = () => {
      void refresh();
    };
    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
    };
  }, [refresh]);

  const closeForm = useCallback(() => {
    setFormMode(null);
    setEditingUuid(null);
    setFormError(null);
    // setForm(createEmptyApartmentForm());
  }, []);

  const openCreateForm = useCallback(() => {

    if (formMode === "create") {
      closeForm();
      return;
    }
    setFormMode("create");
    setEditingUuid(null);
    setFormError(null);
    setForm(createEmptyEmployeeForm());
  }, [closeForm, formMode]);

    const openEditForm = useCallback((row: EmployeeRow) => {

    setFormMode("edit");
    setEditingUuid(row.uuid);
    setFormError(null);
    setForm(toForm(row));
  }, []);

  const handleSave = useCallback(async () => {
      
      if (saving) return;

      setSaving(true);
      setFormError(null);

      try {
        const payload = {
          first_name: form.first_name,
          last_name:  form.last_name,
          biometric_user_id: form.biometric_user_id,
          job_title:  form.job_title,
          salary_type:  form.salary_type,
          base_salary:  form.base_salary,
          salary_currency_code: form.salary_currency_code,
          salary_effective_from: form.salary_effective_from,
          salary_change_reason: form.salary_change_reason,
          address:  form.address,
          email:  form.email,
          phone:  form.phone,
          status:  form.status,
          hire_date:  form.hire_date,
        };
        if (editingUuid) {
          await employeeUpdate(editingUuid, payload);
        } else {
          await employeeCreate(payload);
        }
        closeForm();
        await refresh();
      } catch (error: unknown) {
        setFormError(error instanceof Error ? error.message : "Save failed.");
      } finally {
        setSaving(false);
      }
  }, [closeForm, editingUuid, form, refresh, saving]);
  
  const handleDelete = useCallback(async () => {
    if (!pendingDelete?.uuid) return;
    try {
      await employeeDelete(pendingDelete.uuid);
      if (editingUuid === pendingDelete.uuid) {
        closeForm();
      }
      setPendingDelete(null);
      await refresh();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }, [closeForm, editingUuid, pendingDelete, refresh]);

  return (
    <RequirePermission permission="employees.view">
        <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
            <PageHeader title="Employee" subtitle="Manage employee records with online and offline CRUD">
              <button
                onClick={openCreateForm}
                type="button"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
              <Plus size={16} />
              {formMode === "create" ? "Hide Form" : "Create Employee"}
            </button>
          </PageHeader>
          
          <EmployeeForm
            open={Boolean(formMode)}
            mode={isEditing ? "edit" : "create"}
            value={form}
            error={formError}
            submitting={saving}
            onChange={setForm}
            onCancel={closeForm}
            onSubmit={() => {
              void handleSave();
            }}
          />
          <DataTable
            columns={employeeColumns}
            data={rows}
            loading={loading}
            onEdit={openEditForm}
            onDelete={setPendingDelete}
            searchKeys={["first_name", "last_name", "biometric_user_id", "status", "salary_type"]}
            pageSize={TABLE_PAGE_SIZE}
          />
          <ConfirmDialog
            isOpen={Boolean(pendingDelete)}
            onClose={() => setPendingDelete(null)}
            onConfirm={() => {
              void handleDelete();
            }}
            title="Delete Employee"
            message={`Are you sure you want to delete Employee ${pendingDelete?.first_name ?? ""}? This action cannot be undone.`}
          />
        </div>
    </RequirePermission>
  );
}
