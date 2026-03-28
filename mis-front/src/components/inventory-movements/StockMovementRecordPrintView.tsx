"use client";

import type { EmployeeRow, MaterialRequestRow, ProjectRow, StockMovementRow, WarehouseRow } from "@/db/localDB";

type Props = {
  anchor: StockMovementRow;
  movements: StockMovementRow[];
  request: MaterialRequestRow | null;
  warehouse: WarehouseRow | null;
  employee: EmployeeRow | null;
  project: ProjectRow | null;
};

function qty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function dateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleString();
}

function titleForMovement(anchor: StockMovementRow): string {
  if (anchor.reference_type === "request_issue" || anchor.movement_type === "OUT") return "Material Issue Record";
  if (anchor.movement_type === "IN" || anchor.movement_type === "TRANSFER_IN") return "Material Receipt Record";
  if (anchor.movement_type === "RETURN") return "Material Return Record";
  return "Stock Movement Record";
}

function employeeName(employee: EmployeeRow | null, fallback?: string | null): string {
  if (fallback) return fallback;
  if (!employee) return "-";
  return [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || employee.email || "-";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}

export default function StockMovementRecordPrintView({ anchor, movements, request, warehouse, employee, project }: Props) {
  const heading = titleForMovement(anchor);
  const referenceNo = anchor.reference_no || request?.issue_receipt_no || request?.request_no || anchor.uuid;
  const requester = employeeName(employee, anchor.employee_name || request?.requested_by_employee_name);
  const totalQty = movements.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 14mm;
        }

        html,
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 py-6 text-slate-950 print:bg-white print:py-0">
        <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-3 px-4 print:hidden">
          <div>
            <div className="text-lg font-bold text-slate-900">{heading}</div>
            <div className="text-sm text-slate-500">{referenceNo}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 px-8 py-8 print:px-0 print:pt-0">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">{heading}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Printable stock ledger record generated from the locally cached movement history.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-5 py-4 text-right text-white">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-300">Reference</div>
                <div className="mt-1 text-lg font-bold">{referenceNo}</div>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-8 py-8 print:px-0">
            <section>
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Document Summary</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Movement Type" value={anchor.movement_type || "-"} />
                <Field label="Reference Type" value={anchor.reference_type || "-"} />
                <Field label="Warehouse" value={anchor.warehouse_name || warehouse?.name || "-"} />
                <Field label="Project" value={anchor.project_name || request?.project_name || project?.name || "No project"} />
                <Field label="Employee" value={requester} />
                <Field label="Movement Date" value={dateLabel(anchor.movement_date)} />
                <Field label="Approved By" value={anchor.approved_by_user_name || request?.approved_by_user_name || "-"} />
                <Field label="Issued By" value={anchor.issued_by_user_name || request?.issued_by_user_name || "-"} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Movement Lines</div>
                <div className="text-sm font-semibold text-slate-700">Total Quantity: {qty(totalQty)}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3">Project</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.uuid} className="border-t border-slate-200">
                        <td className="px-4 py-3 text-slate-700">{dateLabel(movement.movement_date)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{movement.material_name || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{movement.warehouse_name || anchor.warehouse_name || warehouse?.name || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{movement.project_name || request?.project_name || project?.name || "No project"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {qty(movement.quantity)} {movement.material_unit || ""}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{movement.movement_type || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Notes</div>
              <p className="text-sm leading-6 text-slate-600">
                {anchor.notes || request?.notes || "No notes were recorded for this movement document."}
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
