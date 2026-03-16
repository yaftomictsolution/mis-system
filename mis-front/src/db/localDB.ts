import Dexie, { Table } from "dexie";

export type ApiCacheRow = {
  key: string;
  data: unknown;
  updated_at: number;
  ttl_seconds: number;
};

export type SyncQueueRow = {
  id?: number;
  idempotency_key: string;
  entity: string;
  uuid: string;
  local_key?: string | null;
  action: "create" | "update" | "delete";
  payload: unknown;
  rollback_snapshot?: unknown;
  created_at: number;
};

export type PendingAttachmentRow = {
  id?: number;
  entity: "customers";
  entity_uuid: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_blob: Blob;
  created_at: number;
};

export type PendingModuleOpRow = {
  id?: number;
  module: "documents" | "crm" | "notifications";
  action: string;
  target_id?: string | null;
  payload: unknown;
  created_at: number;
};

export type SessionRow = {
  id?: number;
  token: string;
  user: unknown;
  cached_at: string;
  expires_at: string;
};

export type RoleRow = {

  uuid: string;
  name: string;
  guard_name?: string | null;
  permissions?: string[];
  updated_at: number;
};

export type CustomerRow = {
  id?: number;
  uuid: string;
  name: string;
  fname?: string | null;
  gname?: string | null;
  phone: string;
  phone1?: string | null;
  email?: string | null;
  status?: string | null;
  address?: string | null;
  customer_image_url?: string | null;
  customer_image_thumb?: string | null;
  updated_at: number;
};

export type UserRow = {

  uuid: string;
  name: string;
  password: string;
  roles?: string[];
  email?: string | null;
  updated_at: number;
};

export type ApartmentRow = {
  id: number;
  uuid: string;  
  apartment_code: string;
  total_price?: number;
  apartment_image_url?: string | null;
  apartment_image_thumb?: string | null;
  usage_type:string;
  block_number: string;
  unit_number: string;
  floor_number: string;
  bedrooms: number;
  halls: number;
  bathrooms: number;
  kitchens: number;
  balcony: boolean;
  area_sqm: number;
  apartment_shape: string;
  corridor: string;
  qr_code: string;
  additional_info: string;
  status:string;
  updated_at: number;       // unix ms for conflict
};


export type ApartmentSaleRow = {
  
  id?: number;
  uuid: string;
  sale_id?: string;
  sale_date:number;
  total_price:number;
  discount:number;
  payment_type:string
  frequency_type?: string;
  interval_count?: number;
  installment_count?: number;
  first_due_date?: number;
  custom_dates?: Array<{
    installment_no: number;
    due_date: number;
    amount: number;
  }>;
  schedule_locked?: boolean;
  schedule_locked_at?: number | null;
  approved_at?: number | null;
  net_price?: number;
  actual_net_revenue?: number;
  deed_status?: "not_issued" | "eligible" | "issued";
  deed_issued_at?: number | null;
  deed_issued_by?: number | null;
  key_handover_status?: "not_handed_over" | "handed_over" | "returned";
  key_handover_at?: number | null;
  key_handover_by?: number | null;
  possession_start_date?: number | null;
  vacated_at?: number | null;
  key_returned_at?: number | null;
  key_returned_by?: number | null;
  termination_reason?: string | null;
  termination_charge?: number;
  refund_amount?: number;
  remaining_debt_after_termination?: number;
  installments_count?: number;
  installments_paid_total?: number;
  has_paid_installments?: boolean;
  has_first_installment_paid?: boolean;
  can_handover_key?: boolean;
  edit_scope?: "full" | "limited" | "none";
  can_update?: boolean;
  can_delete?: boolean;
  customer_id: number;
  apartment_id: number;
  status: string;
  updated_at: number;
};

export type InstallmentRow = {
  id?: number;
  uuid: string;
  sale_id?: string;
  apartment_sale_id: number;
  installment_no: number;
  amount: number;
  due_date: number;
  paid_amount: number;
  paid_date?: number | null;
  remaining_amount?: number;
  status: string;
  sale_uuid?: string;
  apartment_id?: number;
  customer_id?: number;
  sale_status?: string;
  updated_at: number;
  created_at?: number;
};


export type EmployeeRow = {
  id?: number;
  uuid: string;
  first_name: string;
  last_name?: string | null;
  job_title?: string | null;
  salary_type: string;
  base_salary?: number | null;
  address?: string | null;
  email: string;
  phone: number | null;
  status: string;
  hire_date?: number | null;
  updated_at: number;
};

export type ApartmentSaleFinancialRow = {
  id?: number;
  uuid: string;
  sale_uuid: string;
  apartment_sale_id?: number;
  accounts_status: string;
  municipality_share_15: number;
  delivered_to_municipality: number;
  remaining_municipality: number;
  company_share_85: number;
  delivered_to_company: number;
  rahnama_fee_1: number;
  customer_debt: number;
  discount_or_contractor_deduction: number;
  updated_at: number;
};

export type ApartmentRentalRow = {
  id?: number;
  uuid: string;
  rental_id: string;
  apartment_id: number;
  tenant_id: number;
  created_by?: number | null;
  contract_start: number;
  contract_end?: number | null;
  monthly_rent: number;
  advance_months: number;
  advance_required_amount: number;
  advance_paid_amount: number;
  advance_remaining_amount: number;
  total_paid_amount: number;
  advance_status: string;
  next_due_date?: number | null;
  status: string;
  key_handover_status: string;
  key_handover_at?: number | null;
  key_handover_by?: number | null;
  key_returned_at?: number | null;
  key_returned_by?: number | null;
  termination_reason?: string | null;
  terminated_at?: number | null;
  apartment_code?: string | null;
  apartment_unit?: string | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_email?: string | null;
  updated_at: number;
  created_at: number;
};

export type RentalPaymentRow = {
  id?: number;
  uuid: string;
  bill_no?: string | null;
  bill_generated_at?: number | null;
  rental_id: number;
  rental_uuid?: string | null;
  rental_code?: string | null;
  tenant_id?: number | null;
  tenant_name?: string | null;
  tenant_phone?: string | null;
  apartment_id?: number | null;
  apartment_code?: string | null;
  period_month?: string | null;
  due_date?: number | null;
  payment_type: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  paid_date?: number | null;
  status: string;
  notes?: string | null;
  approved_by?: number | null;
  approved_at?: number | null;
  approved_by_name?: string | null;
  updated_at: number;
  created_at: number;
};

export type SystemDocumentLocalRow = {
  id: number;
  module: string;
  module_label: string;
  document_type: string;
  document_type_label: string;
  reference_id: number;
  reference_label: string;
  file_name: string;
  file_path: string;
  file_url: string;
  download_url: string;
  expiry_date?: string | null;
  created_at?: string | null;
  updated_at: number;
  local_only?: boolean;
  local_blob?: Blob | null;
};

export type CrmMessageLocalRow = {
  id: number;
  customer_id: number;
  installment_id: number | null;
  installment_uuid: string | null;
  installment_no: number | null;
  installment_due_date: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  channel: "email" | "sms";
  message_type: string;
  status: "queued" | "sent" | "failed";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: number;
  local_only?: boolean;
};

export type AdminNotificationLocalRow = {
  id: string;
  type: string;
  category: string | null;
  title: string;
  message: string;
  sale_uuid: string | null;
  sale_id: string | null;
  read_at: string | null;
  created_at: string | null;
  data: Record<string, unknown>;
  updated_at: number;
};


export class LocalDB extends Dexie {
  sync_queue!: Table<SyncQueueRow, number>;
  pending_module_ops!: Table<PendingModuleOpRow, number>;
  pending_attachments!: Table<PendingAttachmentRow, number>;
  session!: Table<SessionRow, number>;
  api_cache!: Table<ApiCacheRow, string>;
  customers!: Table<CustomerRow, string>;
  roles!: Table<RoleRow, string>;
  users!: Table<UserRow, string>;
  apartments!: Table<ApartmentRow, string>;
  employees!: Table<EmployeeRow, string>;
  apartment_sales!: Table<ApartmentSaleRow, string>;
  installments!: Table<InstallmentRow, string>;
  apartment_sale_financials!: Table<ApartmentSaleFinancialRow, string>;
  rentals!: Table<ApartmentRentalRow, string>;
  rental_payments!: Table<RentalPaymentRow, string>;
  system_documents!: Table<SystemDocumentLocalRow, number>;
  crm_messages!: Table<CrmMessageLocalRow, number>;
  admin_notifications!: Table<AdminNotificationLocalRow, string>;

  
  constructor() {
    super("mis_local_db");

    this.version(1).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
    });

    this.version(2).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status",
    });

    this.version(3).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
    });

    this.version(4).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
    });

    this.version(5).stores({
      sync_queue: "++id, created_at, entity, uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
    });

    this.version(6).stores({
      sync_queue: "++id, created_at, entity, uuid",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
    });

    this.version(7).stores({
      sync_queue: "++id, created_at, entity, uuid",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type",
    });

    this.version(8).stores({
      sync_queue: "++id, created_at, entity, uuid",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid",
    });

    this.version(9).stores({
      sync_queue: "++id, created_at, entity, uuid",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
    });

    this.version(10).stores({
      sync_queue: "++id, created_at, entity, uuid",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(11).stores({
      sync_queue: "++id, created_at, entity, uuid, local_key",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
      EmployeeRow: "&id, updated_at, last_name, firstname, created_at",
    });

    this.version(12).stores({
      sync_queue: "++id, created_at, entity, uuid, local_key",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      employees: "&uuid, updated_at, last_name, first_name, status, salary_type, email, phone",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    }).upgrade(async (tx) => {
      try {
        const legacyRows = (await tx.table("EmployeeRow").toArray()) as Array<Record<string, unknown>>;
        if (!legacyRows.length) return;

        const migratedRows = legacyRows
          .map((row) => ({
            id: typeof row.id === "number" ? row.id : undefined,
            uuid: String(row.uuid ?? "").trim(),
            first_name: String(row.first_name ?? row.firstname ?? "").trim(),
            last_name: typeof row.last_name === "string" ? row.last_name.trim() || null : null,
            job_title: typeof row.job_title === "string" ? row.job_title.trim() || null : null,
            salary_type: typeof row.salary_type === "string" ? row.salary_type.trim().toLowerCase() : "fixed",
            base_salary: typeof row.base_salary === "number" ? row.base_salary : null,
            address: typeof row.address === "string" ? row.address.trim() || null : null,
            email: typeof row.email === "string" ? row.email.trim() || null : null,
            phone: typeof row.phone === "number" ? row.phone : null,
            status: typeof row.status === "string" ? row.status.trim().toLowerCase() : "active",
            hire_date: typeof row.hire_date === "number" ? row.hire_date : null,
            updated_at: typeof row.updated_at === "number" ? row.updated_at : Date.now(),
          }))
          .filter((row) => row.uuid && row.first_name);

        if (migratedRows.length) {
          await tx.table("employees").bulkPut(migratedRows);
        }
      } catch {
        // Ignore missing legacy employee store during upgrade.
      }
    });

    this.sync_queue = this.table("sync_queue");
    this.pending_module_ops = this.table("pending_module_ops");
    this.pending_attachments = this.table("pending_attachments");
    this.session = this.table("session");
    this.api_cache = this.table("api_cache");
    this.customers = this.table("customers");
    this.roles = this.table("roles");
    this.users = this.table("users");
    this.apartments = this.table("apartments");
    this.employees = this.table("employees");
    this.apartment_sales = this.table("apartment_sales");
    this.installments = this.table("installments");
    this.apartment_sale_financials = this.table("apartment_sale_financials");
    this.rentals = this.table("rentals");
    this.rental_payments = this.table("rental_payments");
    this.system_documents = this.table("system_documents");
    this.crm_messages = this.table("crm_messages");
    this.admin_notifications = this.table("admin_notifications");
  }
}

export const db = new LocalDB();
