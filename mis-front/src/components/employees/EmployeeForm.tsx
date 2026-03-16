"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion, number } from "framer-motion";
import { FormField } from "@/components/ui/FormField";
import type {
  EmployeeFormData,
  EmployeeStatus,
  SalaryType,
} from "@/components/employees/employee.types";

type EmployeeFormProps = {
  open: boolean;
  mode: "create" | "edit";
  value: EmployeeFormData;
  error?: string | null;
  submitting?: boolean;
  onChange: Dispatch<SetStateAction<EmployeeFormData>>;
  onCancel: () => void;
  onSubmit: () => void;
};

export default function EmployeeForm({
  open,
  mode,
  value,
  error,
  submitting = false,
  onChange,
  onCancel,
  onSubmit,
}: EmployeeFormProps) {
  const isEditing = mode === "edit";

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mb-6 overflow-hidden"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {isEditing ? "Update Apartment" : "Create Apartment"}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="First name"
                value={value.first_name}
                onChange={(v) => onChange((p) => ({ ...p, first_name: String(v) }))}
                placeholder="First name"
                required
              />
              <FormField
                label="Last name"
                value={value.last_name}
                onChange={(v) => onChange((p) => ({ ...p, last_name: String(v) }))}
                placeholder="Last name"
                required
              />
              <FormField
                label="Job title"
                value={value.job_title}
                onChange={(v) => onChange((p) => ({ ...p, job_title: String(v) }))}
                placeholder="Job title"
                required
              />
              <FormField
                label="Salary Type"
                type="select"
                value={value.salary_type}
                onChange={(v) => onChange((p) => ({ ...p, salary_type: v as SalaryType }))}
                options={[
                  { value: "fixed", label: "fixed" },
                  { value: "daily", label: "daily" },
                  { value: "project", label: "project" },
                ]}
                required
              />
              <FormField
                label="Base Salary"
                value={value.base_salary}
                onChange={(v) => onChange((p) => ({ ...p, base_salary: Number(v) }))}
                placeholder="Base salary"
              />
              <FormField
                label="Address"
                value={ value.address}
                onChange={(v) => onChange((p) => ({ ...p, address: String(v) }))}
                placeholder="Address"
              />
              <FormField
                label="Email"
                type="email"
                value={value.email}
                onChange={(v) => onChange((p) => ({ ...p, email: String(v) }))}
              />
              <FormField
                label="Phone"
                type="number"
                value={value.phone}
                onChange={(v) => onChange((p) => ({ ...p, phone: Number(v) || 0 }))}
              />
              <FormField
                label="Status"
                value={value.status}
                onChange={(v) => onChange((p) => ({ ...p, status: String(v)}))}
              />
              <FormField
                label="Hire Date"
                type="date"
                value={value.hire_date}
                onChange={(v) => onChange((p) => ({ ...p, hire_date: Date() }))}
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (isEditing ? "Updating..." : "Saving...") : isEditing ? "Update Apartment" : "Add Apartment"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
