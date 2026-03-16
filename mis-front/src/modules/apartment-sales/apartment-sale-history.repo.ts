import { api } from "@/lib/api";

type Obj = Record<string, unknown>;

export type SaleInstallmentPaymentRow = {
  id?: number;
  uuid: string;
  installment_id: number;
  installment_uuid: string;
  installment_no: number;
  amount: number;
  payment_date: number;
  payment_method: string;
  reference_no?: string | null;
  notes?: string | null;
  received_by?: number | null;
  received_by_name?: string | null;
  sale_uuid?: string;
  sale_id?: string;
  created_at?: number;
  updated_at?: number;
};

export type SalePossessionLogRow = {
  id?: number;
  uuid: string;
  apartment_sale_id: number;
  action: string;
  action_date: number;
  user_id?: number | null;
  user_name?: string | null;
  note?: string | null;
  sale_uuid?: string;
  sale_id?: string;
  created_at?: number;
  updated_at?: number;
};

const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});

function toTs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const parsed = Date.parse(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function toMoney(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : Number(n.toFixed(2));
}

function toInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function parsePageMeta(payload: unknown): { hasMore: boolean } {
  const root = asObj(payload);
  const meta = asObj(root.meta);
  return { hasMore: Boolean(meta.has_more) };
}

function getApiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (data?.errors && typeof data.errors === "object") {
    for (const key of Object.keys(data.errors)) {
      const value = (data.errors as Obj)[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return "Request failed.";
}

function sanitizeInstallmentPayment(input: unknown): SaleInstallmentPaymentRow {
  const row = asObj(input);
  const idNum = Number(row.id);
  return {
    id: Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : undefined,
    uuid: String(row.uuid ?? ""),
    installment_id: toInt(row.installment_id),
    installment_uuid: String(row.installment_uuid ?? ""),
    installment_no: toInt(row.installment_no),
    amount: toMoney(row.amount),
    payment_date: toTs(row.payment_date),
    payment_method: String(row.payment_method ?? "cash"),
    reference_no: row.reference_no ? String(row.reference_no) : null,
    notes: row.notes ? String(row.notes) : null,
    received_by: row.received_by === null || row.received_by === undefined ? null : toInt(row.received_by),
    received_by_name: row.received_by_name ? String(row.received_by_name) : null,
    sale_uuid: row.sale_uuid ? String(row.sale_uuid) : "",
    sale_id: row.sale_id ? String(row.sale_id) : "",
    created_at: toTs(row.created_at),
    updated_at: toTs(row.updated_at),
  };
}

function sanitizePossessionLog(input: unknown): SalePossessionLogRow {
  const row = asObj(input);
  const idNum = Number(row.id);
  return {
    id: Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : undefined,
    uuid: String(row.uuid ?? ""),
    apartment_sale_id: toInt(row.apartment_sale_id),
    action: String(row.action ?? "").trim().toLowerCase(),
    action_date: toTs(row.action_date),
    user_id: row.user_id === null || row.user_id === undefined ? null : toInt(row.user_id),
    user_name: row.user_name ? String(row.user_name) : null,
    note: row.note ? String(row.note) : null,
    sale_uuid: row.sale_uuid ? String(row.sale_uuid) : "",
    sale_id: row.sale_id ? String(row.sale_id) : "",
    created_at: toTs(row.created_at),
    updated_at: toTs(row.updated_at),
  };
}

export async function apartmentSaleInstallmentPaymentsList(saleUuid: string): Promise<SaleInstallmentPaymentRow[]> {
  const normalized = saleUuid.trim();
  if (!normalized) return [];

  const rows: SaleInstallmentPaymentRow[] = [];
  let page = 1;
  while (true) {
    try {
      const res = await api.get(`/api/apartment-sales/${normalized}/installment-payments`, {
        params: { page, per_page: 100 },
      });
      const root = asObj(res.data);
      const list = Array.isArray(root.data) ? root.data : [];
      rows.push(...list.map(sanitizeInstallmentPayment).filter((item) => item.uuid));
      const { hasMore } = parsePageMeta(res.data);
      if (!hasMore) break;
      page += 1;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  }

  return rows;
}

export async function apartmentSalePossessionLogsList(saleUuid: string): Promise<SalePossessionLogRow[]> {
  const normalized = saleUuid.trim();
  if (!normalized) return [];

  const rows: SalePossessionLogRow[] = [];
  let page = 1;
  while (true) {
    try {
      const res = await api.get(`/api/apartment-sales/${normalized}/possession-logs`, {
        params: { page, per_page: 100 },
      });
      const root = asObj(res.data);
      const list = Array.isArray(root.data) ? root.data : [];
      rows.push(...list.map(sanitizePossessionLog).filter((item) => item.uuid));
      const { hasMore } = parsePageMeta(res.data);
      if (!hasMore) break;
      page += 1;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  }

  return rows;
}

