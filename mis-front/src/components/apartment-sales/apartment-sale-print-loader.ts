import { db, type ApartmentRow, type ApartmentSaleRow, type CustomerRow } from "@/db/localDB";

export type ApartmentSalePrintBundle = {
  sale: ApartmentSaleRow | null;
  customer: CustomerRow | null;
  apartment: ApartmentRow | null;
};

export async function loadApartmentSalePrintBundle(uuid: string): Promise<ApartmentSalePrintBundle> {
  const sale = await db.apartment_sales.get(uuid);
  if (!sale) {
    return { sale: null, customer: null, apartment: null };
  }

  const [customer, apartment] = await Promise.all([
    db.customers.filter((item) => Number(item.id) === Number(sale.customer_id)).first(),
    db.apartments.filter((item) => Number(item.id) === Number(sale.apartment_id)).first(),
  ]);

  return {
    sale,
    customer: customer ?? null,
    apartment: apartment ?? null,
  };
}
