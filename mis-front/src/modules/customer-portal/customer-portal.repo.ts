import { api } from "@/lib/api";

export type CustomerPortalApartmentBundle = {
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
    remaining_amount?: number | null;
    deed_status?: string | null;
    key_handover_status?: string | null;
  };
  apartment: {
    uuid?: string | null;
    apartment_code?: string | null;
    block_number?: string | null;
    unit_number?: string | null;
    floor_number?: string | null;
    status?: string | null;
    usage_type?: string | null;
    area_sqm?: number | null;
    qr_access_token?: string | null;
  };
  financial: {
    municipality_share_15?: number | null;
    remaining_municipality?: number | null;
    customer_debt?: number | null;
  };
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

export async function loadCustomerPortalBundles(): Promise<CustomerPortalApartmentBundle[]> {
  const res = await api.get("/api/customer-portal/apartments");
  return Array.isArray(res.data?.data) ? (res.data.data as CustomerPortalApartmentBundle[]) : [];
}
