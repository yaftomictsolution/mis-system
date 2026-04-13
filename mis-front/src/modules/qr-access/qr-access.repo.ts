import { api } from "@/lib/api";

export type QrAccessScope = "admin" | "sales" | "customer";

export type QrAccessBundle = {
  access_scope: QrAccessScope;
  apartment: {
    uuid?: string | null;
    apartment_code?: string | null;
    block_number?: string | null;
    unit_number?: string | null;
    floor_number?: string | null;
    status?: string | null;
    usage_type?: string | null;
    area_sqm?: number | null;
    bedrooms?: number | null;
    halls?: number | null;
    bathrooms?: number | null;
    kitchens?: number | null;
    north_boundary?: string | null;
    south_boundary?: string | null;
    east_boundary?: string | null;
    west_boundary?: string | null;
    qr_status?: string | null;
    qr_token?: string | null;
  };
  sale: {
    uuid?: string | null;
    sale_id?: string | null;
    sale_date?: string | null;
    status?: string | null;
    payment_type?: string | null;
    total_price?: number | null;
    discount?: number | null;
    net_price?: number | null;
    paid_total?: number | null;
    customer_remaining?: number | null;
    approved_at?: string | null;
    deed_status?: string | null;
    deed_issued_at?: string | null;
    key_handover_status?: string | null;
    key_handover_at?: string | null;
  } | null;
  customer: {
    id?: number | null;
    uuid?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  financial: {
    municipality_share_15?: number | null;
    delivered_to_municipality?: number | null;
    remaining_municipality?: number | null;
    company_share_85?: number | null;
    delivered_to_company?: number | null;
    customer_debt?: number | null;
  } | null;
  installments: Array<{
    uuid?: string | null;
    installment_no?: number | null;
    amount?: number | null;
    paid_amount?: number | null;
    remaining_amount?: number | null;
    status?: string | null;
    due_date?: string | null;
    paid_date?: string | null;
  }>;
};

export async function loadQrAccessBundle(token: string): Promise<QrAccessBundle> {
  const res = await api.get(`/api/qr-access/${encodeURIComponent(token)}`);
  return res.data.data as QrAccessBundle;
}
