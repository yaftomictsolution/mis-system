"use client";

import { db, type EmployeeRow, type MaterialRequestRow, type ProjectRow, type StockMovementRow, type WarehouseRow } from "@/db/localDB";

export type MaterialIssuePrintBundle = {
  request: MaterialRequestRow | null;
  warehouse: WarehouseRow | null;
  employee: EmployeeRow | null;
  project: ProjectRow | null;
  movements: StockMovementRow[];
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

export async function loadMaterialIssuePrintBundle(uuid: string): Promise<MaterialIssuePrintBundle> {
  const request = await db.material_requests.get(uuid);
  if (!request) {
    return { request: null, warehouse: null, employee: null, project: null, movements: [] };
  }

  const [warehouse, employee, project] = await Promise.all([
    findWarehouse(request.warehouse_id),
    findEmployee(request.requested_by_employee_id),
    findProject(request.project_id),
  ]);

  const itemUuids = new Set((request.items ?? []).map((item) => String(item.uuid ?? "").trim()).filter(Boolean));
  const referenceCandidates = [request.issue_receipt_no, request.request_no].map((value) => String(value ?? "").trim()).filter(Boolean);

  let movements = await db.stock_movements
    .where("updated_at")
    .above(0)
    .filter((row) => {
      const itemUuid = String(row.material_request_item_uuid ?? "").trim();
      const referenceNo = String(row.reference_no ?? "").trim();
      return itemUuids.has(itemUuid) || referenceCandidates.includes(referenceNo);
    })
    .toArray();

  movements = movements.sort((left, right) => {
    const byDate = Number(right.movement_date ?? 0) - Number(left.movement_date ?? 0);
    if (byDate !== 0) return byDate;
    return String(left.material_name ?? "").localeCompare(String(right.material_name ?? ""));
  });

  return { request, warehouse, employee, project, movements };
}
