export type PurchaseRequestDraftItem = {
  material_id: number;
  quantity_requested: number;
  unit: string;
  notes?: string | null;
};

export type PurchaseRequestDraft = {
  request_type?: "material" | "asset";
  source_material_request_id?: number | null;
  source_material_request_uuid?: string | null;
  source_material_request_no?: string | null;
  project_id?: number | null;
  warehouse_id: number;
  notes?: string | null;
  items: PurchaseRequestDraftItem[];
};

const DRAFT_KEY = "purchase_request_draft_v1";

export function setPurchaseRequestDraft(draft: PurchaseRequestDraft): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function consumePurchaseRequestDraft(): PurchaseRequestDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(DRAFT_KEY);

  try {
    return JSON.parse(raw) as PurchaseRequestDraft;
  } catch {
    return null;
  }
}
