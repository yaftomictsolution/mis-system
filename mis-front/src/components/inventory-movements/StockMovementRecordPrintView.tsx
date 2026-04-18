"use client";

import type { EmployeeRow, MaterialRequestRow, ProjectRow, StockMovementRow, WarehouseRow } from "@/db/localDB";
import LetterheadPrintShell from "@/components/print/LetterheadPrintShell";

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
  return new Date(value).toLocaleDateString();
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

function warehouseLabel(
  movement: StockMovementRow,
  anchor: StockMovementRow,
  warehouse: WarehouseRow | null,
): string {
  return movement.warehouse_name || anchor.warehouse_name || warehouse?.name || "-";
}

function projectLabel(
  movement: StockMovementRow,
  request: MaterialRequestRow | null,
  project: ProjectRow | null,
): string {
  return movement.project_name || request?.project_name || project?.name || "No project";
}

export default function StockMovementRecordPrintView({
  anchor,
  movements,
  request,
  warehouse,
  employee,
  project,
}: Props) {
  const heading = titleForMovement(anchor);
  const referenceNo = anchor.reference_no || request?.issue_receipt_no || request?.request_no || anchor.uuid;
  const requester = employeeName(employee, anchor.employee_name || request?.requested_by_employee_name);
  const issueDate = anchor.movement_date ?? request?.issued_at ?? request?.requested_at ?? anchor.updated_at;
  const movementRows = movements.length > 0 ? movements : [anchor];
  const totalQty = movementRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const note =
    anchor.notes ||
    request?.notes ||
    `This receipt summarizes the cached stock movement history for reference ${referenceNo}.`;

  return (
    <LetterheadPrintShell title={heading} subtitle={`Record ${referenceNo}`}>
      <div className="mt-10 flex items-start justify-between gap-6">
        <div className="w-[60%]">
          <p className="text-[16px] font-bold">
            Warehouse Name: <span className="font-normal">{anchor.warehouse_name || warehouse?.name || "-"}</span>
          </p>
          <p className="mt-2 text-[16px] font-bold">
            Project / Requester:{" "}
            <span className="font-normal">
              {request?.project_name || project?.name || "No project"} / {requester}
            </span>
          </p>
          <div className="mt-3">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Reference Type:</th>
                  <td className="border border-black px-2 py-2">{anchor.reference_type || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Movement Type:</th>
                  <td className="border border-black px-2 py-2">{anchor.movement_type || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Approved By:</th>
                  <td className="border border-black px-2 py-2">
                    {anchor.approved_by_user_name || request?.approved_by_user_name || "-"}
                  </td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Issued By:</th>
                  <td className="border border-black px-2 py-2">
                    {anchor.issued_by_user_name || request?.issued_by_user_name || "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[32%] text-[14px]">
          <div className="space-y-3 border border-black bg-white/70 px-3 py-3">
            <p>
              <span className="font-bold">Receipt Type:</span> Inventory Movement Record
            </p>
            <p>
              <span className="font-bold">Lines:</span> {movementRows.length}
            </p>
            <p>
              <span className="font-bold">Total Quantity:</span> {qty(totalQty)}
            </p>
            <div className="mt-4 border-t border-black pt-3 text-[13px]">
              <p>
                <span className="font-bold">Date:</span> {dateLabel(issueDate)}
              </p>
              <p className="mt-2">
                <span className="font-bold">S.No:</span> {referenceNo}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-[6%] border border-black px-2 py-2 text-center">Item</th>
              <th className="w-[26%] border border-black px-2 py-2 text-left">Material</th>
              <th className="w-[13%] border border-black px-2 py-2 text-center">Date</th>
              <th className="w-[18%] border border-black px-2 py-2 text-center">Warehouse</th>
              <th className="w-[18%] border border-black px-2 py-2 text-center">Project</th>
              <th className="w-[11%] border border-black px-2 py-2 text-center">Quantity</th>
              <th className="w-[8%] border border-black px-2 py-2 text-center">Type</th>
            </tr>
          </thead>
          <tbody>
            {movementRows.map((movement, index) => (
              <tr key={movement.uuid}>
                <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
                <td className="border border-black px-2 py-2">
                  <div className="font-medium">{movement.material_name || "-"}</div>
                  {movement.material_unit ? (
                    <div className="text-[11px] text-slate-600">{movement.material_unit}</div>
                  ) : null}
                </td>
                <td className="border border-black px-2 py-2 text-center">{dateLabel(movement.movement_date)}</td>
                <td className="border border-black px-2 py-2 text-center">{warehouseLabel(movement, anchor, warehouse)}</td>
                <td className="border border-black px-2 py-2 text-center">{projectLabel(movement, request, project)}</td>
                <td className="border border-black px-2 py-2 text-center">
                  {qty(movement.quantity)} {movement.material_unit || ""}
                </td>
                <td className="border border-black px-2 py-2 text-center">{movement.movement_type || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr>
              <td rowSpan={5} className="w-[63%] border border-black align-top px-3 py-3">
                <div className="font-bold">Note or Special Comments:</div>
                <div className="mt-2 leading-6">{note}</div>
              </td>
              <th className="w-[17%] border border-black px-2 py-2 text-center">Reference</th>
              <td className="w-[20%] border border-black px-2 py-2 text-center">{referenceNo}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Requester</th>
              <td className="border border-black px-2 py-2 text-center">{requester}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Warehouse</th>
              <td className="border border-black px-2 py-2 text-center">{anchor.warehouse_name || warehouse?.name || "-"}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Project</th>
              <td className="border border-black px-2 py-2 text-center">{request?.project_name || project?.name || "-"}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Total Qty</th>
              <td className="border border-black px-2 py-2 text-center">{qty(totalQty)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-12 flex justify-evenly text-[12px] font-semibold">
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-6" />
          <p className="mt-3">Prepared By</p>
        </div>
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-6" />
          <p className="mt-3">Warehouse Signature</p>
        </div>
        <div className="min-w-[45mm] text-center">
          <div className="border-b border-black pb-6" />
          <p className="mt-3">Authorized Signature</p>
        </div>
      </div>
    </LetterheadPrintShell>
  );
}
