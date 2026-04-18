"use client";

import type { EmployeeRow, MaterialRequestRow, ProjectRow, StockMovementRow, WarehouseRow } from "@/db/localDB";
import LetterheadPrintShell from "@/components/print/LetterheadPrintShell";

type Props = {
  request: MaterialRequestRow;
  warehouse: WarehouseRow | null;
  employee: EmployeeRow | null;
  project: ProjectRow | null;
  movements: StockMovementRow[];
};

function qty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function dateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function employeeName(employee: EmployeeRow | null, fallback?: string | null): string {
  if (fallback) return fallback;
  if (!employee) return "-";
  return [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() || employee.email || "-";
}

export default function MaterialIssueReceiptPrintView({
  request,
  warehouse,
  employee,
  project,
  movements,
}: Props) {
  const isIssued = request.status === "issued" || request.status === "partial_issued";
  const heading = isIssued ? "Material Issue Receipt" : "Material Request Record";
  const documentNo = request.issue_receipt_no || request.request_no;
  const requester = employeeName(employee, request.requested_by_employee_name);
  const requestedTotal = (request.items ?? []).reduce((sum, item) => sum + Number(item.quantity_requested ?? 0), 0);
  const issuedTotal = (request.items ?? []).reduce((sum, item) => sum + Number(item.quantity_issued ?? 0), 0);
  const issueDate = request.issued_at ?? request.requested_at ?? request.updated_at;
  const note = request.notes || `Inventory request ${request.request_no} was prepared for warehouse issue workflow.`;

  return (
    <LetterheadPrintShell title={heading} subtitle={`Receipt ${documentNo}`}>
      <div className="mt-10 flex items-start justify-between gap-6">
        <div className="w-[60%]">
          <p className="text-[16px] font-bold">
            Warehouse Name: <span className="font-normal">{request.warehouse_name || warehouse?.name || "-"}</span>
          </p>
          <p className="mt-2 text-[16px] font-bold">
            Project / Requester:{" "}
            <span className="font-normal">
              {request.project_name || project?.name || "No project"} / {requester}
            </span>
          </p>
          <div className="mt-3">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Request No:</th>
                  <td className="border border-black px-2 py-2">{request.request_no || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Receipt No:</th>
                  <td className="border border-black px-2 py-2">{request.issue_receipt_no || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Approved By:</th>
                  <td className="border border-black px-2 py-2">{request.approved_by_user_name || "-"}</td>
                </tr>
                <tr>
                  <th className="w-[28%] border border-black px-2 py-2 text-left">Issued By:</th>
                  <td className="border border-black px-2 py-2">{request.issued_by_user_name || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[32%] text-[14px]">
          <div className="space-y-3 border border-black bg-white/70 px-3 py-3">
            <p>
              <span className="font-bold">Receipt Type:</span> Material Request Issue
            </p>
            <p>
              <span className="font-bold">Status:</span> {request.status || "-"}
            </p>
            <p>
              <span className="font-bold">Requested Qty:</span> {qty(requestedTotal)}
            </p>
            <p>
              <span className="font-bold">Issued Qty:</span> {qty(issuedTotal)}
            </p>
            <div className="mt-4 border-t border-black pt-3 text-[13px]">
              <p>
                <span className="font-bold">Date:</span> {dateLabel(issueDate)}
              </p>
              <p className="mt-2">
                <span className="font-bold">S.No:</span> {documentNo}
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
              <th className="w-[30%] border border-black px-2 py-2 text-left">Material</th>
              <th className="w-[10%] border border-black px-2 py-2 text-center">Unit</th>
              <th className="w-[14%] border border-black px-2 py-2 text-center">Requested</th>
              <th className="w-[14%] border border-black px-2 py-2 text-center">Approved</th>
              <th className="w-[14%] border border-black px-2 py-2 text-center">Issued</th>
              <th className="w-[12%] border border-black px-2 py-2 text-center">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {(request.items ?? []).length ? (
              (request.items ?? []).map((item, index) => {
                const remaining = Math.max(0, Number(item.quantity_approved ?? 0) - Number(item.quantity_issued ?? 0));
                return (
                  <tr key={item.uuid}>
                    <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
                    <td className="border border-black px-2 py-2">{item.material_name || "Material"}</td>
                    <td className="border border-black px-2 py-2 text-center">{item.unit || "-"}</td>
                    <td className="border border-black px-2 py-2 text-center">{qty(item.quantity_requested)}</td>
                    <td className="border border-black px-2 py-2 text-center">{qty(item.quantity_approved)}</td>
                    <td className="border border-black px-2 py-2 text-center">{qty(item.quantity_issued)}</td>
                    <td className="border border-black px-2 py-2 text-center">{qty(remaining)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="border border-black px-3 py-6 text-center">
                  No material request items were available in local storage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr>
              <td rowSpan={6} className="w-[63%] border border-black align-top px-3 py-3">
                <div className="font-bold">Note or Special Comments:</div>
                <div className="mt-2 leading-6">{note}</div>
                {movements.length > 0 ? (
                  <div className="mt-4 border-t border-slate-300 pt-3 text-[12px]">
                    <div className="font-semibold">Movement History</div>
                    <div className="mt-2 space-y-1">
                      {movements.slice(0, 4).map((movement) => (
                        <div key={movement.uuid}>
                          {dateLabel(movement.movement_date)} | {movement.material_name || "-"} | {qty(movement.quantity)}{" "}
                          {movement.material_unit || ""}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </td>
              <th className="w-[17%] border border-black px-2 py-2 text-center">Request No</th>
              <td className="w-[20%] border border-black px-2 py-2 text-center">{request.request_no || "-"}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Warehouse</th>
              <td className="border border-black px-2 py-2 text-center">{request.warehouse_name || warehouse?.name || "-"}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Project</th>
              <td className="border border-black px-2 py-2 text-center">{request.project_name || project?.name || "-"}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Requester</th>
              <td className="border border-black px-2 py-2 text-center">{requester}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Requested Qty</th>
              <td className="border border-black px-2 py-2 text-center">{qty(requestedTotal)}</td>
            </tr>
            <tr>
              <th className="border border-black px-2 py-2 text-center">Issued Qty</th>
              <td className="border border-black px-2 py-2 text-center">{qty(issuedTotal)}</td>
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
