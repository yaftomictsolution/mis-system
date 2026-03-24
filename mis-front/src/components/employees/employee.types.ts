export type SalaryType = "fixed" | "daily" | "project";
export type EmployeeStatus = "active" | "resign";
export type FormMode = "create" | "edit" | null;
const today = () => new Date().toISOString().slice(0, 10);

export type EmployeeFormData = {
  first_name: string;
  last_name: string;
  job_title: string;
  salary_type: SalaryType;
  base_salary: number;
  address: string;
  email: string;
  phone: number;
  status: string;
  hire_date: string;
};

export const createEmptyEmployeeForm = (): EmployeeFormData => ({

  first_name: "",
  last_name: "",
  job_title: "",
  salary_type: "fixed",
  base_salary: 0,
  address: "",
  email: "",
  phone: 0,
  status: "active",
  hire_date: today(),
});
