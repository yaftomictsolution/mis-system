import { db, type ApartmentSaleFinancialRow, type ApartmentSaleRow } from "@/db/localDB";
import { enqueueSync } from "@/sync/queue";

type Obj = Record<string, unknown>;

type UpsertOptions = {
  queue?: boolean;
};

export type ApartmentSaleFinancialPatch = {
  accounts_status?: string;
  delivered_to_municipality?: number;
  delivered_to_company?: number;
  rahnama_fee_1?: number;
  discount_or_contractor_deduction?: number;
};

const asObj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});

function toMoney(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : Number(n.toFixed(2));
}

function money(v: number): number {
  return Number((Number.isFinite(v) ? v : 0).toFixed(2));
}

function normalizeAccountsStatus(v: unknown): string {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 100) : "open";
}

function deriveAccountsStatus(row: Omit<ApartmentSaleFinancialRow, "accounts_status">): string {
  if (row.customer_debt <= 0 && row.remaining_municipality <= 0) return "settled";
  if (row.delivered_to_municipality > 0 || row.delivered_to_company > 0) return "partial";
  return "open";
}

async function getInstallmentsPaidTotalForSale(sale: ApartmentSaleRow): Promise<number> {
  const bySaleUuid = sale.uuid ? await db.installments.where("sale_uuid").equals(sale.uuid).toArray() : [];
  const bySaleId =
    sale.id && sale.id > 0 ? await db.installments.where("apartment_sale_id").equals(sale.id).toArray() : [];

  const merged = new Map<string, (typeof bySaleUuid)[number]>();
  for (const row of [...bySaleUuid, ...bySaleId]) {
    const key = row.uuid || `${row.apartment_sale_id}:${row.installment_no}:${row.due_date}`;
    merged.set(key, row);
  }

  let total = 0;
  for (const row of merged.values()) {
    total += toMoney(row.paid_amount);
  }
  return money(total);
}

function buildFinancialRow(
  sale: ApartmentSaleRow,
  existing: ApartmentSaleFinancialRow | undefined,
  paidTotal: number
): ApartmentSaleFinancialRow {
  const totalPrice = toMoney(sale.total_price);
  const discount = toMoney(sale.discount);
  const netPrice = toMoney(sale.net_price ?? totalPrice - discount);
  const municipalityShare15 = money(netPrice * 0.15);
  const companyShare85 = money(netPrice * 0.85);

  const discountOrDeduction = toMoney(existing?.discount_or_contractor_deduction ?? 0);
  const deliveredToMunicipality = Math.min(toMoney(existing?.delivered_to_municipality ?? 0), municipalityShare15);
  const deliveredToCompany = Math.min(toMoney(existing?.delivered_to_company ?? 0), companyShare85);
  const remainingMunicipality = money(Math.max(0, municipalityShare15 - deliveredToMunicipality));
  const rahnamaFee1 = toMoney(existing?.rahnama_fee_1 ?? netPrice * 0.01);

  const saleStatus = String(sale.status ?? "").trim().toLowerCase();
  const paidFromSale = toMoney(sale.installments_paid_total ?? paidTotal);
  const assumedFullPaid = sale.payment_type === "full" && saleStatus === "completed";
  const effectivePaid = assumedFullPaid ? netPrice : paidFromSale;
  const customerDebt = money(Math.max(0, netPrice - effectivePaid - discountOrDeduction));

  const baseRow: Omit<ApartmentSaleFinancialRow, "accounts_status"> = {
    id: existing?.id,
    uuid: existing?.uuid ?? sale.uuid,
    sale_uuid: sale.uuid,
    apartment_sale_id: sale.id,
    municipality_share_15: municipalityShare15,
    delivered_to_municipality: deliveredToMunicipality,
    remaining_municipality: remainingMunicipality,
    company_share_85: companyShare85,
    delivered_to_company: deliveredToCompany,
    rahnama_fee_1: rahnamaFee1,
    customer_debt: customerDebt,
    discount_or_contractor_deduction: discountOrDeduction,
    updated_at: Date.now(),
  };

  return {
    ...baseRow,
    accounts_status: normalizeAccountsStatus(existing?.accounts_status ?? deriveAccountsStatus(baseRow)),
  };
}

function toApiPayload(row: ApartmentSaleFinancialRow): Obj {
  return {
    uuid: row.uuid,
    sale_uuid: row.sale_uuid,
    apartment_sale_id: row.apartment_sale_id,
    accounts_status: row.accounts_status,
    municipality_share_15: row.municipality_share_15,
    delivered_to_municipality: row.delivered_to_municipality,
    remaining_municipality: row.remaining_municipality,
    company_share_85: row.company_share_85,
    delivered_to_company: row.delivered_to_company,
    rahnama_fee_1: row.rahnama_fee_1,
    customer_debt: row.customer_debt,
    discount_or_contractor_deduction: row.discount_or_contractor_deduction,
    updated_at: row.updated_at,
  };
}

export function sanitizeApartmentSaleFinancial(input: unknown): ApartmentSaleFinancialRow {
  const r = asObj(input);
  const idNum = Number(r.id);

  return {
    id: Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : undefined,
    uuid: String(r.uuid ?? r.sale_uuid ?? ""),
    sale_uuid: String(r.sale_uuid ?? r.uuid ?? ""),
    apartment_sale_id: Number.isFinite(Number(r.apartment_sale_id))
      ? Math.max(0, Math.trunc(Number(r.apartment_sale_id)))
      : undefined,
    accounts_status: normalizeAccountsStatus(r.accounts_status),
    municipality_share_15: toMoney(r.municipality_share_15),
    delivered_to_municipality: toMoney(r.delivered_to_municipality),
    remaining_municipality: toMoney(r.remaining_municipality),
    company_share_85: toMoney(r.company_share_85),
    delivered_to_company: toMoney(r.delivered_to_company),
    rahnama_fee_1: toMoney(r.rahnama_fee_1),
    customer_debt: toMoney(r.customer_debt),
    discount_or_contractor_deduction: toMoney(r.discount_or_contractor_deduction),
    updated_at: Number.isFinite(Number(r.updated_at))
      ? Math.max(0, Math.trunc(Number(r.updated_at)))
      : Date.now(),
  };
}

export async function apartmentSaleFinancialGetLocal(saleUuid: string): Promise<ApartmentSaleFinancialRow | undefined> {
  if (!saleUuid.trim()) return undefined;
  return db.apartment_sale_financials.get(saleUuid.trim());
}

export async function apartmentSaleMunicipalityRemainingMapLocal(
  saleUuids: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(saleUuids.map((v) => v.trim()).filter(Boolean))];
  if (!unique.length) return new Map<string, number>();

  const rows = await db.apartment_sale_financials.where("sale_uuid").anyOf(unique).toArray();
  const map = new Map<string, number>();

  for (const row of rows) {
    map.set(row.sale_uuid, toMoney(row.remaining_municipality));
  }

  return map;
}

export async function apartmentSaleFinancialUpsertForSale(
  sale: ApartmentSaleRow,
  options: UpsertOptions = {}
): Promise<ApartmentSaleFinancialRow> {
  const existing = await db.apartment_sale_financials.get(sale.uuid);
  const paidTotal = await getInstallmentsPaidTotalForSale(sale);
  const row = buildFinancialRow(sale, existing, paidTotal);

  await db.apartment_sale_financials.put(row);

  if (options.queue ?? true) {
    await enqueueSync({
      entity: "apartment_sale_financials",
      uuid: row.uuid,
      localKey: row.sale_uuid,
      action: existing ? "update" : "create",
      payload: toApiPayload(row),
      rollbackSnapshot: existing,
    });
  }

  return row;
}

export async function apartmentSaleFinancialRecalculateForSaleUuid(
  saleUuid: string,
  options: UpsertOptions = {}
): Promise<ApartmentSaleFinancialRow | undefined> {
  const sale = await db.apartment_sales.get(saleUuid);
  if (!sale) return undefined;
  return apartmentSaleFinancialUpsertForSale(sale, options);
}

export async function apartmentSaleFinancialUpdateLocal(
  saleUuid: string,
  patch: ApartmentSaleFinancialPatch,
  options: UpsertOptions = {}
): Promise<ApartmentSaleFinancialRow> {
  const normalizedSaleUuid = saleUuid.trim();
  if (!normalizedSaleUuid) throw new Error("Sale uuid is required.");

  const sale = await db.apartment_sales.get(normalizedSaleUuid);
  if (!sale) throw new Error("Apartment sale not found locally.");

  const current = await db.apartment_sale_financials.get(normalizedSaleUuid);
  const paidTotal = await getInstallmentsPaidTotalForSale(sale);

  const seeded = buildFinancialRow(sale, current, paidTotal);
  const patchedSeed: ApartmentSaleFinancialRow = {
    ...seeded,
    accounts_status:
      patch.accounts_status !== undefined ? normalizeAccountsStatus(patch.accounts_status) : seeded.accounts_status,
    delivered_to_municipality:
      patch.delivered_to_municipality !== undefined
        ? toMoney(patch.delivered_to_municipality)
        : seeded.delivered_to_municipality,
    delivered_to_company:
      patch.delivered_to_company !== undefined ? toMoney(patch.delivered_to_company) : seeded.delivered_to_company,
    rahnama_fee_1: patch.rahnama_fee_1 !== undefined ? toMoney(patch.rahnama_fee_1) : seeded.rahnama_fee_1,
    discount_or_contractor_deduction:
      patch.discount_or_contractor_deduction !== undefined
        ? toMoney(patch.discount_or_contractor_deduction)
        : seeded.discount_or_contractor_deduction,
  };

  const recalculated = buildFinancialRow(sale, patchedSeed, paidTotal);
  await db.apartment_sale_financials.put(recalculated);

  if (options.queue ?? true) {
    await enqueueSync({
      entity: "apartment_sale_financials",
      uuid: recalculated.uuid,
      localKey: recalculated.sale_uuid,
      action: current ? "update" : "create",
      payload: toApiPayload(recalculated),
      rollbackSnapshot: current,
    });
  }

  return recalculated;
}

export async function apartmentSaleFinancialDeleteBySaleUuid(
  saleUuid: string,
  options: UpsertOptions = {}
): Promise<void> {
  const normalizedSaleUuid = saleUuid.trim();
  if (!normalizedSaleUuid) return;

  const existing = await db.apartment_sale_financials.get(normalizedSaleUuid);
  if (!existing) return;

  await db.apartment_sale_financials.delete(normalizedSaleUuid);

  if (options.queue ?? true) {
    await enqueueSync({
      entity: "apartment_sale_financials",
      uuid: existing.uuid,
      localKey: existing.sale_uuid,
      action: "delete",
      payload: {},
      rollbackSnapshot: existing,
    });
  }
}
