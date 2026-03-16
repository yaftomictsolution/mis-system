import { db, type ApartmentSaleFinancialRow } from "@/db/localDB";
import { api } from "@/lib/api";

type Obj = Record<string, unknown>;

export type MunicipalityLetter = {
  uuid: string;
  letter_no: string;
  issued_at: string | null;
  apartment_sale_id: number;
  sale_uuid: string;
  municipality_share_amount: number;
  remaining_municipality: number;
  printable_html: string;
};

export type MunicipalityReceipt = {
  id?: number;
  uuid: string;
  apartment_sale_id: number;
  receipt_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes?: string | null;
  received_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MunicipalityReceiptInput = {
  amount: number;
  payment_date?: string;
  payment_method?: "cash" | "bank" | "transfer" | "cheque";
  receipt_no?: string;
  notes?: string;
};

const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});

const toMoney = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(2));
};

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

function sanitizeLetter(input: unknown): MunicipalityLetter {
  const row = asObj(input);
  return {
    uuid: String(row.uuid ?? ""),
    letter_no: String(row.letter_no ?? ""),
    issued_at: row.issued_at ? String(row.issued_at) : null,
    apartment_sale_id: Math.max(0, Number(row.apartment_sale_id) || 0),
    sale_uuid: String(row.sale_uuid ?? ""),
    municipality_share_amount: toMoney(row.municipality_share_amount),
    remaining_municipality: toMoney(row.remaining_municipality),
    printable_html: String(row.printable_html ?? ""),
  };
}

function sanitizeReceipt(input: unknown): MunicipalityReceipt {
  const row = asObj(input);
  const id = Number(row.id);
  return {
    id: Number.isFinite(id) && id > 0 ? Math.trunc(id) : undefined,
    uuid: String(row.uuid ?? ""),
    apartment_sale_id: Math.max(0, Number(row.apartment_sale_id) || 0),
    receipt_no: String(row.receipt_no ?? ""),
    payment_date: String(row.payment_date ?? ""),
    amount: toMoney(row.amount),
    payment_method: String(row.payment_method ?? "cash"),
    notes: row.notes ? String(row.notes) : null,
    received_by: row.received_by ? Number(row.received_by) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

function sanitizeFinancial(input: unknown): ApartmentSaleFinancialRow | null {
  const row = asObj(input);
  const saleUuid = String(row.uuid ?? row.sale_uuid ?? "");
  if (!saleUuid) return null;

  return {
    id: Number.isFinite(Number(row.id)) ? Math.max(0, Math.trunc(Number(row.id))) : undefined,
    uuid: saleUuid,
    sale_uuid: String(row.sale_uuid ?? saleUuid),
    apartment_sale_id: Number.isFinite(Number(row.apartment_sale_id))
      ? Math.max(0, Math.trunc(Number(row.apartment_sale_id)))
      : undefined,
    accounts_status: String(row.accounts_status ?? "open"),
    municipality_share_15: toMoney(row.municipality_share_15),
    delivered_to_municipality: toMoney(row.delivered_to_municipality),
    remaining_municipality: toMoney(row.remaining_municipality),
    company_share_85: toMoney(row.company_share_85),
    delivered_to_company: toMoney(row.delivered_to_company),
    rahnama_fee_1: toMoney(row.rahnama_fee_1),
    customer_debt: toMoney(row.customer_debt),
    discount_or_contractor_deduction: toMoney(row.discount_or_contractor_deduction),
    updated_at: Number.isFinite(Number(row.updated_at)) ? Math.max(0, Math.trunc(Number(row.updated_at))) : Date.now(),
  };
}

export async function municipalityLetterGet(saleUuid: string): Promise<MunicipalityLetter> {
  try {
    const res = await api.get(`/api/apartment-sales/${saleUuid}/municipality-letter`);
    return sanitizeLetter(asObj(res.data).data);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function municipalityLetterGenerate(saleUuid: string): Promise<MunicipalityLetter> {
  try {
    const res = await api.post(`/api/apartment-sales/${saleUuid}/municipality-letter`);
    return sanitizeLetter(asObj(res.data).data);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function municipalityReceiptList(
  saleUuid: string,
  params: { page?: number; perPage?: number } = {}
): Promise<MunicipalityReceipt[]> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 100));

  try {
    const res = await api.get(`/api/apartment-sales/${saleUuid}/municipality-receipts`, {
      params: { page, per_page: perPage },
    });

    const data = asObj(res.data);
    const rows = Array.isArray(data.data) ? data.data : [];
    return rows.map(sanitizeReceipt);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function municipalityReceiptCreate(
  saleUuid: string,
  input: MunicipalityReceiptInput
): Promise<{ receipt: MunicipalityReceipt; financial: ApartmentSaleFinancialRow | null; letter: MunicipalityLetter | null; apartmentStatus: string | null }> {
  try {
    const res = await api.post(`/api/apartment-sales/${saleUuid}/municipality-receipts`, input);
    const root = asObj(res.data);
    const payload = asObj(root.data);
    const source = Object.keys(payload).length ? payload : root;
    const receiptPayload = asObj(source.receipt);
    const financialPayload = asObj(source.financial);
    const financial = sanitizeFinancial(financialPayload);
    const normalizedFinancial = financial
      ? {
          ...financial,
          sale_uuid: financial.sale_uuid || saleUuid,
          uuid: financial.uuid || financial.sale_uuid || saleUuid,
        }
      : null;

    if (normalizedFinancial?.sale_uuid) {
      await db.apartment_sale_financials.put(normalizedFinancial);
    }

    return {
      receipt: sanitizeReceipt(Object.keys(receiptPayload).length ? receiptPayload : source),
      financial: normalizedFinancial,
      letter: source.letter ? sanitizeLetter(source.letter) : null,
      apartmentStatus: source.apartment_status ? String(source.apartment_status) : null,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}
