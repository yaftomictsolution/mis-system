import {
  db,
  type ApartmentRow,
  type ApartmentSaleFinancialRow,
  type ApartmentSaleRow,
  type CustomerRow,
  type InstallmentRow,
  type SystemDocumentLocalRow,
} from "@/db/localDB";
import { createImageThumbFromBlob, isImageFile } from "@/lib/imageThumb";

export type ApartmentSalePrintBundle = {
  sale: ApartmentSaleRow | null;
  customer: CustomerRow | null;
  apartment: ApartmentRow | null;
  installments: InstallmentRow[];
  financial: ApartmentSaleFinancialRow | null;
  customerDocuments: SystemDocumentLocalRow[];
};

const DEED_DOCUMENT_TYPES = new Set(["customer_image", "customer_representative_image"]);
const DEED_PREVIEW_SIZE = 640;

async function sanitizeDeedDocument(row: SystemDocumentLocalRow): Promise<SystemDocumentLocalRow> {
  const fileUrl = String(row.file_url ?? "").trim();
  const downloadUrl = String(row.download_url ?? "").trim();
  let previewUrl = fileUrl || downloadUrl;

  if (!previewUrl && row.local_blob && isImageFile(row.local_blob)) {
    previewUrl = (await createImageThumbFromBlob(row.local_blob, DEED_PREVIEW_SIZE)) ?? "";
  }

  return {
    ...row,
    file_url: previewUrl || row.file_url,
    download_url: previewUrl || row.download_url,
    local_blob: null,
  };
}

export async function loadApartmentSalePrintBundle(uuid: string): Promise<ApartmentSalePrintBundle> {
  const sale = await db.apartment_sales.get(uuid);
  if (!sale) {
    return { sale: null, customer: null, apartment: null, installments: [], financial: null, customerDocuments: [] };
  }

  const [customer, apartment, installmentsBySaleUuid, installmentsBySaleId, financial] = await Promise.all([
    db.customers.filter((item) => Number(item.id) === Number(sale.customer_id)).first(),
    db.apartments.filter((item) => Number(item.id) === Number(sale.apartment_id)).first(),
    db.installments.where("sale_uuid").equals(sale.uuid).toArray(),
    typeof sale.id === "number" && sale.id > 0
      ? db.installments.where("apartment_sale_id").equals(Number(sale.id)).toArray()
      : Promise.resolve([] as InstallmentRow[]),
    db.apartment_sale_financials.get(sale.uuid),
  ]);

  const installments = [...installmentsBySaleUuid, ...installmentsBySaleId]
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.uuid === row.uuid) === index)
    .sort((a, b) => {
      if (a.installment_no !== b.installment_no) return a.installment_no - b.installment_no;
      return Number(a.due_date ?? 0) - Number(b.due_date ?? 0);
    });

  const customerDocumentsById =
    typeof customer?.id === "number" && customer.id > 0
      ? (await db.system_documents.where("reference_id").equals(customer.id).toArray()).filter((row) => row.module === "customer")
      : [];
  const customerDocumentsByUuid = customer?.uuid
    ? (await db.system_documents.where("reference_uuid").equals(customer.uuid).toArray()).filter((row) => row.module === "customer")
    : [];

  const customerDocuments = [...customerDocumentsById, ...customerDocumentsByUuid]
    .filter((row, index, rows) => row.module === "customer" && rows.findIndex((candidate) => candidate.id === row.id) === index)
    .sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0));

  return {
    sale,
    customer: customer ?? null,
    apartment: apartment ?? null,
    installments,
    financial: financial ?? null,
    customerDocuments,
  };
}

export async function loadApartmentSaleDeedPrintBundle(
  uuid: string,
): Promise<Omit<ApartmentSalePrintBundle, "installments">> {
  const sale = await db.apartment_sales.get(uuid);
  if (!sale) {
    return { sale: null, customer: null, apartment: null, financial: null, customerDocuments: [] };
  }

  const [customer, apartment, financial] = await Promise.all([
    db.customers.filter((item) => Number(item.id) === Number(sale.customer_id)).first(),
    db.apartments.filter((item) => Number(item.id) === Number(sale.apartment_id)).first(),
    db.apartment_sale_financials.get(sale.uuid),
  ]);

  const customerDocumentsById =
    typeof customer?.id === "number" && customer.id > 0
      ? (await db.system_documents.where("reference_id").equals(customer.id).toArray()).filter(
          (row) => row.module === "customer" && DEED_DOCUMENT_TYPES.has(String(row.document_type ?? "").trim().toLowerCase()),
        )
      : [];
  const customerDocumentsByUuid = customer?.uuid
    ? (await db.system_documents.where("reference_uuid").equals(customer.uuid).toArray()).filter(
        (row) => row.module === "customer" && DEED_DOCUMENT_TYPES.has(String(row.document_type ?? "").trim().toLowerCase()),
      )
    : [];

  const customerDocuments = [...customerDocumentsById, ...customerDocumentsByUuid]
    .filter(
      (row, index, rows) =>
        row.module === "customer" &&
        rows.findIndex((candidate) => candidate.id === row.id) === index,
    )
    .sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0));

  const hydratedCustomerDocuments = await Promise.all(customerDocuments.map(sanitizeDeedDocument));

  return {
    sale,
    customer: customer ?? null,
    apartment: apartment ?? null,
    financial: financial ?? null,
    customerDocuments: hydratedCustomerDocuments,
  };
}
