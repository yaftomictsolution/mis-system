import { db, type EmployeeRow, type SalaryPaymentRow } from "@/db/localDB";

export type PayrollPayslipBundle = {
  payment: SalaryPaymentRow | null;
  employee: EmployeeRow | null;
};

export async function loadPayrollPayslipBundle(uuid: string): Promise<PayrollPayslipBundle> {
  const payment = await db.salary_payments.get(uuid);
  if (!payment) {
    return { payment: null, employee: null };
  }

  const employee = await db.employees
    .filter((item) => Number(item.id) === Number(payment.employee_id))
    .first();

  return {
    payment,
    employee: employee ?? null,
  };
}
