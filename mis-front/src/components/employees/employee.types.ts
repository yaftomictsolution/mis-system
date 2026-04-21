export type SalaryType = "fixed" | "daily" | "project";
export type EmployeeStatus = "active" | "resign";
export type FormMode = "create" | "edit" | null;
const today = () => new Date().toISOString().slice(0, 10);

export type EmployeeFormData = {
  first_name: string;
  last_name: string;
  biometric_user_id: string;
  job_title: string;
  salary_type: SalaryType;
  base_salary: number;
  salary_currency_code: "USD" | "AFN";
  salary_effective_from: string;
  salary_change_reason: string;
  address: string;
  email: string;
  phone: number;
  status: string;
  hire_date: string;
};

export const createEmptyEmployeeForm = (): EmployeeFormData => ({

  first_name: "",
  last_name: "",
  biometric_user_id: "",
  job_title: "",
  salary_type: "fixed",
  base_salary: 0,
  salary_currency_code: "USD",
  salary_effective_from: today(),
  salary_change_reason: "",
  address: "",
  email: "",
  phone: 0,
  status: "active",
  hire_date: today(),
});
