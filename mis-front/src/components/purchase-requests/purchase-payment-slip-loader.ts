import {
  db,
  type AccountRow,
  type ProjectRow,
  type PurchaseRequestRow,
  type VendorRow,
  type WarehouseRow,
} from "@/db/localDB";

export type PurchasePaymentSlipBundle = {
  request: PurchaseRequestRow | null;
  account: AccountRow | null;
  vendor: VendorRow | null;
  warehouse: WarehouseRow | null;
  project: ProjectRow | null;
};

export async function loadPurchasePaymentSlipBundle(uuid: string): Promise<PurchasePaymentSlipBundle> {
  const request = await db.purchase_requests.get(uuid);
  if (!request) {
    return {
      request: null,
      account: null,
      vendor: null,
      warehouse: null,
      project: null,
    };
  }

  const [account, vendor, warehouse, project] = await Promise.all([
    request.payment_account_id ? db.accounts.filter((item) => Number(item.id) === Number(request.payment_account_id)).first() : Promise.resolve(undefined),
    request.vendor_id ? db.vendors.filter((item) => Number(item.id) === Number(request.vendor_id)).first() : Promise.resolve(undefined),
    db.warehouses.filter((item) => Number(item.id) === Number(request.warehouse_id)).first(),
    request.project_id ? db.projects.filter((item) => Number(item.id) === Number(request.project_id)).first() : Promise.resolve(undefined),
  ]);

  return {
    request,
    account: account ?? null,
    vendor: vendor ?? null,
    warehouse: warehouse ?? null,
    project: project ?? null,
  };
}
