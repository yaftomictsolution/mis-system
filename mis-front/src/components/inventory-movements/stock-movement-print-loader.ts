"use client";

import {
  db,
  type EmployeeRow,
  type MaterialRequestRow,
  type ProjectRow,
  type StockMovementRow,
  type WarehouseRow,
} from "@/db/localDB";

export type StockMovementPrintBundle = {
  anchor: StockMovementRow | null;
  movements: StockMovementRow[];
  request: MaterialRequestRow | null;
  warehouse: WarehouseRow | null;
  employee: EmployeeRow | null;
  project: ProjectRow | null;
};

async function findWarehouse(id?: number | null): Promise<WarehouseRow | null> {
  if (!id) return null;
  const direct = await db.warehouses.filter((row) => Number(row.id) === Number(id)).first();
  return direct ?? null;
}

async function findEmployee(id?: number | null): Promise<EmployeeRow | null> {
  if (!id) return null;
  const direct = await db.employees.filter((row) => Number(row.id) === Number(id)).first();
  return direct ?? null;
}

async function findProject(id?: number | null): Promise<ProjectRow | null> {
  if (!id) return null;
  const direct = await db.projects.filter((row) => Number(row.id) === Number(id)).first();
  return direct ?? null;
}

async function findMaterialRequest(anchor: StockMovementRow): Promise<MaterialRequestRow | null> {
  const referenceNo = String(anchor.reference_no ?? "").trim();
  const itemUuid = String(anchor.material_request_item_uuid ?? "").trim();

  const matches = await db.material_requests
    .where("updated_at")
    .above(0)
    .filter((request) => {
      if (referenceNo && [request.issue_receipt_no, request.request_no].map((value) => String(value ?? "").trim()).includes(referenceNo)) {
        return true;
      }

      return (request.items ?? []).some((item) => String(item.uuid ?? "").trim() === itemUuid);
    })
    .toArray();

  return matches[0] ?? null;
}

export async function loadStockMovementPrintBundle(uuid: string): Promise<StockMovementPrintBundle> {
  const anchor = await db.stock_movements.get(uuid);
  if (!anchor) {
    return { anchor: null, movements: [], request: null, warehouse: null, employee: null, project: null };
  }

  const referenceNo = String(anchor.reference_no ?? "").trim();
  let movements = [anchor];
  if (referenceNo) {
    movements = await db.stock_movements
      .where("updated_at")
      .above(0)
      .filter((row) => String(row.reference_no ?? "").trim() === referenceNo)
      .toArray();
    movements = movements.sort((left, right) => Number(right.movement_date ?? 0) - Number(left.movement_date ?? 0));
  }

  const request = await findMaterialRequest(anchor);
  const [warehouse, employee, project] = await Promise.all([
    findWarehouse(anchor.warehouse_id || request?.warehouse_id),
    findEmployee(anchor.employee_id || request?.requested_by_employee_id),
    findProject(anchor.project_id || request?.project_id),
  ]);

  return { anchor, movements, request, warehouse, employee, project };
}
