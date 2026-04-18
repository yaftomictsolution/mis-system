"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import RequirePermission from "@/components/auth/RequirePermission";
import AssetTypeManagerModal from "@/components/inventories/AssetTypeManagerModal";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
  AccountRow,
  CompanyAssetRow,
  MaterialRow,
  ProjectRow,
  PurchaseRequestRow,
  VendorRow,
  WarehouseRow,
} from "@/db/localDB";
import { api } from "@/lib/api";
import { subscribeAppEvent } from "@/lib/appEvents";
import { hasAnyRole } from "@/lib/permissions";
import { notifyError } from "@/lib/notify";
import { accountsListLocal, accountsPullToLocal } from "@/modules/accounts/accounts.repo";
import {
  ASSET_TYPE_MODULE,
  buildAssetTypeLabelMap,
  buildAssetTypeOptions,
} from "@/modules/document-types/asset-type-helpers";
import {
  documentTypesListLocal,
  documentTypesPullToLocal,
  type DocumentTypeRow,
} from "@/modules/document-types/document-types.repo";
import {
  companyAssetsListLocal,
  companyAssetsPullToLocal,
  materialsListLocal,
  materialsPullToLocal,
  vendorsListLocal,
  vendorsPullToLocal,
  warehousesListLocal,
  warehousesPullToLocal,
} from "@/modules/inventories/inventories.repo";
import { consumePurchaseRequestDraft } from "@/modules/purchase-requests/purchase-request-draft";
import {
  purchaseRequestApprove,
  purchaseRequestCreate,
  purchaseRequestDelete,
  purchaseRequestProcessPayment,
  purchaseRequestReceive,
  purchaseRequestReject,
  purchaseRequestUpdate,
  purchaseRequestsListLocal,
  purchaseRequestsPullToLocal,
  type PurchasePaymentInput,
  type PurchaseReceiveInput,
  type PurchaseRequestInput,
} from "@/modules/purchase-requests/purchase-requests.repo";
import { projectsListLocal, projectsPullToLocal } from "@/modules/projects/projects.repo";
import type { RootState } from "@/store/store";

type PurchaseRequestSyncEntity =
  | "purchase_requests"
  | "accounts"
  | "company_assets"
  | "materials"
  | "warehouses"
  | "vendors"
  | "projects";

type SyncCompleteDetail = { syncedAny?: boolean; cleaned?: boolean; entities?: string[] };
type AssetPurchaseSource = "existing" | "new";
type PurchaseRequestFormItemState = {
  uuid: string;
  item_kind: "material" | "asset";
  material_id: string;
  asset_source: AssetPurchaseSource;
  company_asset_id: string;
  asset_name: string;
  asset_type: string;
  asset_code_prefix: string;
  quantity_requested: string;
  estimated_unit_price: string;
  unit: string;
  notes: string;
};
type PurchaseRequestFormState = {
  request_type: "material" | "asset";
  source_material_request_id: string;
  source_material_request_uuid: string;
  source_material_request_no: string;
  project_id: string;
  warehouse_id: string;
  vendor_id: string;
  notes: string;
  items: PurchaseRequestFormItemState[];
};
type ReceiveFormItemState = {
  uuid: string;
  item_kind: "material" | "asset";
  material_name: string;
  company_asset_code: string;
  asset_name: string;
  asset_type: string;
  unit: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_received: number;
  current_stock: number;
  quantity_receive_now: string;
  estimated_unit_price: number;
  estimated_line_total: number;
  actual_unit_price: string;
  actual_line_total: number;
};
type ReceiveFormState = { receive_date: string; notes: string; items: ReceiveFormItemState[] };
type FinanceFormState = { account_id: string; payment_amount: string; payment_date: string; notes: string };
type PurchaseRequestTableRow = PurchaseRequestRow & {
  project_label: string;
  vendor_label: string;
  source_label: string;
  search_materials: string;
  requested_by_label: string;
};
type PurchaseRequestQueueFilter = "all" | "waiting-approval" | "finance-payment" | "receive-ready" | "completed";

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const SYNC_ENTITIES = new Set<PurchaseRequestSyncEntity>([
  "purchase_requests",
  "accounts",
  "company_assets",
  "materials",
  "warehouses",
  "vendors",
  "projects",
]);
const actionBtn = "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors";
const today = () => new Date().toISOString().slice(0, 10);

function normalizeQueueFilter(value: string | null): PurchaseRequestQueueFilter {
  if (value === "waiting-approval" || value === "finance-payment" || value === "receive-ready" || value === "completed") return value;
  return "all";
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCompanyAssetById(items: CompanyAssetRow[], companyAssetId: string): CompanyAssetRow | undefined {
  if (!companyAssetId) return undefined;
  return items.find((item) => String(item.id ?? "") === companyAssetId);
}

function findMatchingCompanyAssets(
  items: CompanyAssetRow[],
  warehouseId: string,
  assetName: string,
  assetType: string,
): CompanyAssetRow[] {
  const normalizedName = normalizeLookup(assetName);
  if (!warehouseId || !normalizedName) return [];

  const filtered = items.filter((item) => {
    if (String(item.current_warehouse_id ?? "") !== warehouseId) return false;
    if (normalizeLookup(item.asset_name) !== normalizedName) return false;
    if (assetType && String(item.asset_type) !== assetType) return false;
    return true;
  });

  return filtered.sort((left, right) => Number(right.quantity ?? 0) - Number(left.quantity ?? 0));
}

function qty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function buildSupplierReferenceCount(materials: MaterialRow[], companyAssets: CompanyAssetRow[]): number {
  const ids = new Set<string>();

  for (const material of materials) {
    const supplierId = Number(material.supplier_id ?? 0);
    const supplierName = String(material.supplier_name ?? "").trim();
    if (supplierId > 0 && supplierName) ids.add(String(supplierId));
  }

  for (const asset of companyAssets) {
    const supplierId = Number(asset.supplier_id ?? 0);
    const supplierName = String(asset.supplier_name ?? "").trim();
    if (supplierId > 0 && supplierName) ids.add(String(supplierId));
  }

  return ids.size;
}

function buildHistoricalCompanyAssetOptions(rows: PurchaseRequestRow[], warehouseId: number): Array<{ value: string; label: string }> {
  const options = new Map<string, string>();

  for (const row of rows) {
    if (warehouseId > 0 && Number(row.warehouse_id ?? 0) !== warehouseId) continue;

    for (const item of row.items ?? []) {
      const assetId = Number(item.company_asset_id ?? 0);
      if (assetId <= 0) continue;

      const assetCode = String(item.company_asset_code ?? "").trim();
      const assetName = String(item.asset_name ?? "").trim();
      const assetType = String(item.asset_type ?? "").trim();
      const labelBase = [assetCode || `Asset ${assetId}`, assetName, assetType].filter(Boolean).join(" | ");
      if (!labelBase) continue;

      options.set(String(assetId), `${labelBase} | Historical stock line`);
    }
  }

  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function mergeCompanyAssetRows(current: CompanyAssetRow[], incoming: CompanyAssetRow[]): CompanyAssetRow[] {
  const merged = new Map<string, CompanyAssetRow>();

  for (const item of current) {
    const key = item.uuid || String(item.id ?? "");
    if (!key) continue;
    merged.set(key, item);
  }

  for (const item of incoming) {
    const key = item.uuid || String(item.id ?? "");
    if (!key) continue;
    merged.set(key, item);
  }

  return Array.from(merged.values()).sort((left, right) => {
    const leftLabel = `${left.asset_code} ${left.asset_name}`.trim();
    const rightLabel = `${right.asset_code} ${right.asset_name}`.trim();
    return leftLabel.localeCompare(rightLabel);
  });
}

function toLookupText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function toLookupNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeVendorLookupRows(input: unknown): VendorRow[] {
  if (!Array.isArray(input)) return [];

  const rows: VendorRow[] = [];
  for (const row of input) {
    const record = row as Record<string, unknown>;
    const id = toLookupNumber(record.id);
    const uuid = toLookupText(record.uuid);
    const name = toLookupText(record.name);
    if (!id || !uuid || !name) continue;

    rows.push({
      id,
      uuid,
      name,
      phone: toLookupText(record.phone) || null,
      email: toLookupText(record.email) || null,
      address: toLookupText(record.address) || null,
      status: toLookupText(record.status, "active") || "active",
      updated_at: Date.parse(String(record.updated_at ?? "")) || Date.now(),
      created_at: Date.parse(String(record.created_at ?? "")) || Date.now(),
    });
  }

  return rows;
}

function normalizeCompanyAssetLookupRows(input: unknown): CompanyAssetRow[] {
  if (!Array.isArray(input)) return [];

  const rows: CompanyAssetRow[] = [];
  for (const row of input) {
    const record = row as Record<string, unknown>;
    const id = toLookupNumber(record.id);
    const uuid = toLookupText(record.uuid);
    const assetCode = toLookupText(record.asset_code);
    const assetName = toLookupText(record.asset_name);
    if (!id || !uuid || !assetCode || !assetName) continue;

    rows.push({
      id,
      uuid,
      asset_code: assetCode,
      asset_name: assetName,
      asset_type: toLookupText(record.asset_type, "tool") || "tool",
      quantity: Number(record.quantity ?? 0) || 0,
      allocated_quantity: Number(record.allocated_quantity ?? 0) || 0,
      maintenance_quantity: Number(record.maintenance_quantity ?? 0) || 0,
      damaged_quantity: Number(record.damaged_quantity ?? 0) || 0,
      retired_quantity: Number(record.retired_quantity ?? 0) || 0,
      supplier_id: toLookupNumber(record.supplier_id),
      supplier_uuid: toLookupText(record.supplier_uuid) || null,
      supplier_name: toLookupText(record.supplier_name) || null,
      serial_no: toLookupText(record.serial_no) || null,
      status: toLookupText(record.status, "available") || "available",
      current_employee_id: toLookupNumber(record.current_employee_id),
      current_employee_uuid: toLookupText(record.current_employee_uuid) || null,
      current_employee_name: toLookupText(record.current_employee_name) || null,
      current_project_id: toLookupNumber(record.current_project_id),
      current_project_uuid: toLookupText(record.current_project_uuid) || null,
      current_project_name: toLookupText(record.current_project_name) || null,
      current_warehouse_id: toLookupNumber(record.current_warehouse_id),
      current_warehouse_uuid: toLookupText(record.current_warehouse_uuid) || null,
      current_warehouse_name: toLookupText(record.current_warehouse_name) || null,
      notes: toLookupText(record.notes) || null,
      updated_at: Date.parse(String(record.updated_at ?? "")) || Date.now(),
      created_at: Date.parse(String(record.created_at ?? "")) || Date.now(),
    });
  }

  return rows;
}

function money(value?: number | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function lineTotal(quantity: number, unitPrice?: number | null): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (!Number.isFinite(Number(unitPrice))) return 0;
  return Number((quantity * Number(unitPrice || 0)).toFixed(2));
}

function toDateLabel(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function createItem(itemKind: "material" | "asset" = "material"): PurchaseRequestFormItemState {
  return {
    uuid: crypto.randomUUID(),
    item_kind: itemKind,
    material_id: "",
    asset_source: itemKind === "asset" ? "existing" : "new",
    company_asset_id: "",
    asset_name: "",
    asset_type: itemKind === "asset" ? "tool" : "",
    asset_code_prefix: "",
    quantity_requested: "",
    estimated_unit_price: "",
    unit: itemKind === "asset" ? "unit" : "",
    notes: "",
  };
}

function createEmptyForm(): PurchaseRequestFormState {
  return {
    request_type: "material",
    source_material_request_id: "",
    source_material_request_uuid: "",
    source_material_request_no: "",
    project_id: "",
    warehouse_id: "",
    vendor_id: "",
    notes: "",
    items: [createItem()],
  };
}

function normalizeForm(row: PurchaseRequestRow): PurchaseRequestFormState {
  return {
    request_type: row.request_type || "material",
    source_material_request_id: row.source_material_request_id ? String(row.source_material_request_id) : "",
    source_material_request_uuid: row.source_material_request_uuid || "",
    source_material_request_no: row.source_material_request_no || "",
    project_id: row.project_id ? String(row.project_id) : "",
    warehouse_id: String(row.warehouse_id || ""),
    vendor_id: row.vendor_id ? String(row.vendor_id) : "",
    notes: row.notes || "",
    items: (row.items?.length ? row.items : [createItem(row.request_type || "material")]).map((item) => ({
      uuid: item.uuid || crypto.randomUUID(),
      item_kind: item.item_kind || row.request_type || "material",
      material_id: item.material_id ? String(item.material_id) : "",
      asset_source: item.company_asset_id ? "existing" : "new",
      company_asset_id: item.company_asset_id ? String(item.company_asset_id) : "",
      asset_name: item.asset_name || "",
      asset_type: item.asset_type || "",
      asset_code_prefix: item.asset_code_prefix || "",
      quantity_requested: String(item.quantity_requested ?? ""),
      estimated_unit_price:
        item.estimated_unit_price !== null && item.estimated_unit_price !== undefined ? String(item.estimated_unit_price) : "",
      unit: item.unit || "",
      notes: item.notes || "",
    })),
  };
}

function createReceiveForm(row: PurchaseRequestRow, materials: MaterialRow[], companyAssets: CompanyAssetRow[]): ReceiveFormState {
  return {
    receive_date: today(),
    notes: "",
    items: (row.items ?? []).map((item) => {
      const material = Number(item.material_id ?? 0) > 0
        ? materials.find((entry) => Number(entry.id) === Number(item.material_id))
        : undefined;
      const companyAsset = Number(item.company_asset_id ?? 0) > 0
        ? companyAssets.find((entry) => Number(entry.id) === Number(item.company_asset_id))
        : undefined;
      const outstanding = Math.max(0, Number(item.quantity_approved ?? item.quantity_requested ?? 0) - Number(item.quantity_received ?? 0));
      return {
        uuid: item.uuid,
        item_kind: item.item_kind || row.request_type || "material",
        material_name: item.material_name || material?.name || "Material",
        company_asset_code: item.company_asset_code || companyAsset?.asset_code || "",
        asset_name: item.asset_name || companyAsset?.asset_name || "",
        asset_type: item.asset_type || companyAsset?.asset_type || "",
        unit: item.unit || material?.unit || "-",
        quantity_requested: Number(item.quantity_requested ?? 0),
        quantity_approved: Number(item.quantity_approved ?? 0),
        quantity_received: Number(item.quantity_received ?? 0),
        current_stock: item.item_kind === "asset" ? Number(companyAsset?.quantity ?? 0) : Number(material?.quantity ?? 0),
        quantity_receive_now: outstanding > 0 ? String(outstanding) : "",
        estimated_unit_price: Number(item.estimated_unit_price ?? material?.reference_unit_price ?? 0),
        estimated_line_total: Number(item.estimated_line_total ?? lineTotal(Number(item.quantity_requested ?? 0), Number(item.estimated_unit_price ?? material?.reference_unit_price ?? 0))),
        actual_unit_price:
          item.actual_unit_price !== null && item.actual_unit_price !== undefined
            ? String(item.actual_unit_price)
            : item.estimated_unit_price !== null && item.estimated_unit_price !== undefined
              ? String(item.estimated_unit_price)
              : material?.reference_unit_price != null
                ? String(material.reference_unit_price)
                : "",
        actual_line_total: Number(item.actual_line_total ?? lineTotal(Number(item.quantity_received ?? 0), Number(item.actual_unit_price ?? item.estimated_unit_price ?? material?.reference_unit_price ?? 0))),
      };
    }),
  };
}

function statusBadge(status: string) {
  if (status === "pending_admin_approval") return <Badge color="amber">waiting approval</Badge>;
  if (status === "approved") return <Badge color="blue">approved</Badge>;
  if (status === "paid") return <Badge color="purple">paid</Badge>;
  if (status === "partial_received") return <Badge color="amber">partial received</Badge>;
  if (status === "completed") return <Badge color="emerald">completed</Badge>;
  if (status === "rejected") return <Badge color="red">rejected</Badge>;
  return <Badge color="slate">{status || "draft"}</Badge>;
}

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const permissions = useSelector((state: RootState) => state.auth.user?.permissions ?? []);
  const roles = useSelector((state: RootState) => state.auth.user?.roles ?? []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [rows, setRows] = useState<PurchaseRequestRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [companyAssets, setCompanyAssets] = useState<CompanyAssetRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [assetTypeRows, setAssetTypeRows] = useState<DocumentTypeRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [assetTypeModalOpen, setAssetTypeModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequestRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PurchaseRequestRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [form, setForm] = useState<PurchaseRequestFormState>(createEmptyForm());
  const [receiveTarget, setReceiveTarget] = useState<PurchaseRequestRow | null>(null);
  const [receiveForm, setReceiveForm] = useState<ReceiveFormState>({ receive_date: today(), notes: "", items: [] });
  const [financeTarget, setFinanceTarget] = useState<PurchaseRequestRow | null>(null);
  const [financeForm, setFinanceForm] = useState<FinanceFormState>({ account_id: "", payment_amount: "", payment_date: today(), notes: "" });
  const draftConsumedRef = useRef(false);
  const existingStockLookupWarehouseRef = useRef<string | null>(null);

  const canCreate = useMemo(
    () => hasAnyRole(roles, ["Admin", "Storekeeper"]),
    [roles]
  );
  const canApprove = useMemo(
    () => hasAnyRole(roles, "Admin") || permissions.includes("inventory.approve") || permissions.includes("purchase_requests.approve"),
    [permissions, roles]
  );
  const canFinance = useMemo(
    () => hasAnyRole(roles, ["Admin", "Accountant"]) || permissions.includes("purchase_requests.finance"),
    [permissions, roles]
  );
  const canReceive = useMemo(
    () =>
      hasAnyRole(roles, ["Admin", "Storekeeper", "Accountant"]) ||
      permissions.includes("inventory.issue") ||
      permissions.includes("purchase_requests.receive") ||
      permissions.includes("purchase_requests.finance"),
    [permissions, roles]
  );
  const activeQueue = useMemo<PurchaseRequestQueueFilter>(() => normalizeQueueFilter(searchParams.get("queue")), [searchParams]);

  const loadLocal = useCallback(async () => {
    const [requestPage, accountPage, materialPage, companyAssetPage, warehousePage, vendorPage, projectPage, typeRows] = await Promise.all([
      purchaseRequestsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      accountsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      materialsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      companyAssetsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehousesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      vendorsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      projectsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      documentTypesListLocal({ module: ASSET_TYPE_MODULE, includeInactive: true }),
    ]);

    setRows(requestPage.items);
    setAccounts(accountPage.items);
    setMaterials(materialPage.items);
    setCompanyAssets(companyAssetPage.items);
    setWarehouses(warehousePage.items);
    setVendors(vendorPage.items);
    setProjects(projectPage.items);
    setAssetTypeRows(typeRows);
    return {
      requestCount: requestPage.items.length,
      vendorCount: vendorPage.items.length,
      companyAssetCount: companyAssetPage.items.length,
      warehouseCount: warehousePage.items.length,
      supplierReferenceCount: buildSupplierReferenceCount(materialPage.items, companyAssetPage.items),
    };
  }, []);

  const refresh = useCallback(
    async (options?: { showLoader?: boolean; showFailureToast?: boolean; entitiesToPull?: PurchaseRequestSyncEntity[] }) => {
      const showLoader = options?.showLoader ?? true;
      const showFailureToast = options?.showFailureToast ?? true;
      const entitiesToPull = options?.entitiesToPull ?? ["purchase_requests", "accounts", "company_assets", "materials", "warehouses", "vendors", "projects"];

      if (showLoader) setLoading(true);
      try {
        await loadLocal();
        if (!entitiesToPull.length) return;

        const tasks: Array<{ key: PurchaseRequestSyncEntity; promise: Promise<unknown> }> = [];
        if (entitiesToPull.includes("purchase_requests")) tasks.push({ key: "purchase_requests", promise: purchaseRequestsPullToLocal() });
        if (canFinance && entitiesToPull.includes("accounts")) tasks.push({ key: "accounts", promise: accountsPullToLocal() });
        if (entitiesToPull.includes("company_assets")) tasks.push({ key: "company_assets", promise: companyAssetsPullToLocal() });
        if (entitiesToPull.includes("materials")) tasks.push({ key: "materials", promise: materialsPullToLocal() });
        if (entitiesToPull.includes("warehouses")) tasks.push({ key: "warehouses", promise: warehousesPullToLocal() });
        if (entitiesToPull.includes("vendors")) tasks.push({ key: "vendors", promise: vendorsPullToLocal() });
        if (entitiesToPull.includes("projects")) tasks.push({ key: "projects", promise: projectsPullToLocal() });
        const results = await Promise.allSettled([
          ...tasks.map((task) => task.promise),
          documentTypesPullToLocal(),
        ]);
        const purchaseRequestPullFailed = results.some((result, index) => result.status === "rejected" && tasks[index]?.key === "purchase_requests");

        const localSnapshot = await loadLocal();
        if (showFailureToast && purchaseRequestPullFailed && localSnapshot.requestCount === 0) {
          notifyError("Unable to refresh purchase requests from server. Using local data only.");
        }
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [canFinance, loadLocal]
  );

  const ensureFormLookupsLoaded = useCallback(async () => {
    setLookupLoading(true);
    try {
      const tasks: Array<{ key: "vendors" | "warehouses" | "projects" | "materials" | "company_assets"; promise: Promise<unknown> }> = [
        { key: "vendors", promise: vendorsPullToLocal() },
        { key: "warehouses", promise: warehousesPullToLocal() },
        { key: "projects", promise: projectsPullToLocal() },
        { key: "materials", promise: materialsPullToLocal() },
        { key: "company_assets", promise: companyAssetsPullToLocal() },
      ];

      const results = await Promise.allSettled(tasks.map((task) => task.promise));
      const snapshot = await loadLocal();

      const vendorPullFailed = results.some((result, index) => result.status === "rejected" && tasks[index]?.key === "vendors");
      const companyAssetPullFailed = results.some((result, index) => result.status === "rejected" && tasks[index]?.key === "company_assets");
      const warehousePullFailed = results.some((result, index) => result.status === "rejected" && tasks[index]?.key === "warehouses");

      if (snapshot.vendorCount === 0) {
        try {
          const response = await api.get("/api/vendors", { params: { offline: 1, page: 1, per_page: 500 } });
          const remoteRows = normalizeVendorLookupRows((response.data as { data?: unknown })?.data);
          if (remoteRows.length) {
            setVendors(remoteRows);
          }
        } catch (error: unknown) {
          if (vendorPullFailed && snapshot.supplierReferenceCount === 0) {
            const message =
              (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              "Unable to load suppliers for purchase requests.";
            setFormError(message);
            notifyError(message);
            return;
          }
        }
      }

      if (warehousePullFailed && snapshot.warehouseCount === 0) {
        setFormError("Unable to load warehouses for this purchase request.");
        notifyError("Unable to load warehouses for purchase requests.");
        return;
      }

      if (snapshot.companyAssetCount === 0) {
        try {
          const response = await api.get("/api/company-assets", { params: { offline: 1, page: 1, per_page: 500 } });
          const remoteRows = normalizeCompanyAssetLookupRows((response.data as { data?: unknown })?.data);
          if (remoteRows.length) {
            setCompanyAssets(remoteRows);
          } else if (companyAssetPullFailed) {
            notifyError("No company asset stock lines were returned for this user.");
          }
        } catch (error: unknown) {
          if (companyAssetPullFailed) {
            const message =
              (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              "Unable to load company asset stock lines.";
            notifyError(message);
          }
        }
      }
    } finally {
      setLookupLoading(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent<SyncCompleteDetail>).detail;
      if (detail?.cleaned) {
        void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: [] });
        return;
      }

      const entities = Array.isArray(detail?.entities) ? detail.entities : [];
      const touched = entities.filter((entity): entity is PurchaseRequestSyncEntity => SYNC_ENTITIES.has(entity as PurchaseRequestSyncEntity));
      if (!touched.length) return;
      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: touched });
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [refresh]);

  useEffect(() => {
    const unsubscribeDocumentTypes = subscribeAppEvent("document-types:changed", () => {
      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: [] });
    });

    return unsubscribeDocumentTypes;
  }, [refresh]);

  useEffect(() => {
    if (draftConsumedRef.current) return;
    draftConsumedRef.current = true;

    const draft = consumePurchaseRequestDraft();
    if (!draft) return;

    setEditing(null);
    setForm({
      request_type: draft.request_type || "material",
      source_material_request_id: draft.source_material_request_id ? String(draft.source_material_request_id) : "",
      source_material_request_uuid: draft.source_material_request_uuid || "",
      source_material_request_no: draft.source_material_request_no || "",
      project_id: draft.project_id ? String(draft.project_id) : "",
      warehouse_id: String(draft.warehouse_id || ""),
      vendor_id: "",
      notes: draft.notes || "",
      items: draft.items.length
        ? draft.items.map((item) => ({
            uuid: crypto.randomUUID(),
            item_kind: "material",
            material_id: String(item.material_id),
            asset_source: "new",
            company_asset_id: "",
            asset_name: "",
            asset_type: "",
            asset_code_prefix: "",
            quantity_requested: String(item.quantity_requested),
            estimated_unit_price: "",
            unit: item.unit,
            notes: item.notes || "",
          }))
        : [createItem("material")],
    });
    setFormError(null);
    setFormOpen(true);
  }, []);

  const materialOptions = useMemo(
    () =>
      materials.map((item) => ({
        value: String(item.id ?? ""),
        label: `${item.name} (${item.unit})${item.reference_unit_price != null ? ` • ${money(item.reference_unit_price)}` : ""}`,
      })),
    [materials]
  );
  const warehouseOptions = useMemo(
    () => warehouses.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [warehouses]
  );
  const vendorOptions = useMemo(
    () => {
      const options = new Map<string, string>();

      for (const item of vendors) {
        const id = String(item.id ?? "").trim();
        const label = String(item.name ?? "").trim();
        if (!id || !label) continue;
        options.set(id, label);
      }

      for (const material of materials) {
        const id = String(material.supplier_id ?? "").trim();
        const label = String(material.supplier_name ?? "").trim();
        if (!id || !label) continue;
        if (!options.has(id)) options.set(id, label);
      }

      for (const asset of companyAssets) {
        const id = String(asset.supplier_id ?? "").trim();
        const label = String(asset.supplier_name ?? "").trim();
        if (!id || !label) continue;
        if (!options.has(id)) options.set(id, label);
      }

      return Array.from(options.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label));
    },
    [companyAssets, materials, vendors]
  );
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((item) => item.status === "active")
        .map((item) => ({
          value: String(item.id ?? ""),
          label: `${item.name} | ${item.currency} | Balance ${qty(item.current_balance)}`,
        })),
    [accounts]
  );
  const projectOptions = useMemo(
    () => projects.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [projects]
  );
  const assetTypeLabelByCode = useMemo(() => buildAssetTypeLabelMap(assetTypeRows), [assetTypeRows]);
  const assetTypeOptions = useMemo(() => buildAssetTypeOptions(assetTypeRows), [assetTypeRows]);
  const firstAssetTypeValue = assetTypeOptions[0]?.value || "tool";
  const companyAssetOptions = useMemo(() => {
    const selectedWarehouseId = Number(form.warehouse_id || 0);
    const selectedWarehouseName = warehouses.find((item) => Number(item.id ?? 0) === selectedWarehouseId)?.name?.trim().toLowerCase() || "";
    const liveOptions = companyAssets
      .filter((item) => {
        if (!selectedWarehouseId) return true;
        if (Number(item.current_warehouse_id ?? 0) === selectedWarehouseId) return true;

        const itemWarehouseName = String(item.current_warehouse_name ?? "").trim().toLowerCase();
        return Number(item.current_warehouse_id ?? 0) <= 0 && Boolean(selectedWarehouseName) && itemWarehouseName === selectedWarehouseName;
      })
      .map((item) => ({
        value: String(item.id ?? ""),
        label: `${item.asset_code} | ${item.asset_name} | ${assetTypeLabelByCode.get(item.asset_type) || item.asset_type} | Available ${qty(item.quantity)}`,
      }));

    const merged = new Map<string, string>();
    for (const option of liveOptions) {
      merged.set(option.value, option.label);
    }

    for (const option of buildHistoricalCompanyAssetOptions(rows, selectedWarehouseId)) {
      if (!merged.has(option.value)) {
        merged.set(option.value, option.label);
      }
    }

    return Array.from(merged.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [assetTypeLabelByCode, companyAssets, form.warehouse_id, rows, warehouses]);

  const summary = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === "pending_admin_approval").length,
      approved: rows.filter((row) => row.status === "approved").length,
      paid: rows.filter((row) => row.status === "paid").length,
      receiveReady: rows.filter((row) => row.status === "paid" || row.status === "partial_received").length,
      completed: rows.filter((row) => row.status === "completed").length,
    }),
    [rows]
  );

  const tableRows = useMemo<PurchaseRequestTableRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        project_label: row.project_name || (row.project_id ? `Project ${row.project_id}` : "No project"),
        vendor_label: row.vendor_name || "-",
        source_label: row.source_material_request_no || "-",
        requested_by_label: row.requested_by_name || row.requested_by_user_name || row.requested_by_employee_name || "-",
        search_materials: (row.items ?? [])
          .map((item) => item.material_name || item.company_asset_code || item.asset_name || item.asset_type || "")
          .join(" "),
      })),
    [rows]
  );

  const filteredTableRows = useMemo(() => {
    if (activeQueue === "waiting-approval") {
      return tableRows.filter((row) => row.status === "pending_admin_approval");
    }
    if (activeQueue === "finance-payment") {
      return tableRows.filter((row) => row.status === "approved");
    }
    if (activeQueue === "receive-ready") {
      return tableRows.filter((row) => row.status === "paid" || row.status === "partial_received");
    }
    if (activeQueue === "completed") {
      return tableRows.filter((row) => row.status === "completed");
    }
    return tableRows;
  }, [activeQueue, tableRows]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(createEmptyForm());
    setFormError(null);
    setFormOpen(true);
  }, []);

  const setQueueFilter = useCallback((nextFilter: PurchaseRequestQueueFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") {
      params.delete("queue");
    } else {
      params.set("queue", nextFilter);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openEdit = useCallback((row: PurchaseRequestRow) => {
    setEditing(row);
    setForm(normalizeForm(row));
    setFormError(null);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    void ensureFormLookupsLoaded();
  }, [ensureFormLookupsLoaded, formOpen]);

  const reloadExistingStockLinesForWarehouse = useCallback(async () => {
    const warehouseId = String(form.warehouse_id || "").trim();
    if (!warehouseId) return;
    if (existingStockLookupWarehouseRef.current === warehouseId) return;

    existingStockLookupWarehouseRef.current = warehouseId;

    try {
      const response = await api.get("/api/company-assets", { params: { offline: 1, page: 1, per_page: 500 } });
      const remoteRows = normalizeCompanyAssetLookupRows((response.data as { data?: unknown })?.data);
      if (remoteRows.length) {
        setCompanyAssets((current) => mergeCompanyAssetRows(current, remoteRows));
      }
    } catch {
      // The form already shows the normal empty-state text, so keep this retry silent.
    }
  }, [form.warehouse_id]);

  useEffect(() => {
    if (!formOpen) {
      existingStockLookupWarehouseRef.current = null;
      return;
    }

    const needsExistingStockLineLookup =
      form.request_type === "asset" &&
      Boolean(form.warehouse_id) &&
      form.items.some((item) => item.asset_source === "existing");

    if (!needsExistingStockLineLookup) return;
    if (lookupLoading) return;
    if (companyAssetOptions.length > 0) {
      existingStockLookupWarehouseRef.current = String(form.warehouse_id || "");
      return;
    }

    void reloadExistingStockLinesForWarehouse();
  }, [companyAssetOptions.length, form.items, form.request_type, form.warehouse_id, formOpen, lookupLoading, reloadExistingStockLinesForWarehouse]);

  const closeForm = useCallback(() => {
    existingStockLookupWarehouseRef.current = null;
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
    setForm(createEmptyForm());
  }, []);

  const openReceive = useCallback((row: PurchaseRequestRow) => {
    setReceiveTarget(row);
    setReceiveForm(createReceiveForm(row, materials, companyAssets));
    setReceiveError(null);
    setReceiveOpen(true);
  }, [companyAssets, materials]);

  const closeReceive = useCallback(() => {
    setReceiveOpen(false);
    setReceiveTarget(null);
    setReceiveError(null);
    setReceiveForm({ receive_date: today(), notes: "", items: [] });
  }, []);

  const openFinance = useCallback((row: PurchaseRequestRow) => {
    setFinanceTarget(row);
    setFinanceForm({
      account_id: row.payment_account_id ? String(row.payment_account_id) : "",
      payment_amount: String(row.approved_grand_total ?? row.estimated_grand_total ?? 0),
      payment_date: today(),
      notes: row.payment_notes || "",
    });
    setFinanceError(null);
    setFinanceOpen(true);
  }, []);

  const closeFinance = useCallback(() => {
    setFinanceOpen(false);
    setFinanceTarget(null);
    setFinanceError(null);
    setFinanceForm({ account_id: "", payment_amount: "", payment_date: today(), notes: "" });
  }, []);

  const setItemField = useCallback(
    (uuid: string, field: keyof PurchaseRequestFormItemState, value: string) => {
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.uuid !== uuid) return item;
          if (field === "material_id") {
            const material = materials.find((entry) => String(entry.id) === value);
            return {
              ...item,
              material_id: value,
              unit: material?.unit || item.unit,
              estimated_unit_price:
                material?.reference_unit_price !== null && material?.reference_unit_price !== undefined
                  ? String(material.reference_unit_price)
                  : "",
            };
          }
          if (field === "company_asset_id") {
            const companyAsset = companyAssets.find((entry) => String(entry.id) === value);
            return {
              ...item,
              company_asset_id: value,
              asset_name: companyAsset?.asset_name || item.asset_name,
              asset_type: companyAsset?.asset_type || item.asset_type || firstAssetTypeValue,
              asset_code_prefix: "",
              unit: "unit",
            };
          }
          if (field === "asset_source") {
            const nextSource: AssetPurchaseSource = value === "new" ? "new" : "existing";
            return {
              ...item,
              asset_source: nextSource,
              company_asset_id: nextSource === "existing" ? item.company_asset_id : "",
              asset_name: nextSource === "existing" ? item.asset_name : "",
              asset_type:
                nextSource === "existing"
                  ? item.asset_type || firstAssetTypeValue
                  : item.asset_type || firstAssetTypeValue,
              asset_code_prefix: nextSource === "existing" ? "" : item.asset_code_prefix,
              unit: "unit",
            };
          }
          if (field === "item_kind") {
            const nextKind = value === "asset" ? "asset" : "material";
            return {
              ...item,
              item_kind: nextKind,
              material_id: nextKind === "material" ? item.material_id : "",
              asset_source: nextKind === "asset" ? item.asset_source || "existing" : "new",
              company_asset_id: nextKind === "asset" ? item.company_asset_id : "",
              asset_name: nextKind === "asset" ? item.asset_name : "",
              asset_type: nextKind === "asset" ? item.asset_type || firstAssetTypeValue : "",
              asset_code_prefix: nextKind === "asset" ? item.asset_code_prefix : "",
              estimated_unit_price: item.estimated_unit_price,
              unit: nextKind === "asset" ? item.unit || "unit" : item.unit,
            };
          }
          return { ...item, [field]: value };
        }),
      }));
    },
    [companyAssets, firstAssetTypeValue, materials]
  );

  const submitForm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: PurchaseRequestInput = {
        request_type: form.request_type,
        source_material_request_id: form.source_material_request_id ? Number(form.source_material_request_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        warehouse_id: Number(form.warehouse_id),
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        notes: form.notes,
        items: form.items.map((item) => ({
          uuid: item.uuid,
          item_kind: form.request_type,
          material_id: form.request_type === "material" && item.material_id ? Number(item.material_id) : null,
          company_asset_id: form.request_type === "asset" && item.asset_source === "existing" && item.company_asset_id ? Number(item.company_asset_id) : null,
          asset_name: form.request_type === "asset" && item.asset_source === "new" ? item.asset_name : null,
          asset_type: form.request_type === "asset" && item.asset_source === "new" ? item.asset_type : null,
          asset_code_prefix: form.request_type === "asset" && item.asset_source === "new" ? item.asset_code_prefix : null,
          quantity_requested: Number(item.quantity_requested),
          estimated_unit_price: item.estimated_unit_price === "" ? null : Number(item.estimated_unit_price),
          unit: form.request_type === "asset" ? "unit" : item.unit,
          notes: item.notes,
        })),
      };

      if (editing?.uuid) {
        await purchaseRequestUpdate(editing.uuid, payload);
      } else {
        await purchaseRequestCreate(payload);
      }

      closeForm();
      await loadLocal();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Unable to save purchase request.");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editing?.uuid, form, loadLocal, saving]);

  const submitFinance = useCallback(async () => {
    if (!financeTarget || saving) return;
    setSaving(true);
    setFinanceError(null);
    try {
      const payload: PurchasePaymentInput = {
        account_id: Number(financeForm.account_id),
        payment_amount: Number(financeForm.payment_amount),
        payment_date: financeForm.payment_date,
        notes: financeForm.notes,
      };

      await purchaseRequestProcessPayment(financeTarget.uuid, payload);
      closeFinance();
      await loadLocal();
    } catch (error: unknown) {
      setFinanceError(error instanceof Error ? error.message : "Unable to process purchase payment.");
    } finally {
      setSaving(false);
    }
  }, [closeFinance, financeForm, financeTarget, loadLocal, saving]);

  const submitReceive = useCallback(async () => {
    if (!receiveTarget || saving) return;
    setSaving(true);
    setReceiveError(null);
    try {
      const items = receiveForm.items
        .map((item) => ({
          uuid: item.uuid,
          quantity_received: Number(item.quantity_receive_now),
          actual_unit_price: item.actual_unit_price === "" ? null : Number(item.actual_unit_price),
        }))
        .filter((item) => Number.isFinite(item.quantity_received) && item.quantity_received > 0);

      const payload: PurchaseReceiveInput = {
        receive_date: receiveForm.receive_date,
        notes: receiveForm.notes,
        items,
      };

      await purchaseRequestReceive(receiveTarget.uuid, payload);
      closeReceive();
      await loadLocal();
    } catch (error: unknown) {
      setReceiveError(error instanceof Error ? error.message : "Unable to receive purchase request.");
    } finally {
      setSaving(false);
    }
  }, [closeReceive, loadLocal, receiveForm, receiveTarget, saving]);

  const handleApprove = useCallback(
    async (row: PurchaseRequestRow) => {
      try {
        await purchaseRequestApprove(row.uuid);
        await loadLocal();
      } catch {
        // repo already surfaces a message
      }
    },
    [loadLocal]
  );

  const handleReject = useCallback(
    async (row: PurchaseRequestRow) => {
      try {
        await purchaseRequestReject(row.uuid);
        await loadLocal();
      } catch {
        // repo already surfaces a message
      }
    },
    [loadLocal]
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await purchaseRequestDelete(pendingDelete.uuid);
      setPendingDelete(null);
      await loadLocal();
    } catch {
      // repo already surfaces a message
    }
  }, [loadLocal, pendingDelete]);

  const columns = useMemo<Column<PurchaseRequestTableRow>[]>(
    () => [
      { key: "request_no", label: "Purchase Request", render: (item) => <span className="font-semibold">{item.request_no}</span> },
      { key: "request_type", label: "Type", render: (item) => <Badge color={item.request_type === "asset" ? "blue" : "emerald"}>{item.request_type}</Badge> },
      { key: "requested_by_label", label: "Requested By", render: (item) => item.requested_by_label },
      { key: "source_label", label: "Source Request", render: (item) => item.source_label },
      { key: "warehouse_name", label: "Warehouse", render: (item) => item.warehouse_name || "-" },
      { key: "vendor_label", label: "Supplier", render: (item) => item.vendor_label },
      {
        key: "estimated_total",
        label: "Estimated",
        render: (item) => {
          const total = Number(
            item.estimated_grand_total ??
              (item.items ?? []).reduce(
                (sum, row) => sum + Number(row.estimated_line_total ?? lineTotal(Number(row.quantity_requested ?? 0), Number(row.estimated_unit_price ?? 0))),
                0
              )
          );
          return total > 0 ? money(total) : "-";
        },
      },
      { key: "status", label: "Status", render: (item) => statusBadge(item.status) },
      { key: "requested_at", label: "Requested", render: (item) => toDateLabel(item.requested_at) },
      {
        key: "workflow",
        label: "Workflow",
        render: (item) => (
          <div className="flex flex-wrap justify-end gap-2">
            {canCreate && item.can_edit && (
              <>
                <button type="button" onClick={() => openEdit(item)} className={`${actionBtn} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}>
                  Edit
                </button>
              </>
            )}
            {canCreate && item.can_delete && (
              <>
                <button type="button" onClick={() => setPendingDelete(item)} className={`${actionBtn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}>
                  Delete
                </button>
              </>
            )}
            {canApprove && item.status === "pending_admin_approval" && (
              <>
                <button type="button" onClick={() => { void handleApprove(item); }} className={`${actionBtn} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
                  Approve
                </button>
                <button type="button" onClick={() => { void handleReject(item); }} className={`${actionBtn} border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                  Reject
                </button>
              </>
            )}
            {canFinance && item.status === "approved" && (
              <button type="button" onClick={() => openFinance(item)} className={`${actionBtn} border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`}>
                Process Payment
              </button>
            )}
            {item.payment_slip_no && (
              <button
                type="button"
                onClick={() => window.open(`/print/purchase-requests/${item.uuid}/payment-slip`, "_blank", "noopener,noreferrer")}
                className={`${actionBtn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#12121a] dark:text-slate-200 dark:hover:bg-[#1a1a2e]`}
              >
                Print Slip
              </button>
            )}
            {canReceive && (item.status === "paid" || item.status === "partial_received") && (
              <button type="button" onClick={() => openReceive(item)} className={`${actionBtn} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                Receive
              </button>
            )}
          </div>
        ),
      },
    ],
    [canApprove, canCreate, canFinance, canReceive, handleApprove, handleReject, openEdit, openFinance, openReceive]
  );

  return (
    <RequirePermission permission={["purchase_requests.view", "inventory.request", "purchase_requests.finance", "purchase_requests.receive"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader title="Purchase Requests" subtitle="Storekeeper submits, admin approves, finance pays from a company account, then warehouse or accountant receives the stock.">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Sync Purchase Requests
            </button>
            <button
              type="button"
              onClick={() => setAssetTypeModalOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Asset Types
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Create Purchase Request
              </button>
            )}
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Waiting Approval", value: summary.pending },
            { label: "Approved", value: summary.approved },
            { label: "Paid", value: summary.paid },
            { label: "Completed", value: summary.completed },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
              <div className="text-sm font-medium text-slate-500">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { key: "all", label: "All Requests", count: tableRows.length },
            { key: "waiting-approval", label: "Waiting Approval", count: summary.pending },
            { key: "finance-payment", label: "Waiting Payment", count: summary.approved },
            { key: "receive-ready", label: "Ready To Receive", count: summary.receiveReady },
            { key: "completed", label: "Completed", count: summary.completed },
          ].map((item) => {
            const selected = activeQueue === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setQueueFilter(item.key as PurchaseRequestQueueFilter)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  selected
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300 dark:hover:bg-[#1a1a2e]"
                }`}
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{item.count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <DataTable
            columns={columns}
            data={filteredTableRows}
            loading={loading}
            searchKeys={["request_no", "request_type", "requested_by_label", "source_label", "warehouse_name", "vendor_label", "project_label", "status", "search_materials", "purchase_receipt_no", "payment_slip_no"]}
            pageSize={TABLE_PAGE_SIZE}
            expandableRows
            compact
            renderExpandedRow={(row) => (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Project</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.project_label}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Requested By</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.requested_by_label}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Approved</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">
                      {row.approved_by_user_name ? `${row.approved_by_user_name} | ${toDateLabel(row.approved_at)}` : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Received</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">
                      {row.received_by_user_name ? `${row.received_by_user_name} | ${toDateLabel(row.received_at)}` : "-"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.warehouse_name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Supplier</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.vendor_label}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Source Material Request</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.source_label}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Receipt No</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.purchase_receipt_no || "-"}</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Approved Total</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{money(row.approved_grand_total ?? row.estimated_grand_total ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Payment Slip</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.payment_slip_no || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Payment Account</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">{row.payment_account_name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Paid</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">
                      {row.payment_amount != null
                        ? `${money(row.payment_amount)}${row.payment_account_amount != null && row.payment_account_currency ? ` | ${qty(row.payment_account_amount)} ${row.payment_account_currency}` : ""}`
                        : "-"}
                    </div>
                  </div>
                </div>

                {row.notes && (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#12121a] dark:text-slate-300">
                    {row.notes}
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a3e]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-[#0a0a0f] dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Kind</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Requested</th>
                        <th className="px-4 py-3">Approved</th>
                        <th className="px-4 py-3">Received</th>
                        <th className="px-4 py-3">Remaining</th>
                        <th className="px-4 py-3">Est. Unit</th>
                        <th className="px-4 py-3">Est. Total</th>
                        <th className="px-4 py-3">Actual Unit</th>
                        <th className="px-4 py-3">Actual Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(row.items ?? []).map((item) => {
                        const remaining = Math.max(0, Number(item.quantity_approved ?? item.quantity_requested ?? 0) - Number(item.quantity_received ?? 0));
                        return (
                          <tr key={item.uuid} className="border-t border-slate-200 dark:border-[#2a2a3e]">
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              {item.item_kind === "asset"
                                ? item.company_asset_code
                                  ? `${item.asset_name || "Asset"} (${item.company_asset_code})`
                                  : item.asset_name || "Asset"
                                : item.material_name || "Material"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 capitalize dark:text-slate-300">{item.item_kind || row.request_type}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.unit}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(item.quantity_requested)}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(item.quantity_approved)}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(item.quantity_received)}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{qty(remaining)}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.estimated_unit_price != null ? money(item.estimated_unit_price) : "-"}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.estimated_line_total != null ? money(item.estimated_line_total) : "-"}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.actual_unit_price != null ? money(item.actual_unit_price) : "-"}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.actual_line_total != null ? money(item.actual_line_total) : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <Modal isOpen={formOpen} onClose={closeForm} title={editing ? "Edit Purchase Request" : "Create Purchase Request"} size="xl">
        <div className="space-y-4">
          {form.source_material_request_no && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              This purchase request was prepared from material request <span className="font-semibold">{form.source_material_request_no}</span> because warehouse stock was not enough.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FormField
              label="Request Type"
              type="select"
              value={form.request_type}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  request_type: String(value) === "asset" ? "asset" : "material",
                  items: prev.items.map((item) =>
                    item.item_kind === (String(value) === "asset" ? "asset" : "material")
                      ? item
                      : {
                          ...item,
                          item_kind: String(value) === "asset" ? "asset" : "material",
                          material_id: String(value) === "asset" ? "" : item.material_id,
                          asset_source: String(value) === "asset" ? "existing" : "new",
                          company_asset_id: "",
                          asset_name: String(value) === "asset" ? item.asset_name : "",
                          asset_type: String(value) === "asset" ? item.asset_type || firstAssetTypeValue : "",
                          asset_code_prefix: String(value) === "asset" ? item.asset_code_prefix : "",
                          unit: String(value) === "asset" ? "unit" : item.unit,
                        }
                  ),
                }))
              }
              options={[
                { value: "material", label: "Consumable Material" },
                { value: "asset", label: "Company Asset" },
              ]}
              required
            />
            <FormField
              label="Warehouse"
              type="select"
              value={form.warehouse_id}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  warehouse_id: String(value),
                  items: prev.request_type === "asset"
                    ? prev.items.map((item) => ({
                        ...item,
                        company_asset_id: item.asset_source === "existing" ? "" : item.company_asset_id,
                        asset_name: item.asset_source === "existing" ? "" : item.asset_name,
                        asset_type: item.asset_source === "existing" ? item.asset_type || firstAssetTypeValue : item.asset_type,
                      }))
                    : prev.items,
                }))
              }
              options={warehouseOptions}
              disabled={lookupLoading}
              required
            />
            <FormField
              label="Supplier"
              type="select"
              value={form.vendor_id}
              onChange={(value) => setForm((prev) => ({ ...prev, vendor_id: String(value) }))}
              options={vendorOptions}
              placeholder={lookupLoading ? "Loading suppliers..." : vendorOptions.length ? "Select supplier" : "No suppliers available"}
              disabled={lookupLoading || vendorOptions.length === 0}
            />
            <FormField
              label="Project"
              type="select"
              value={form.project_id}
              onChange={(value) => setForm((prev) => ({ ...prev, project_id: String(value) }))}
              options={projectOptions}
              placeholder={lookupLoading ? "Loading projects..." : "Select project"}
              disabled={lookupLoading}
            />
          </div>

          {lookupLoading ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              Loading suppliers, warehouses, and project options...
            </div>
          ) : null}

          {!lookupLoading && vendorOptions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              No suppliers are available in local cache for this user right now. Sync vendor data or ask admin to confirm supplier records exist.
            </div>
          ) : null}

          <FormField label="Notes" type="textarea" value={form.notes} onChange={(value) => setForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />

          <div className="rounded-xl border border-slate-200 dark:border-[#2a2a3e]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#2a2a3e]">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Purchase Items</h3>
                <p className="text-xs text-slate-500">
                  {form.request_type === "asset"
                    ? "Add reusable company assets that should be purchased into warehouse stock."
                    : "Add consumable materials that must be purchased for the warehouse."}
                </p>
              </div>
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, createItem(prev.request_type)] }))} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100">
                Add Item
              </button>
            </div>
            <div className="space-y-4 p-4">
              {form.items.map((item, index) => (
                (() => {
                  const selectedCompanyAsset = findCompanyAssetById(companyAssets, item.company_asset_id);
                  const matchingCompanyAssets =
                    form.request_type === "asset" && item.asset_source === "new"
                      ? findMatchingCompanyAssets(companyAssets, form.warehouse_id, item.asset_name, item.asset_type)
                      : [];

                  return (
                <div key={item.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-[#2a2a3e]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Item {index + 1}</div>
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((entry) => entry.uuid !== item.uuid) }))} className="text-xs font-semibold text-red-600 hover:text-red-700">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {form.request_type === "asset" ? (
                      <FormField
                        label="Stock Target"
                        type="select"
                        value={item.asset_source}
                        onChange={(value) => setItemField(item.uuid, "asset_source", String(value))}
                        options={[
                          { value: "existing", label: "Use Existing Stock Line" },
                          { value: "new", label: "Create New Stock Line" },
                        ]}
                        required
                      />
                    ) : (
                      <FormField label="Material" type="select" value={item.material_id} onChange={(value) => setItemField(item.uuid, "material_id", String(value))} options={materialOptions} required />
                    )}
                    {form.request_type === "asset" && item.asset_source === "existing" ? (
                      <div className="space-y-1.5">
                        <FormField
                          label="Existing Stock Line"
                          type="select"
                          value={item.company_asset_id}
                          onChange={(value) => setItemField(item.uuid, "company_asset_id", String(value))}
                          options={companyAssetOptions}
                          placeholder={
                            !form.warehouse_id
                              ? "Select warehouse first"
                              : lookupLoading
                                ? "Loading stock lines..."
                                : companyAssetOptions.length
                                  ? "Select stock line"
                                  : "No stock lines available"
                          }
                          disabled={!form.warehouse_id || lookupLoading || companyAssetOptions.length === 0}
                          required
                        />
                        {!lookupLoading && form.warehouse_id && companyAssetOptions.length === 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            No existing stock lines were found for the selected warehouse in this session.
                          </p>
                        ) : null}
                      </div>
                    ) : form.request_type === "asset" ? (
                      <FormField label="Asset Name" value={item.asset_name} onChange={(value) => setItemField(item.uuid, "asset_name", String(value))} required />
                    ) : (
                      <FormField label="Unit" value={item.unit} onChange={(value) => setItemField(item.uuid, "unit", String(value))} required />
                    )}
                    {form.request_type === "asset" && item.asset_source === "existing" ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-300">
                        {item.company_asset_id
                          ? assetTypeLabelByCode.get(companyAssets.find((entry) => String(entry.id) === item.company_asset_id)?.asset_type || item.asset_type || "") || companyAssets.find((entry) => String(entry.id) === item.company_asset_id)?.asset_type || item.asset_type || "Asset"
                          : "Choose the stock line that should receive the extra quantity."}
                      </div>
                    ) : form.request_type === "asset" ? (
                      <div className="space-y-2">
                        <FormField
                          label="Asset Type"
                          type="select"
                          value={item.asset_type}
                          onChange={(value) => setItemField(item.uuid, "asset_type", String(value))}
                          options={assetTypeOptions}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setAssetTypeModalOpen(true)}
                          className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Manage asset types
                        </button>
                      </div>
                    ) : null}
                    <FormField label="Quantity Requested" type="number" value={item.quantity_requested} onChange={(value) => setItemField(item.uuid, "quantity_requested", String(value))} required />
                    <FormField
                      label="Estimated Unit Price (USD)"
                      type="number"
                      value={item.estimated_unit_price}
                      onChange={(value) => setItemField(item.uuid, "estimated_unit_price", String(value))}
                      placeholder="Optional"
                    />
                    {form.request_type === "asset" && item.asset_source === "new" && (
                      <FormField label="Code Prefix" value={item.asset_code_prefix} onChange={(value) => setItemField(item.uuid, "asset_code_prefix", String(value).toUpperCase())} placeholder="Optional prefix, e.g. GEN" />
                    )}
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-300">
                    <span className="font-semibold">Estimated line total:</span>{" "}
                    {item.estimated_unit_price !== ""
                      ? money(lineTotal(Number(item.quantity_requested || 0), Number(item.estimated_unit_price || 0)))
                      : "-"}
                  </div>
                  {form.request_type === "asset" && item.asset_source === "existing" && selectedCompanyAsset && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Selected Stock Line</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {selectedCompanyAsset.asset_name} ({selectedCompanyAsset.asset_code})
                          </div>
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {assetTypeLabelByCode.get(selectedCompanyAsset.asset_type) || selectedCompanyAsset.asset_type} in {selectedCompanyAsset.current_warehouse_name || "Selected warehouse"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white px-4 py-3 text-center shadow-sm dark:bg-[#12121a]">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current Available</div>
                          <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{qty(selectedCompanyAsset.quantity)}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-[#12121a] dark:text-slate-300">
                          <span className="font-semibold">Allocated:</span> {qty(selectedCompanyAsset.allocated_quantity ?? 0)}
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-[#12121a] dark:text-slate-300">
                          <span className="font-semibold">Damaged:</span> {qty(selectedCompanyAsset.damaged_quantity ?? 0)}
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-[#12121a] dark:text-slate-300">
                          <span className="font-semibold">Maintenance:</span> {qty(selectedCompanyAsset.maintenance_quantity ?? 0)}
                        </div>
                      </div>
                    </div>
                  )}
                  {form.request_type === "asset" && item.asset_source === "new" && matchingCompanyAssets.length > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                      <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        Matching stock line already exists in this warehouse
                      </div>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        To avoid duplicate asset rows, use one of these existing stock lines and increase its quantity instead.
                      </p>
                      <div className="mt-3 space-y-2">
                        {matchingCompanyAssets.slice(0, 3).map((asset) => (
                          <div
                            key={asset.uuid}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-3 dark:border-amber-500/20 dark:bg-[#12121a]"
                          >
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {asset.asset_name} ({asset.asset_code})
                              </div>
                              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                {assetTypeLabelByCode.get(asset.asset_type) || asset.asset_type} • Available {qty(asset.quantity)} • Allocated {qty(asset.allocated_quantity ?? 0)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((entry) =>
                                    entry.uuid === item.uuid
                                      ? {
                                          ...entry,
                                          asset_source: "existing",
                                          company_asset_id: String(asset.id ?? ""),
                                          asset_name: asset.asset_name,
                                          asset_type: asset.asset_type,
                                          asset_code_prefix: "",
                                          unit: "unit",
                                        }
                                      : entry
                                  ),
                                }))
                              }
                              className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200"
                            >
                              Use This Stock Line
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {form.request_type === "asset" && item.asset_source === "existing" && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Receiving this purchase will increase the selected warehouse stock line instead of creating a duplicate asset row.
                    </p>
                  )}
                  {form.request_type === "asset" && item.asset_source === "new" && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Use this only when the purchase should create a brand new warehouse stock line for this asset.
                    </p>
                  )}
                  <div className="mt-3">
                    <FormField label="Item Notes" type="textarea" value={item.notes} onChange={(value) => setItemField(item.uuid, "notes", String(value))} rows={2} />
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitForm(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Update Purchase Request" : "Create Purchase Request"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={receiveOpen} onClose={closeReceive} title={receiveTarget ? `Receive ${receiveTarget.request_no}` : "Receive Purchase Request"} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="Receive Date" type="date" value={receiveForm.receive_date} onChange={(value) => setReceiveForm((prev) => ({ ...prev, receive_date: String(value) }))} required />
          </div>
          <FormField label="Receive Notes" type="textarea" value={receiveForm.notes} onChange={(value) => setReceiveForm((prev) => ({ ...prev, notes: String(value) }))} rows={3} />
          <div className="space-y-3">
            {receiveForm.items.map((item) => (
              <div key={item.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-[#2a2a3e]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Item</div>
                    <div className="mt-1 font-medium text-slate-900 dark:text-white">
                      {item.item_kind === "asset"
                        ? item.company_asset_code
                          ? `${item.asset_name || "Asset"} (${item.company_asset_code})`
                          : item.asset_name || "Asset"
                        : item.material_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Kind</div>
                    <div className="mt-1 text-slate-700 capitalize dark:text-slate-300">{item.item_kind}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Unit</div>
                    <div className="mt-1 text-slate-700 dark:text-slate-300">{item.unit}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Requested</div>
                    <div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.quantity_requested)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Received</div>
                    <div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.quantity_received)}</div>
                  </div>
                  {item.item_kind === "material" ? (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Current Stock</div>
                      <div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.current_stock)}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">Current Available</div>
                      <div className="mt-1 text-slate-700 dark:text-slate-300">{qty(item.current_stock)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Estimated Unit Price</div>
                    <div className="mt-1 text-slate-700 dark:text-slate-300">{item.estimated_unit_price > 0 ? money(item.estimated_unit_price) : "-"}</div>
                  </div>
                  <FormField
                    label="Actual Unit Price (USD)"
                    type="number"
                    value={item.actual_unit_price}
                    onChange={(value) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        items: prev.items.map((entry) => (entry.uuid === item.uuid ? { ...entry, actual_unit_price: String(value) } : entry)),
                      }))
                    }
                    placeholder={item.estimated_unit_price > 0 ? String(item.estimated_unit_price) : "Optional"}
                  />
                  <FormField
                    label="Receive Now"
                    type="number"
                    value={item.quantity_receive_now}
                    onChange={(value) => setReceiveForm((prev) => ({ ...prev, items: prev.items.map((entry) => (entry.uuid === item.uuid ? { ...entry, quantity_receive_now: String(value) } : entry)) }))}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-300">
                    <span className="font-semibold">Estimated line total:</span> {item.estimated_line_total > 0 ? money(item.estimated_line_total) : "-"}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-[#2a2a3e] dark:bg-[#0a0a0f] dark:text-slate-300">
                    <span className="font-semibold">Actual receive total:</span>{" "}
                    {item.actual_unit_price !== "" && Number(item.quantity_receive_now || 0) > 0
                      ? money(lineTotal(Number(item.quantity_receive_now || 0), Number(item.actual_unit_price || 0)))
                      : "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {receiveError && <p className="text-sm text-red-600">{receiveError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeReceive} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitReceive(); }} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Receiving..." : "Receive Items"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={financeOpen} onClose={closeFinance} title={financeTarget ? `Process Payment ${financeTarget.request_no}` : "Process Purchase Payment"} size="lg">
        <div className="space-y-4">
          {financeTarget && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
              <div className="font-semibold">Finance payment is required before warehouse can receive items.</div>
              <div className="mt-1">Approved total: {money(financeTarget.approved_grand_total ?? financeTarget.estimated_grand_total ?? 0)}</div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField
              label="Payment Account"
              type="select"
              value={financeForm.account_id}
              onChange={(value) => setFinanceForm((prev) => ({ ...prev, account_id: String(value) }))}
              options={accountOptions}
              required
            />
            <FormField
              label="Payment Date"
              type="date"
              value={financeForm.payment_date}
              onChange={(value) => setFinanceForm((prev) => ({ ...prev, payment_date: String(value) }))}
              required
            />
            <FormField
              label="Payment Amount (USD)"
              type="number"
              value={financeForm.payment_amount}
              onChange={(value) => setFinanceForm((prev) => ({ ...prev, payment_amount: String(value) }))}
              required
            />
          </div>
          <FormField
            label="Finance Notes"
            type="textarea"
            value={financeForm.notes}
            onChange={(value) => setFinanceForm((prev) => ({ ...prev, notes: String(value) }))}
            rows={3}
          />
          {financeError && <p className="text-sm text-red-600">{financeError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeFinance} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitFinance(); }} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Processing..." : "Process Payment"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { void confirmDelete(); }}
        title="Delete Purchase Request"
        message="Are you sure you want to delete this purchase request?"
      />

      <AssetTypeManagerModal
        isOpen={assetTypeModalOpen}
        onClose={() => setAssetTypeModalOpen(false)}
      />
    </RequirePermission>
  );
}


