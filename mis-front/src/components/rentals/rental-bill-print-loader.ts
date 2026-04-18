"use client";

import { db, type ApartmentRow, type ApartmentRentalRow, type CustomerRow, type RentalPaymentRow } from "@/db/localDB";

export type RentalBillPrintBundle = {
  rental: ApartmentRentalRow | null;
  payment: RentalPaymentRow | null;
  apartment: ApartmentRow | null;
  customer: CustomerRow | null;
};

async function findApartment(id?: number | null): Promise<ApartmentRow | null> {
  if (!id) return null;
  const row = await db.apartments.filter((item) => Number(item.id) === Number(id)).first();
  return row ?? null;
}

async function findCustomer(id?: number | null): Promise<CustomerRow | null> {
  if (!id) return null;
  const row = await db.customers.filter((item) => Number(item.id) === Number(id)).first();
  return row ?? null;
}

export async function loadRentalBillPrintBundle(
  rentalUuid: string,
  paymentUuid: string
): Promise<RentalBillPrintBundle> {
  const [directRental, directPayment] = await Promise.all([
    rentalUuid ? db.rentals.get(rentalUuid) : Promise.resolve(undefined),
    paymentUuid ? db.rental_payments.get(paymentUuid) : Promise.resolve(undefined),
  ]);

  const payment = directPayment ?? null;
  const rental =
    directRental ??
    (payment?.rental_uuid ? await db.rentals.get(String(payment.rental_uuid)) : undefined) ??
    null;

  if (!payment || !rental) {
    return {
      rental,
      payment,
      apartment: null,
      customer: null,
    };
  }

  const [apartment, customer] = await Promise.all([
    findApartment(rental.apartment_id),
    findCustomer(rental.tenant_id),
  ]);

  return {
    rental,
    payment,
    apartment,
    customer,
  };
}
