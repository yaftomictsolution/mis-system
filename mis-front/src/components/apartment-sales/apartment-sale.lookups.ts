import type { ApartmentRow, CustomerRow } from "@/db/localDB";
import { LOOKUP_PAGE_SIZE } from "@/components/apartment-sales/apartment-sale.page-helpers";
import { apartmentsListLocal } from "@/modules/apartments/apartments.repo";
import { customersListLocal } from "@/modules/customers/customers.repo";

/**
 * Loads all customers from local paginated storage for sale forms.
 */
export async function loadAllSaleCustomers(): Promise<CustomerRow[]> {
  let page = 1;
  const all: CustomerRow[] = [];
  while (true) {
    const local = await customersListLocal({ page, pageSize: LOOKUP_PAGE_SIZE });
    all.push(...local.items);
    if (!local.hasMore) break;
    page += 1;
  }
  return all;
}

/**
 * Loads all apartments from local paginated storage for sale forms.
 */
export async function loadAllSaleApartments(): Promise<ApartmentRow[]> {
  let page = 1;
  const all: ApartmentRow[] = [];
  while (true) {
    const local = await apartmentsListLocal({ page, pageSize: LOOKUP_PAGE_SIZE });
    all.push(...local.items);
    if (!local.hasMore) break;
    page += 1;
  }
  return all;
}

