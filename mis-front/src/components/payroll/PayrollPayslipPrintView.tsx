"use client";

import type { EmployeeRow, SalaryPaymentRow } from "@/db/localDB";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import LetterheadPrintShell from "@/components/print/LetterheadPrintShell";

type Props = {
  payment: SalaryPaymentRow;
  employee?: EmployeeRow | null;
};

function money(value: number, currency: string = "USD"): string {
  return formatMoney(Number(value || 0), normalizeCurrency(currency));
}

function dateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

type BreakdownRow = {
  key: string;
  title: string;
  description: string;
  basis: string;
  amount: number;
  color?: string;
};

export default function PayrollPayslipPrintView({ payment, employee }: Props) {
  const slipLabel = `PS-${payment.uuid.slice(0, 8).toUpperCase()}`;
  const employeeName = payment.employee_name || [employee?.first_name, employee?.last_name].filter(Boolean).join(" ").trim() || "Employee";
  const phoneLabel =
    employee?.phone !== null && employee?.phone !== undefined && String(employee.phone).trim()
      ? String(employee.phone)
      : "-";
  const preparedBy = payment.user_name || "System";
  const salaryCurrency = normalizeCurrency(payment.salary_currency_code || "USD");
  const paymentCurrency = normalizeCurrency(payment.payment_currency_code || payment.account_currency || payment.salary_currency_code || "USD");
  const grossSalary = Number(payment.gross_salary || 0);
  const advanceDeducted = Number(payment.advance_deducted || 0);
  const taxDeducted = Number(payment.tax_deducted || 0);
  const otherDeductions = Number(payment.other_deductions || 0);
  const totalDeductions = Number((advanceDeducted + taxDeducted + otherDeductions).toFixed(2));
  const netSalary = Number(payment.net_salary || 0);
  const accountPayout = payment.net_salary_account_amount !== null && payment.net_salary_account_amount !== undefined
    ? Number(payment.net_salary_account_amount)
    : null;
  const exchangeRateLabel =
    payment.exchange_rate_snapshot && Number(payment.exchange_rate_snapshot) > 0
      ? `1 USD = ${Number(payment.exchange_rate_snapshot).toFixed(4)} AFN`
      : "-";
  const note =
    "This payslip shows the recorded salary payment, including approved advance recovery and tax deduction where applicable.";

  const rows: BreakdownRow[] = [
    {
      key: "gross",
      title: "Gross Salary",
      description: `Contract salary for ${payment.period || "the selected period"}`,
      basis: salaryCurrency,
      amount: grossSalary,
    },
    {
      key: "advance",
      title: "Advance Deducted",
      description: "Approved advance amount recovered from this salary payment",
      basis: salaryCurrency,
      amount: advanceDeducted,
      color: "text-amber-800",
    },
    {
      key: "tax",
      title: "Tax Deducted",
      description: "Employee tax deduction calculated automatically from the saved percentage",
      basis: `${Number(payment.tax_percentage || 0).toFixed(2)}%`,
      amount: taxDeducted,
      color: "text-rose-800",
    },
    {
      key: "other",
      title: "Other Deductions",
      description: "Any remaining manual payroll adjustment kept on the salary payment record",
      basis: salaryCurrency,
      amount: otherDeductions,
    },
    {
      key: "net",
      title: "Net Salary",
      description: "Final payable amount after all deductions",
      basis: salaryCurrency,
      amount: netSalary,
      color: "text-emerald-800",
    },
  ].filter((row) => {
    if (row.key === "advance" || row.key === "other") {
      return Math.abs(row.amount) > 0;
    }

    return true;
  });

  const summaryRows = [
    { label: "Gross Salary", value: money(grossSalary, salaryCurrency) },
    { label: "Total Deductions", value: money(totalDeductions, salaryCurrency) },
    { label: "Net Salary", value: money(netSalary, salaryCurrency) },
    { label: "Account Payout", value: accountPayout !== null ? money(accountPayout, paymentCurrency) : "-" },
    { label: "Rate Used", value: exchangeRateLabel },
    { label: "Salary Currency", value: salaryCurrency },
  ];

  return (
    <LetterheadPrintShell
      title="Salary Payslip"
      subtitle={`${employeeName} - ${slipLabel}`}
      contentClassName="px-[12mm] pb-[12mm] pt-[34mm]"
    >
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="w-[60%]">
          <p className="text-[14px] font-bold">Employee Name: <span className="font-normal">{employeeName}</span></p>
          <p className="mt-1 text-[14px] font-bold">Job Title: <span className="font-normal">{employee?.job_title || "-"}</span></p>
          <div className="mt-2">
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-1.5 text-left">Phone No:</th>
                  <td className="border border-black px-2 py-1.5">{phoneLabel}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-1.5 text-left">Email:</th>
                  <td className="border border-black px-2 py-1.5">{employee?.email || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-1.5 text-left">Address:</th>
                  <td className="border border-black px-2 py-1.5">{employee?.address || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-1.5 text-left">Employment Status:</th>
                  <td className="border border-black px-2 py-1.5">{employee?.status || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-1.5 text-left">Prepared By:</th>
                  <td className="border border-black px-2 py-1.5">{preparedBy}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[32%] text-[12px]">
          <div className="space-y-3 border border-black bg-white/70 px-3 py-3">
            <p><span className="font-bold">Receipt Type:</span> Salary Payment</p>
            <p><span className="font-bold">Period:</span> {payment.period || "-"}</p>
            <p><span className="font-bold">Status:</span> {payment.status || "-"}</p>
            <div className="mt-2 border-t border-black pt-2 text-[12px]">
              <p><span className="font-bold">Date:</span> {dateLabel(payment.paid_at)}</p>
              <p className="mt-1.5"><span className="font-bold">S.No:</span> {slipLabel}</p>
              <p className="mt-1.5"><span className="font-bold">Payment Account:</span> {payment.account_name || "-"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="w-[6%] border border-black px-2 py-1.5 text-center">Item</th>
              <th className="w-[40%] border border-black px-2 py-1.5 text-left">Description</th>
              <th className="w-[22%] border border-black px-2 py-1.5 text-center">Basis</th>
              <th className="w-[32%] border border-black px-2 py-1.5 text-center">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="border border-black px-2 py-1.5 text-center">{index + 1}</td>
                <td className="border border-black px-2 py-1.5">
                  <div className="font-semibold">{row.title}</div>
                  <div className="text-[10.5px] leading-4 text-slate-600">{row.description}</div>
                </td>
                <td className="border border-black px-2 py-1.5 text-center">{row.basis}</td>
                <td className={`border border-black px-2 py-1.5 text-center font-semibold ${row.color || "text-slate-900"}`}>
                  {money(row.amount, salaryCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td rowSpan={summaryRows.length} className="w-[63%] border border-black align-top px-3 py-2">
                <div className="font-bold">Note or Special Comments:</div>
                <div className="mt-1.5 leading-5">{note}</div>
              </td>
              <th className="w-[17%] border border-black px-2 py-1.5 text-center">{summaryRows[0]?.label}</th>
              <td className="w-[20%] border border-black px-2 py-1.5 text-center">{summaryRows[0]?.value}</td>
            </tr>
            {summaryRows.slice(1).map((row) => (
              <tr key={row.label}>
                <th className="border border-black px-2 py-1.5 text-center">{row.label}</th>
                <td className="border border-black px-2 py-1.5 text-center">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-evenly text-[11px] font-semibold">
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-4" />
          <p className="mt-2">Prepared By</p>
        </div>
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-4" />
          <p className="mt-2">Employee Signature</p>
        </div>
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-4" />
          <p className="mt-2">Authorized Signature</p>
        </div>
      </div>
    </LetterheadPrintShell>
  );
}
