"use client";
import {useState,useCallback,useEffect} from 'react'
import RequirePermission from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui/PageHeader";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { employeeColumns } from "@/components/employees/employee.columns";
import { EmployeeRow } from "@/db/localDB";
import EmployeeForm from "@/components/employees/EmployeeForm";

import {
  createEmptyEmployeeForm,
  type EmployeeFormData,
  type FormMode,
} from "@/components/employees/employee.types";

import {
  employeesListLocal,
  employeePullToLocal,
  employeeCreate,
} from "@/modules/employees/employees.repo";

const LOCAL_LIST_PAGE_SIZE = 200;
const TABLE_PAGE_SIZE = 10;

export default function EmployeePage() {

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EmployeeFormData>(createEmptyEmployeeForm());
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


  const handleSave = useCallback(async () => {
      
      if (saving) return;
      setSaving(true);
      setFormError(null);
      try {
        const payload = {
          first_name: form.first_name,
          last_name:  form.last_name,
          job_title:  form.job_title,
          salary_type:  form.salary_type,
          base_salary:  form.base_salary,
          address:  form.address,
          email:  form.email,
          phone:  form.phone,
          status:  form.status,
          hire_date:  form.hire_date,
        };
  
        if (editingUuid) {
          // await apartmentUpdate(editingUuid, payload);
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
              // onEdit={openEditForm}
              // onDelete={setPendingDelete}
              searchKeys={["first_name", "last_name", "status", "salary_type"]}
              pageSize={TABLE_PAGE_SIZE}
            />
        </div>
    </RequirePermission>
  );
}
