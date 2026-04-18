
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/auth/RequirePermission";
import AssetTypeManagerModal from "@/components/inventories/AssetTypeManagerModal";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { CompanyAssetRow, MaterialRow, VendorRow, WarehouseRow } from "@/db/localDB";
import { subscribeAppEvent } from "@/lib/appEvents";
import { notifyError } from "@/lib/notify";
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
  companyAssetCreate,
  companyAssetDelete,
  companyAssetUpdate,
  companyAssetsListLocal,
  companyAssetsPullToLocal,
  materialCreate,
  materialDelete,
  materialUpdate,
  materialsListLocal,
  materialsPullToLocal,
  vendorCreate,
  vendorDelete,
  vendorUpdate,
  vendorsListLocal,
  vendorsPullToLocal,
  warehouseCreate,
  warehouseDelete,
  warehouseUpdate,
  warehousesListLocal,
  warehousesPullToLocal,
  type CompanyAssetInput,
  type MaterialInput,
  type VendorInput,
  type WarehouseInput,
} from "@/modules/inventories/inventories.repo";

type InventoryTab = "materials" | "assets" | "warehouses" | "vendors";
type InventorySyncEntity = "vendors" | "warehouses" | "materials" | "company_assets";

type SyncCompleteDetail = {
  syncedAny?: boolean;
  cleaned?: boolean;
  entities?: string[];
};

type VendorFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  status: "active" | "inactive";
};

type WarehouseFormState = {
  name: string;
  location: string;
  status: "active" | "inactive";
};

type MaterialFormState = {
  name: string;
  material_type: string;
  unit: string;
  quantity: string;
  reference_unit_price: string;
  opening_warehouse_id: string;
  supplier_id: string;
  batch_no: string;
  serial_no: string;
  track_expiry: "yes" | "no";
  expiry_date: string;
  min_stock_level: string;
  status: "active" | "inactive";
  notes: string;
};

type AssetFormState = {
  asset_code: string;
  asset_name: string;
  asset_type: string;
  quantity: string;
  supplier_id: string;
  serial_no: string;
  status: "available" | "allocated" | "maintenance" | "damaged" | "retired";
  current_employee_id: string;
  current_project_id: string;
  current_warehouse_id: string;
  notes: string;
};

type DeleteState = {
  tab: InventoryTab;
  row: VendorRow | WarehouseRow | MaterialRow | CompanyAssetRow;
};

const LOCAL_PAGE_SIZE = 500;
const TABLE_PAGE_SIZE = 10;
const INVENTORY_SYNC_ENTITIES = new Set<InventorySyncEntity>([
  "vendors",
  "warehouses",
  "materials",
  "company_assets",
]);

function formatDate(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleDateString();
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatUsd(value?: number | null): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function createEmptyVendorForm(): VendorFormState {
  return { name: "", phone: "", email: "", address: "", status: "active" };
}

function createEmptyWarehouseForm(): WarehouseFormState {
  return { name: "", location: "", status: "active" };
}

function createEmptyMaterialForm(): MaterialFormState {
  return {
    name: "",
    material_type: "",
    unit: "pcs",
    quantity: "0",
    reference_unit_price: "",
    opening_warehouse_id: "",
    supplier_id: "",
    batch_no: "",
    serial_no: "",
    track_expiry: "no",
    expiry_date: "",
    min_stock_level: "0",
    status: "active",
    notes: "",
  };
}

function createEmptyAssetForm(defaultType = "tool"): AssetFormState {
  return {
    asset_code: "",
    asset_name: "",
    asset_type: defaultType,
    quantity: "0",
    supplier_id: "",
    serial_no: "",
    status: "available",
    current_employee_id: "",
    current_project_id: "",
    current_warehouse_id: "",
    notes: "",
  };
}

function normalizeVendorForm(row: VendorRow): VendorFormState {
  return {
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

function normalizeWarehouseForm(row: WarehouseRow): WarehouseFormState {
  return {
    name: row.name || "",
    location: row.location || "",
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

function normalizeMaterialForm(row: MaterialRow): MaterialFormState {
  return {
    name: row.name || "",
    material_type: row.material_type || "",
    unit: row.unit || "pcs",
    quantity: String(row.quantity ?? 0),
    reference_unit_price:
      row.reference_unit_price !== null && row.reference_unit_price !== undefined ? String(row.reference_unit_price) : "",
    opening_warehouse_id: "",
    supplier_id: row.supplier_id ? String(row.supplier_id) : "",
    batch_no: row.batch_no || "",
    serial_no: row.serial_no || "",
    track_expiry: row.expiry_date ? "yes" : "no",
    expiry_date: row.expiry_date ? new Date(row.expiry_date).toISOString().slice(0, 10) : "",
    min_stock_level: String(row.min_stock_level ?? 0),
    status: row.status === "inactive" ? "inactive" : "active",
    notes: row.notes || "",
  };
}

function normalizeAssetForm(row: CompanyAssetRow): AssetFormState {
  const status = ["available", "allocated", "maintenance", "damaged", "retired"].includes(row.status)
    ? (row.status as AssetFormState["status"])
    : "available";

  return {
    asset_code: row.asset_code || "",
    asset_name: row.asset_name || "",
    asset_type: row.asset_type || "tool",
    quantity: String(row.quantity ?? 0),
    supplier_id: row.supplier_id ? String(row.supplier_id) : "",
    serial_no: row.serial_no || "",
    status,
    current_employee_id: row.current_employee_id ? String(row.current_employee_id) : "",
    current_project_id: row.current_project_id ? String(row.current_project_id) : "",
    current_warehouse_id: row.current_warehouse_id ? String(row.current_warehouse_id) : "",
    notes: row.notes || "",
  };
}

function materialBadge(row: MaterialRow) {
  if (Number(row.legacy_quantity ?? 0) > 0) return <Badge color="amber">assign warehouse stock</Badge>;
  const isLowStock = Number(row.quantity ?? 0) <= Number(row.min_stock_level ?? 0) && Number(row.min_stock_level ?? 0) > 0;
  if (row.status === "inactive") return <Badge color="slate">inactive</Badge>;
  return isLowStock ? <Badge color="amber">low stock</Badge> : <Badge color="emerald">available</Badge>;
}

function assetBadge(status: string) {
  if (status === "allocated") return <Badge color="blue">allocated</Badge>;
  if (status === "maintenance") return <Badge color="amber">maintenance</Badge>;
  if (status === "damaged") return <Badge color="red">damaged</Badge>;
  if (status === "retired") return <Badge color="slate">retired</Badge>;
  return <Badge color="emerald">available</Badge>;
}

export default function InventoriesPage() {
  const [tab, setTab] = useState<InventoryTab>("materials");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [assets, setAssets] = useState<CompanyAssetRow[]>([]);
  const [assetTypeRows, setAssetTypeRows] = useState<DocumentTypeRow[]>([]);

  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [assetTypeModalOpen, setAssetTypeModalOpen] = useState(false);

  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRow | null>(null);
  const [editingAsset, setEditingAsset] = useState<CompanyAssetRow | null>(null);

  const [vendorForm, setVendorForm] = useState<VendorFormState>(createEmptyVendorForm());
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(createEmptyWarehouseForm());
  const [materialForm, setMaterialForm] = useState<MaterialFormState>(createEmptyMaterialForm());
  const [assetForm, setAssetForm] = useState<AssetFormState>(createEmptyAssetForm());

  const [vendorFormError, setVendorFormError] = useState<string | null>(null);
  const [warehouseFormError, setWarehouseFormError] = useState<string | null>(null);
  const [materialFormError, setMaterialFormError] = useState<string | null>(null);
  const [assetFormError, setAssetFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeleteState | null>(null);

  const loadLocal = useCallback(async () => {
    const [vendorPage, warehousePage, materialPage, assetPage, typeRows] = await Promise.all([
      vendorsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      warehousesListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      materialsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      companyAssetsListLocal({ page: 1, pageSize: LOCAL_PAGE_SIZE }),
      documentTypesListLocal({ module: ASSET_TYPE_MODULE, includeInactive: true }),
    ]);
    setVendors(vendorPage.items);
    setWarehouses(warehousePage.items);
    setMaterials(materialPage.items);
    setAssets(assetPage.items);
    setAssetTypeRows(typeRows);
  }, []);

  const refresh = useCallback(
    async (options?: { showLoader?: boolean; showFailureToast?: boolean; entitiesToPull?: InventorySyncEntity[] }) => {
      const showLoader = options?.showLoader ?? true;
      const showFailureToast = options?.showFailureToast ?? true;
      const entitiesToPull = options?.entitiesToPull ?? ["vendors", "warehouses", "materials", "company_assets"];

      if (showLoader) {
        setLoading(true);
      }

      try {
        await loadLocal();
        if (!entitiesToPull.length) {
          return;
        }

        let pullFailed = false;
        try {
          if (entitiesToPull.includes("vendors")) await vendorsPullToLocal();
          if (entitiesToPull.includes("warehouses")) await warehousesPullToLocal();
          if (entitiesToPull.includes("materials")) await materialsPullToLocal();
          if (entitiesToPull.includes("company_assets")) await companyAssetsPullToLocal();
          await documentTypesPullToLocal();
        } catch {
          pullFailed = true;
        }

        await loadLocal();

        if (showFailureToast && pullFailed && vendors.length === 0 && warehouses.length === 0 && materials.length === 0 && assets.length === 0) {
          notifyError("Unable to refresh inventory data from server. Using local data only.");
        }
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [assets.length, loadLocal, materials.length, vendors.length, warehouses.length]
  );

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
      const touchedInventory = entities.filter(
        (entity): entity is InventorySyncEntity => INVENTORY_SYNC_ENTITIES.has(entity as InventorySyncEntity)
      );
      if (!touchedInventory.length) {
        return;
      }

      void refresh({ showLoader: false, showFailureToast: false, entitiesToPull: touchedInventory });
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

  const vendorOptions = useMemo(
    () => vendors.map((item) => ({ value: String(item.id ?? ""), label: item.name })),
    [vendors]
  );
  const assetTypeLabelByCode = useMemo(() => buildAssetTypeLabelMap(assetTypeRows), [assetTypeRows]);
  const assetTypeOptions = useMemo(
    () => buildAssetTypeOptions(assetTypeRows, editingAsset?.asset_type ?? assetForm.asset_type),
    [assetForm.asset_type, assetTypeRows, editingAsset?.asset_type],
  );

  const summary = useMemo(() => {
    const lowStockCount = materials.filter(
      (item) => Number(item.min_stock_level ?? 0) > 0 && Number(item.quantity ?? 0) <= Number(item.min_stock_level ?? 0)
    ).length;
    const availableAssets = assets.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    const attentionAssets = assets.reduce(
      (sum, item) =>
        sum +
        Number(item.allocated_quantity ?? 0) +
        Number(item.maintenance_quantity ?? 0) +
        Number(item.damaged_quantity ?? 0),
      0
    );

    return {
      vendorCount: vendors.length,
      warehouseCount: warehouses.length,
      lowStockCount,
      availableAssets,
      attentionAssets,
    };
  }, [assets, materials, vendors.length, warehouses.length]);

  const currentTabLabel = useMemo(() => {
    if (tab === "vendors") return "Vendor";
    if (tab === "warehouses") return "Warehouse";
    if (tab === "assets") return "Asset";
    return "Material";
  }, [tab]);

  const openCreate = useCallback(() => {
    if (tab === "vendors") {
      setEditingVendor(null);
      setVendorForm(createEmptyVendorForm());
      setVendorFormError(null);
      setVendorFormOpen(true);
      return;
    }

    if (tab === "warehouses") {
      setEditingWarehouse(null);
      setWarehouseForm(createEmptyWarehouseForm());
      setWarehouseFormError(null);
      setWarehouseFormOpen(true);
      return;
    }

    if (tab === "assets") {
      setEditingAsset(null);
      setAssetForm(createEmptyAssetForm(assetTypeOptions[0]?.value ?? "tool"));
      setAssetFormError(null);
      setAssetFormOpen(true);
      return;
    }

    setEditingMaterial(null);
    setMaterialForm(createEmptyMaterialForm());
    setMaterialFormError(null);
    setMaterialFormOpen(true);
  }, [assetTypeOptions, tab]);

  const closeVendorForm = useCallback(() => {
    setVendorFormOpen(false);
    setEditingVendor(null);
    setVendorFormError(null);
    setVendorForm(createEmptyVendorForm());
  }, []);

  const closeWarehouseForm = useCallback(() => {
    setWarehouseFormOpen(false);
    setEditingWarehouse(null);
    setWarehouseFormError(null);
    setWarehouseForm(createEmptyWarehouseForm());
  }, []);

  const closeMaterialForm = useCallback(() => {
    setMaterialFormOpen(false);
    setEditingMaterial(null);
    setMaterialFormError(null);
    setMaterialForm(createEmptyMaterialForm());
  }, []);

  const closeAssetForm = useCallback(() => {
    setAssetFormOpen(false);
    setEditingAsset(null);
    setAssetFormError(null);
    setAssetForm(createEmptyAssetForm(assetTypeOptions[0]?.value ?? "tool"));
  }, [assetTypeOptions]);

  const openVendorEdit = useCallback((row: VendorRow) => {
    setEditingVendor(row);
    setVendorForm(normalizeVendorForm(row));
    setVendorFormError(null);
    setVendorFormOpen(true);
  }, []);

  const openWarehouseEdit = useCallback((row: WarehouseRow) => {
    setEditingWarehouse(row);
    setWarehouseForm(normalizeWarehouseForm(row));
    setWarehouseFormError(null);
    setWarehouseFormOpen(true);
  }, []);

  const openMaterialEdit = useCallback((row: MaterialRow) => {
    setEditingMaterial(row);
    setMaterialForm(normalizeMaterialForm(row));
    setMaterialFormError(null);
    setMaterialFormOpen(true);
  }, []);

  const openAssetEdit = useCallback((row: CompanyAssetRow) => {
    setEditingAsset(row);
    setAssetForm(normalizeAssetForm(row));
    setAssetFormError(null);
    setAssetFormOpen(true);
  }, []);

  const submitVendor = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setVendorFormError(null);
    try {
      const payload: VendorInput = {
        name: vendorForm.name,
        phone: vendorForm.phone,
        email: vendorForm.email,
        address: vendorForm.address,
        status: vendorForm.status,
      };

      if (editingVendor?.uuid) {
        await vendorUpdate(editingVendor.uuid, payload);
      } else {
        await vendorCreate(payload);
      }

      closeVendorForm();
      await loadLocal();
    } catch (error: unknown) {
      setVendorFormError(error instanceof Error ? error.message : "Unable to save vendor.");
    } finally {
      setSaving(false);
    }
  }, [closeVendorForm, editingVendor?.uuid, loadLocal, saving, vendorForm]);

  const submitWarehouse = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setWarehouseFormError(null);
    try {
      const payload: WarehouseInput = {
        name: warehouseForm.name,
        location: warehouseForm.location,
        status: warehouseForm.status,
      };

      if (editingWarehouse?.uuid) {
        await warehouseUpdate(editingWarehouse.uuid, payload);
      } else {
        await warehouseCreate(payload);
      }

      closeWarehouseForm();
      await loadLocal();
    } catch (error: unknown) {
      setWarehouseFormError(error instanceof Error ? error.message : "Unable to save warehouse.");
    } finally {
      setSaving(false);
    }
  }, [closeWarehouseForm, editingWarehouse?.uuid, loadLocal, saving, warehouseForm]);

  const submitMaterial = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setMaterialFormError(null);
    try {
      const payload: MaterialInput = {
        name: materialForm.name,
        material_type: materialForm.material_type,
        unit: materialForm.unit,
        quantity: Number(materialForm.quantity || 0),
        reference_unit_price: materialForm.reference_unit_price === "" ? null : Number(materialForm.reference_unit_price || 0),
        opening_warehouse_id: materialForm.opening_warehouse_id ? Number(materialForm.opening_warehouse_id) : null,
        supplier_id: materialForm.supplier_id ? Number(materialForm.supplier_id) : null,
        batch_no: materialForm.batch_no,
        serial_no: materialForm.serial_no,
        expiry_date: materialForm.track_expiry === "yes" ? materialForm.expiry_date || null : null,
        min_stock_level: Number(materialForm.min_stock_level || 0),
        status: materialForm.status,
        notes: materialForm.notes,
      };

      if (editingMaterial?.uuid) {
        await materialUpdate(editingMaterial.uuid, payload);
      } else {
        await materialCreate(payload);
      }

      closeMaterialForm();
      await loadLocal();
    } catch (error: unknown) {
      setMaterialFormError(error instanceof Error ? error.message : "Unable to save material.");
    } finally {
      setSaving(false);
    }
  }, [closeMaterialForm, editingMaterial?.uuid, loadLocal, materialForm, saving]);

  const submitAsset = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setAssetFormError(null);
    try {
      const quantity = Math.max(0, Number(assetForm.quantity || 0));
      const payload: CompanyAssetInput = {
        asset_code: assetForm.asset_code,
        asset_name: assetForm.asset_name,
        asset_type: assetForm.asset_type,
        quantity,
        supplier_id: assetForm.supplier_id ? Number(assetForm.supplier_id) : null,
        serial_no: assetForm.serial_no,
        status: assetForm.status,
        current_employee_id: assetForm.current_employee_id ? Number(assetForm.current_employee_id) : null,
        current_project_id: assetForm.current_project_id ? Number(assetForm.current_project_id) : null,
        current_warehouse_id: assetForm.current_warehouse_id ? Number(assetForm.current_warehouse_id) : null,
        notes: assetForm.notes,
      };

      if (editingAsset?.uuid) {
        await companyAssetUpdate(editingAsset.uuid, payload);
      } else {
        await companyAssetCreate(payload);
      }

      closeAssetForm();
      await loadLocal();
    } catch (error: unknown) {
      setAssetFormError(error instanceof Error ? error.message : "Unable to save company asset.");
    } finally {
      setSaving(false);
    }
  }, [assetForm, closeAssetForm, editingAsset?.uuid, loadLocal, saving]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      if (pendingDelete.tab === "vendors") {
        await vendorDelete((pendingDelete.row as VendorRow).uuid);
      } else if (pendingDelete.tab === "warehouses") {
        await warehouseDelete((pendingDelete.row as WarehouseRow).uuid);
      } else if (pendingDelete.tab === "assets") {
        await companyAssetDelete((pendingDelete.row as CompanyAssetRow).uuid);
      } else {
        await materialDelete((pendingDelete.row as MaterialRow).uuid);
      }
      await loadLocal();
    } catch (error) {
      console.error("Inventory delete failed", error);
    }
  }, [loadLocal, pendingDelete]);

  const vendorColumns = useMemo<Column<VendorRow>[]>(
    () => [
      { key: "name", label: "Vendor", render: (item) => <span className="font-semibold">{item.name}</span> },
      { key: "phone", label: "Phone", render: (item) => item.phone || "-" },
      { key: "email", label: "Email", render: (item) => item.email || "-" },
      { key: "status", label: "Status", render: (item) => <Badge color={item.status === "inactive" ? "slate" : "emerald"}>{item.status}</Badge> },
      { key: "updated_at", label: "Updated", render: (item) => formatDate(item.updated_at) },
    ],
    []
  );

  const warehouseColumns = useMemo<Column<WarehouseRow>[]>(
    () => [
      { key: "name", label: "Warehouse", render: (item) => <span className="font-semibold">{item.name}</span> },
      { key: "location", label: "Location", render: (item) => item.location || "-" },
      { key: "status", label: "Status", render: (item) => <Badge color={item.status === "inactive" ? "slate" : "blue"}>{item.status}</Badge> },
      { key: "updated_at", label: "Updated", render: (item) => formatDate(item.updated_at) },
    ],
    []
  );

  const materialColumns = useMemo<Column<MaterialRow>[]>(
    () => [
      { key: "name", label: "Material", render: (item) => <span className="font-semibold">{item.name}</span> },
      { key: "material_type", label: "Type", render: (item) => item.material_type || "-" },
      { key: "supplier_name", label: "Supplier", render: (item) => item.supplier_name || "-" },
      { key: "unit", label: "Unit", render: (item) => item.unit || "-" },
      { key: "reference_unit_price", label: "Ref. Price", render: (item) => (item.reference_unit_price != null ? formatUsd(item.reference_unit_price) : "-") },
      { key: "quantity", label: "Quantity", render: (item) => formatQuantity(Number(item.quantity ?? 0)) },
      { key: "stock_status", label: "Stock Status", render: (item) => materialBadge(item) },
      { key: "expiry_date", label: "Expiry", render: (item) => (item.expiry_date ? formatDate(item.expiry_date) : "No expiry") },
    ],
    []
  );

  const assetColumns = useMemo<Column<CompanyAssetRow>[]>(
    () => [
      { key: "asset_code", label: "Code", render: (item) => <span className="font-semibold">{item.asset_code}</span> },
      { key: "asset_name", label: "Asset", render: (item) => item.asset_name || "-" },
      { key: "asset_type", label: "Type", render: (item) => assetTypeLabelByCode.get(item.asset_type) || item.asset_type || "-" },
      { key: "supplier_name", label: "Supplier", render: (item) => item.supplier_name || "-" },
      { key: "current_warehouse_name", label: "Warehouse", render: (item) => item.current_warehouse_name || "-" },
      { key: "quantity", label: "Available Qty", render: (item) => formatQuantity(Number(item.quantity ?? 0)) },
      { key: "allocated_quantity", label: "Allocated Qty", render: (item) => formatQuantity(Number(item.allocated_quantity ?? 0)) },
      { key: "damaged_quantity", label: "Damaged Qty", render: (item) => formatQuantity(Number(item.damaged_quantity ?? 0)) },
      { key: "status", label: "Status", render: (item) => assetBadge(item.status) },
      { key: "updated_at", label: "Updated", render: (item) => formatDate(item.updated_at) },
    ],
    [assetTypeLabelByCode]
  );

  const activeDataTable = useMemo(() => {
    if (tab === "vendors") {
      return (
        <DataTable
          columns={vendorColumns}
          data={vendors}
          loading={loading}
          onEdit={openVendorEdit}
          onDelete={(row) => setPendingDelete({ tab: "vendors", row })}
          searchKeys={["name", "phone", "email", "status"]}
          pageSize={TABLE_PAGE_SIZE}
          compact
        />
      );
    }

    if (tab === "warehouses") {
      return (
        <DataTable
          columns={warehouseColumns}
          data={warehouses}
          loading={loading}
          onEdit={openWarehouseEdit}
          onDelete={(row) => setPendingDelete({ tab: "warehouses", row })}
          searchKeys={["name", "location", "status"]}
          pageSize={TABLE_PAGE_SIZE}
          compact
        />
      );
    }

    if (tab === "assets") {
      return (
        <DataTable
          columns={assetColumns}
          data={assets}
          loading={loading}
          onEdit={openAssetEdit}
          onDelete={(row) => setPendingDelete({ tab: "assets", row })}
          searchKeys={["asset_code", "asset_name", "asset_type", "supplier_name", "current_warehouse_name", "current_employee_name", "current_project_name", "status"]}
          pageSize={TABLE_PAGE_SIZE}
          compact
        />
      );
    }

    return (
      <DataTable
        columns={materialColumns}
        data={materials}
        loading={loading}
        onEdit={openMaterialEdit}
        onDelete={(row) => setPendingDelete({ tab: "materials", row })}
        searchKeys={["name", "material_type", "unit", "supplier_name", "batch_no", "serial_no", "status"]}
        pageSize={TABLE_PAGE_SIZE}
        compact
      />
    );
  }, [
    assetColumns,
    assets,
    loading,
    materialColumns,
    materials,
    openAssetEdit,
    openMaterialEdit,
    openVendorEdit,
    openWarehouseEdit,
    tab,
    vendorColumns,
    vendors,
    warehouseColumns,
    warehouses,
  ]);

  return (
    <RequirePermission permission={["inventory_master.view", "inventory.request"]}>
      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <PageHeader
          title="Inventory & Assets"
          subtitle="Master data foundation with offline-first sync for vendors, warehouses, materials, and company assets."
        >
          <div className="flex flex-wrap gap-2">
            {[
              { id: "materials", label: "Materials" },
              { id: "assets", label: "Assets" },
              { id: "warehouses", label: "Warehouses" },
              { id: "vendors", label: "Vendors" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as InventoryTab)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
            >
              Sync Inventory
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Create {currentTabLabel}
            </button>
            {tab === "assets" ? (
              <button
                type="button"
                onClick={() => setAssetTypeModalOpen(true)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]"
              >
                Asset Types
              </button>
            ) : null}
          </div>
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Vendors</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{summary.vendorCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Warehouses</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{summary.warehouseCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Low Stock Alerts</div>
            <div className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">{summary.lowStockCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Available Assets</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.availableAssets}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]">
            <div className="text-sm font-medium text-slate-500">Assets Requiring Attention</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{summary.attentionAssets}</div>
            <div className="mt-1 text-xs text-slate-500">allocated, maintenance, or damaged</div>
          </div>
        </div>

        <div className="mt-6">{activeDataTable}</div>
      </div>

      <Modal isOpen={vendorFormOpen} onClose={closeVendorForm} title={editingVendor ? "Edit Vendor" : "Create Vendor"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Vendor Name" value={vendorForm.name} onChange={(value) => setVendorForm((prev) => ({ ...prev, name: String(value) }))} required />
            <FormField label="Phone" value={vendorForm.phone} onChange={(value) => setVendorForm((prev) => ({ ...prev, phone: String(value) }))} />
            <FormField label="Email" type="email" value={vendorForm.email} onChange={(value) => setVendorForm((prev) => ({ ...prev, email: String(value) }))} />
            <FormField
              label="Status"
              type="select"
              value={vendorForm.status}
              onChange={(value) => setVendorForm((prev) => ({ ...prev, status: String(value) as VendorFormState["status"] }))}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              required
            />
          </div>
          <FormField label="Address" type="textarea" value={vendorForm.address} onChange={(value) => setVendorForm((prev) => ({ ...prev, address: String(value) }))} rows={4} />
          {vendorFormError && <p className="text-sm text-red-600">{vendorFormError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeVendorForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitVendor(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editingVendor ? "Update Vendor" : "Create Vendor"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={warehouseFormOpen} onClose={closeWarehouseForm} title={editingWarehouse ? "Edit Warehouse" : "Create Warehouse"} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Warehouse Name" value={warehouseForm.name} onChange={(value) => setWarehouseForm((prev) => ({ ...prev, name: String(value) }))} required />
            <FormField label="Location" value={warehouseForm.location} onChange={(value) => setWarehouseForm((prev) => ({ ...prev, location: String(value) }))} />
            <FormField
              label="Status"
              type="select"
              value={warehouseForm.status}
              onChange={(value) => setWarehouseForm((prev) => ({ ...prev, status: String(value) as WarehouseFormState["status"] }))}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              required
            />
          </div>
          {warehouseFormError && <p className="text-sm text-red-600">{warehouseFormError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeWarehouseForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitWarehouse(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editingWarehouse ? "Update Warehouse" : "Create Warehouse"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={materialFormOpen} onClose={closeMaterialForm} title={editingMaterial ? "Edit Material" : "Create Material"} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="Material Name" value={materialForm.name} onChange={(value) => setMaterialForm((prev) => ({ ...prev, name: String(value) }))} required />
            <FormField label="Type" value={materialForm.material_type} onChange={(value) => setMaterialForm((prev) => ({ ...prev, material_type: String(value) }))} placeholder="cement, cable, steel..." />
            <FormField label="Unit" value={materialForm.unit} onChange={(value) => setMaterialForm((prev) => ({ ...prev, unit: String(value) }))} required />
            <FormField
              label="Reference Unit Price (USD)"
              type="number"
              value={materialForm.reference_unit_price}
              onChange={(value) => setMaterialForm((prev) => ({ ...prev, reference_unit_price: String(value) }))}
              placeholder="Optional"
            />
            <FormField
              label={editingMaterial?.has_warehouse_stock ? "Warehouse Managed Stock" : "Opening Quantity"}
              type="number"
              value={materialForm.quantity}
              onChange={(value) => setMaterialForm((prev) => ({ ...prev, quantity: String(value) }))}
              disabled={Boolean(editingMaterial?.has_warehouse_stock)}
              required
            />
            <FormField
              label={editingMaterial?.has_warehouse_stock ? "Opening Warehouse (Locked)" : "Opening Warehouse"}
              type="select"
              value={materialForm.opening_warehouse_id}
              onChange={(value) => setMaterialForm((prev) => ({ ...prev, opening_warehouse_id: String(value) }))}
              options={warehouses.map((item) => ({ value: String(item.id ?? ""), label: item.name }))}
              placeholder="Select warehouse"
              disabled={Boolean(editingMaterial?.has_warehouse_stock)}
            />
            <FormField label="Min Stock Level" type="number" value={materialForm.min_stock_level} onChange={(value) => setMaterialForm((prev) => ({ ...prev, min_stock_level: String(value) }))} required />
            <FormField
              label="Supplier"
              type="select"
              value={materialForm.supplier_id}
              onChange={(value) => setMaterialForm((prev) => ({ ...prev, supplier_id: String(value) }))}
              options={vendorOptions}
              placeholder="Select supplier"
            />
            <FormField label="Batch No" value={materialForm.batch_no} onChange={(value) => setMaterialForm((prev) => ({ ...prev, batch_no: String(value) }))} />
            <FormField label="Serial No" value={materialForm.serial_no} onChange={(value) => setMaterialForm((prev) => ({ ...prev, serial_no: String(value) }))} />
            <FormField
              label="Expiry Tracking"
              type="select"
              value={materialForm.track_expiry}
              onChange={(value) =>
                setMaterialForm((prev) => ({
                  ...prev,
                  track_expiry: String(value) === "yes" ? "yes" : "no",
                  expiry_date: String(value) === "yes" ? prev.expiry_date : "",
                }))
              }
              options={[
                { value: "no", label: "No Expiry" },
                { value: "yes", label: "Track Expiry" },
              ]}
              required
            />
            <FormField
              label={materialForm.track_expiry === "yes" ? "Expiry Date" : "Expiry Date (Not Needed)"}
              type="date"
              value={materialForm.expiry_date}
              onChange={(value) => setMaterialForm((prev) => ({ ...prev, expiry_date: String(value) }))}
              disabled={materialForm.track_expiry !== "yes"}
            />
            <FormField
              label="Status"
              type="select"
              value={materialForm.status}
              onChange={(value) => setMaterialForm((prev) => ({ ...prev, status: String(value) as MaterialFormState["status"] }))}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              required
            />
          </div>
          {/* <p className="text-xs text-slate-500">
            Use <span className="font-semibold">No Expiry</span> for materials like brick, block, sand, gravel, steel, and similar items.
          </p>
          {editingMaterial?.has_warehouse_stock ? (
            <p className="text-xs text-slate-500">
              This material now uses warehouse stock records. Change stock through purchase receipts, issue flows, or warehouse assignment instead of editing the quantity here.
            </p>
          ) : Number(editingMaterial?.legacy_quantity ?? 0) > 0 ? (
            <p className="text-xs text-amber-600">
              This material still has {formatQuantity(Number(editingMaterial?.legacy_quantity ?? 0))} units of legacy stock. Choose the warehouse where that stock is actually stored and save once to assign it.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              For new materials with starting stock, choose the warehouse where that opening quantity is physically stored.
            </p>
          )} */}
          {/* <p className="text-xs text-slate-500">
            Reference unit price is a procurement default for autofill. The actual purchase price can still change on each purchase request and again at receive time.
          </p> */}
          <FormField label="Notes" type="textarea" value={materialForm.notes} onChange={(value) => setMaterialForm((prev) => ({ ...prev, notes: String(value) }))} rows={4} />
          {materialFormError && <p className="text-sm text-red-600">{materialFormError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeMaterialForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitMaterial(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editingMaterial ? "Update Material" : "Create Material"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={assetFormOpen} onClose={closeAssetForm} title={editingAsset ? "Edit Company Asset" : "Create Company Asset"} size="xl">
        <div className="space-y-4">
          {/* <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
            Company assets now work like reusable stock lines. One row can represent a large available quantity such as <span className="font-semibold">Desktop = 5000</span>, while request and allocation flows move quantities in and out of that stock.
          </div> */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              label="Asset Code"
              value={assetForm.asset_code}
              onChange={(value) => setAssetForm((prev) => ({ ...prev, asset_code: String(value).toUpperCase() }))}
              placeholder="DESKTOP-STOCK"
              required
            />
            <FormField label="Asset Name" value={assetForm.asset_name} onChange={(value) => setAssetForm((prev) => ({ ...prev, asset_name: String(value) }))} required />
            <div className="space-y-2">
              <FormField
                label="Asset Type"
                type="select"
                value={assetForm.asset_type}
                onChange={(value) => setAssetForm((prev) => ({ ...prev, asset_type: String(value) }))}
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
            <FormField
              label="Available Quantity"
              type="number"
              value={assetForm.quantity}
              onChange={(value) => setAssetForm((prev) => ({ ...prev, quantity: String(value) }))}
              required
            />
            <FormField
              label="Supplier"
              type="select"
              value={assetForm.supplier_id}
              onChange={(value) => setAssetForm((prev) => ({ ...prev, supplier_id: String(value) }))}
              options={vendorOptions}
              placeholder="Select supplier"
            />
            <FormField label="Serial / Model No" value={assetForm.serial_no} onChange={(value) => setAssetForm((prev) => ({ ...prev, serial_no: String(value) }))} />
            <FormField
              label="Status"
              type="select"
              value={assetForm.status}
              onChange={(value) => setAssetForm((prev) => ({ ...prev, status: String(value) as AssetFormState["status"] }))}
              options={[
                { value: "available", label: "Available" },
                { value: "allocated", label: "Allocated" },
                { value: "maintenance", label: "Maintenance" },
                { value: "damaged", label: "Damaged" },
                { value: "retired", label: "Retired" },
              ]}
              required
            />
            <FormField
              label="Warehouse"
              type="select"
              value={assetForm.current_warehouse_id}
              onChange={(value) => setAssetForm((prev) => ({ ...prev, current_warehouse_id: String(value) }))}
              options={warehouses.map((item) => ({ value: String(item.id ?? ""), label: item.name }))}
              placeholder="Select warehouse"
            />
          </div>
          {/* <p className="text-xs text-slate-500">
            Example: create one row with <span className="font-semibold">Asset Code = DESKTOP-STOCK</span> and <span className="font-semibold">Available Quantity = 5000</span>. Allocation and return workflows will move quantities against this stock instead of creating 5000 separate rows.
          </p> */}
          <FormField label="Notes" type="textarea" value={assetForm.notes} onChange={(value) => setAssetForm((prev) => ({ ...prev, notes: String(value) }))} rows={4} />
          {assetFormError && <p className="text-sm text-red-600">{assetFormError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeAssetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-[#1a1a2e]">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { void submitAsset(); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : editingAsset ? "Update Asset" : "Create Asset"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title={`Delete ${currentTabLabel}`}
        message={`Are you sure you want to delete this ${currentTabLabel.toLowerCase()}? This will also sync the delete when the device is online.`}
      />

      <AssetTypeManagerModal
        isOpen={assetTypeModalOpen}
        onClose={() => setAssetTypeModalOpen(false)}
      />
    </RequirePermission>
  );
}
