"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Column } from "@/components/ui/DataTable";
import { EmployeeRow } from "@/db/localDB";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { SalaryType, EmployeeStatus } from "./employee.types";

const normalizeStatus = (status: string): EmployeeStatus => {
  const value = status.trim().toLowerCase();
  if (value === "active" || value === "resign") return value;
  return "active";
};

const normalizeSalaryType = (salaryType?: string | null): SalaryType => {
  const value = String(salaryType ?? "").trim().toLowerCase();
  if (value === "daily" || value === "project") return value;
  return "fixed";
};
export const toDateLabel = (value?: number | null): string => {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
};
const statusColor: Record<EmployeeStatus, "purple" | "emerald"> = {
  active: "emerald",
  resign: "purple",
};




export const employeeColumns: Column<EmployeeRow>[] = [
 
  {
    key: "first_name",
    label: "Employee",
    render: (item) => (
      <div className="space-y-1">
        <Link href={`/employees/${item.uuid}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
          {[item.first_name, item.last_name].filter(Boolean).join(" ").trim() || item.first_name}
        </Link>
        <div className="text-xs text-slate-500">View profile</div>
      </div>
    ),
  },
  {
    key: "job_title",
    label: "Job",
    render: (item) => (
      <span>
        {item.job_title}
      </span>
    ),
  },
  {
    key: "biometric_user_id",
    label: "Biometric ID",
    render: (item) => <span>{item.biometric_user_id || "-"}</span>,
  },
   {
    key: "salary_type",
    label: "Salary Type",
    render: (item) => {
      const usage = normalizeSalaryType(item.salary_type);
      return <Badge color={usage === "fixed" ? "blue" : "purple"}>{usage}</Badge>;
    },
  },
  {
    key: "base_salary",
    label: "Base Salary",
    render: (item) => (
      <span>{formatMoney(Number(item.base_salary ?? 0), normalizeCurrency(item.salary_currency_code ?? "USD"))}</span>
    ),
  },
  {
    key: "email",
    label: "Email",
    render: (item) => <span>{item.email}</span>,
  },
    {
    key: "phone",
    label: "Phone",
    render: (item) => <span>{item.phone}</span>,
  },
  {
    key: "hire_date",
    label: "Hire Date",
    render: (item) => <span>{toDateLabel(item.hire_date)}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (item) => {
      const status = normalizeStatus(item.status);
      return <Badge color={statusColor[status]}>{status}</Badge>;
    },
  },
];
