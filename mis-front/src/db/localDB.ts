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
  job_title?: string | null;
  tazkira_number?: string | null;
  phone: string;
  phone1?: string | null;
  email?: string | null;
  status?: string | null;
  address?: string | null;
  current_area?: string | null;
  current_district?: string | null;
  current_province?: string | null;
  original_area?: string | null;
  original_district?: string | null;
  original_province?: string | null;
  representative_name?: string | null;
  representative_fname?: string | null;
  representative_gname?: string | null;
  representative_job_title?: string | null;
  representative_relationship?: string | null;
  representative_phone?: string | null;
  representative_tazkira_number?: string | null;
  representative_current_area?: string | null;
  representative_current_district?: string | null;
  representative_current_province?: string | null;
  representative_original_area?: string | null;
  representative_original_district?: string | null;
  representative_original_province?: string | null;
  customer_image_url?: string | null;
  customer_image_thumb?: string | null;
  customer_representative_image_url?: string | null;
  updated_at: number;
};

export type UserRow = {

  uuid: string;
  name: string;
  password: string;
  roles?: string[];
  email?: string | null;
  customer_id?: number | null;
  customer_uuid?: string | null;
  customer_name?: string | null;
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
  north_boundary?: string | null;
  south_boundary?: string | null;
  east_boundary?: string | null;
  west_boundary?: string | null;
  qr_code: string;
  qr_access_token?: string | null;
  qr_access_status?: string | null;
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
  salary_type?: string;
  base_salary?: number | null;
  salary_currency_code?: string | null;
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
  approved_by?: number | null;
  approved_at?: number | null;
  approved_by_name?: string | null;
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

export type SalaryAdvanceRow = {
  id?: number;
  uuid: string;
  employee_id: number;
  employee_uuid?: string | null;
  employee_name?: string | null;
  amount: number;
  currency_code?: string | null;
  deducted_amount?: number;
  remaining_amount?: number;
  user_id?: number | null;
  user_name?: string | null;
  reason?: string | null;
  status: string;
  updated_at: number;
  created_at?: number;
};

export type SalaryAdvanceDeductionRow = {
  uuid: string;
  salary_payment_uuid: string;
  salary_advance_uuid: string;
  amount: number;
  updated_at: number;
  created_at?: number;
};

export type SalaryPaymentRow = {
  id?: number;
  uuid: string;
  employee_id: number;
  employee_uuid?: string | null;
  employee_name?: string | null;
  period: string;
  gross_salary: number;
  gross_salary_usd?: number | null;
  salary_currency_code?: string | null;
  salary_exchange_rate_snapshot?: number | null;
  advance_deducted: number;
  advance_deducted_usd?: number | null;
  tax_percentage?: number;
  tax_deducted?: number;
  tax_deducted_usd?: number | null;
  other_deductions?: number;
  other_deductions_usd?: number | null;
  net_salary: number;
  net_salary_usd?: number | null;
  status: string;
  account_id?: number | null;
  account_uuid?: string | null;
  account_name?: string | null;
  account_currency?: string | null;
  account_transaction_uuid?: string | null;
  payment_currency_code?: string | null;
  exchange_rate_snapshot?: number | null;
  net_salary_account_amount?: number | null;
  user_id?: number | null;
  user_name?: string | null;
  paid_at?: number | null;
  updated_at: number;
  created_at?: number;
};

export type AccountRow = {
  id?: number;
  uuid: string;
  name: string;
  account_type: string;
  bank_name?: string | null;
  account_number?: string | null;
  currency: string;
  opening_balance: number;
  current_balance: number;
  status: string;
  notes?: string | null;
  can_delete?: boolean;
  delete_blocked_reason?: string | null;
  updated_at: number;
  created_at?: number;
};

export type AccountTransactionRow = {
  id?: number;
  uuid: string;
  account_id: number;
  account_uuid?: string | null;
  account_name?: string | null;
  account_currency?: string | null;
  direction: string;
  amount: number;
  currency_code?: string | null;
  exchange_rate_snapshot?: number | null;
  amount_usd?: number | null;
  module?: string | null;
  reference_type?: string | null;
  reference_uuid?: string | null;
  description?: string | null;
  payment_method?: string | null;
  transaction_date?: number | null;
  created_by_user_id?: number | null;
  created_by_user_name?: string | null;
  status: string;
  reversal_of_id?: number | null;
  metadata?: Record<string, unknown> | null;
  updated_at: number;
  created_at?: number;
};

export type ExchangeRateRow = {
  id?: number;
  uuid: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  source?: string | null;
  effective_date?: number | null;
  approved_by_user_id?: number | null;
  approved_by_user_name?: string | null;
  is_active: boolean;
  notes?: string | null;
  can_delete?: boolean;
  delete_blocked_reason?: string | null;
  updated_at: number;
  created_at?: number;
};

export type EmployeeSalaryHistoryRow = {
  id?: number;
  uuid: string;
  employee_id: number;
  employee_uuid?: string | null;
  employee_name?: string | null;
  previous_salary?: number | null;
  previous_salary_currency_code?: string | null;
  new_salary?: number | null;
  new_salary_currency_code?: string | null;
  effective_from?: number | null;
  reason?: string | null;
  changed_by?: number | null;
  changed_by_name?: string | null;
  source?: string | null;
  updated_at: number;
  created_at?: number;
};

export type VendorRow = {
  id?: number;
  uuid: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  updated_at: number;
  created_at?: number;
};

export type WarehouseRow = {
  id?: number;
  uuid: string;
  name: string;
  location?: string | null;
  status: string;
  updated_at: number;
  created_at?: number;
};

export type MaterialRow = {
  id?: number;
  uuid: string;
  name: string;
  material_type?: string | null;
  unit: string;
  quantity: number;
  reference_unit_price?: number | null;
  has_warehouse_stock?: boolean;
  legacy_quantity?: number;
  supplier_id?: number | null;
  supplier_uuid?: string | null;
  supplier_name?: string | null;
  batch_no?: string | null;
  serial_no?: string | null;
  expiry_date?: number | null;
  min_stock_level: number;
  status: string;
  notes?: string | null;
  updated_at: number;
  created_at?: number;
};

export type CompanyAssetRow = {
  id?: number;
  uuid: string;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  quantity: number;
  allocated_quantity?: number;
  maintenance_quantity?: number;
  damaged_quantity?: number;
  retired_quantity?: number;
  supplier_id?: number | null;
  supplier_uuid?: string | null;
  supplier_name?: string | null;
  serial_no?: string | null;
  status: string;
  current_employee_id?: number | null;
  current_employee_uuid?: string | null;
  current_employee_name?: string | null;
  current_project_id?: number | null;
  current_project_uuid?: string | null;
  current_project_name?: string | null;
  current_warehouse_id?: number | null;
  current_warehouse_uuid?: string | null;
  current_warehouse_name?: string | null;
  notes?: string | null;
  updated_at: number;
  created_at?: number;
};

export type ProjectRow = {
  id?: number;
  uuid: string;
  project_manager_user_id?: number | null;
  project_manager_name?: string | null;
  name: string;
  location?: string | null;
  status: string;
  start_date?: number | null;
  end_date?: number | null;
  assigned_employee_ids?: number[];
  assigned_employees?: Array<{
    id?: number | null;
    uuid?: string | null;
    name?: string | null;
    job_title?: string | null;
    status?: string | null;
  }>;
  updated_at: number;
  created_at?: number;
};

export type MaterialRequestItemRow = {
  id?: number;
  uuid: string;
  material_id: number;
  material_uuid?: string | null;
  material_name?: string | null;
  unit: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_issued: number;
  quantity_returned?: number;
  notes?: string | null;
};

export type MaterialRequestRow = {
  id?: number;
  uuid: string;
  request_no: string;
  project_id?: number | null;
  project_uuid?: string | null;
  project_name?: string | null;
  warehouse_id: number;
  warehouse_uuid?: string | null;
  warehouse_name?: string | null;
  requested_by_user_id?: number | null;
  requested_by_user_name?: string | null;
  requested_by_name?: string | null;
  requested_by_employee_id?: number | null;
  requested_by_employee_uuid?: string | null;
  requested_by_employee_name?: string | null;
  status: string;
  approved_by_user_id?: number | null;
  approved_by_user_name?: string | null;
  approved_at?: number | null;
  rejected_by_user_id?: number | null;
  rejected_by_user_name?: string | null;
  rejected_at?: number | null;
  rejection_reason?: string | null;
  issued_by_user_id?: number | null;
  issued_by_user_name?: string | null;
  issued_at?: number | null;
  issue_receipt_no?: string | null;
  requested_at?: number | null;
  notes?: string | null;
  can_edit?: boolean;
  can_delete?: boolean;
  items?: MaterialRequestItemRow[];
  updated_at: number;
  created_at?: number;
};

export type PurchaseRequestItemRow = {
  id?: number;
  uuid: string;
  item_kind: "material" | "asset";
  material_id?: number | null;
  material_uuid?: string | null;
  material_name?: string | null;
  company_asset_id?: number | null;
  company_asset_uuid?: string | null;
  company_asset_code?: string | null;
  asset_name?: string | null;
  asset_type?: string | null;
  asset_code_prefix?: string | null;
  unit: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_received: number;
  estimated_unit_price?: number | null;
  estimated_line_total?: number | null;
  actual_unit_price?: number | null;
  actual_line_total?: number | null;
  notes?: string | null;
};

export type PurchaseRequestRow = {
  id?: number;
  uuid: string;
  request_no: string;
  request_type: "material" | "asset";
  source_material_request_id?: number | null;
  source_material_request_uuid?: string | null;
  source_material_request_no?: string | null;
  project_id?: number | null;
  project_uuid?: string | null;
  project_name?: string | null;
  warehouse_id: number;
  warehouse_uuid?: string | null;
  warehouse_name?: string | null;
  vendor_id?: number | null;
  vendor_uuid?: string | null;
  vendor_name?: string | null;
  requested_by_user_id?: number | null;
  requested_by_user_name?: string | null;
  requested_by_name?: string | null;
  requested_by_employee_id?: number | null;
  requested_by_employee_uuid?: string | null;
  requested_by_employee_name?: string | null;
  status: string;
  approved_by_user_id?: number | null;
  approved_by_user_name?: string | null;
  approved_at?: number | null;
  rejected_by_user_id?: number | null;
  rejected_by_user_name?: string | null;
  rejected_at?: number | null;
  rejection_reason?: string | null;
  payment_processed_by_user_id?: number | null;
  payment_processed_by_user_name?: string | null;
  payment_processed_at?: number | null;
  payment_account_id?: number | null;
  payment_account_uuid?: string | null;
  payment_account_name?: string | null;
  payment_account_currency?: string | null;
  payment_account_transaction_id?: number | null;
  payment_amount?: number | null;
  payment_currency_code?: string | null;
  payment_exchange_rate_snapshot?: number | null;
  payment_account_amount?: number | null;
  payment_slip_no?: string | null;
  payment_notes?: string | null;
  received_by_user_id?: number | null;
  received_by_user_name?: string | null;
  received_at?: number | null;
  purchase_receipt_no?: string | null;
  requested_at?: number | null;
  notes?: string | null;
  estimated_grand_total?: number | null;
  approved_grand_total?: number | null;
  received_grand_total?: number | null;
  can_edit?: boolean;
  can_delete?: boolean;
  items?: PurchaseRequestItemRow[];
  updated_at: number;
  created_at?: number;
};

export type AssetRequestRow = {
  id?: number;
  uuid: string;
  request_no: string;
  project_id?: number | null;
  project_uuid?: string | null;
  project_name?: string | null;
  requested_by_user_id?: number | null;
  requested_by_user_name?: string | null;
  requested_by_name?: string | null;
  requested_by_employee_id?: number | null;
  requested_by_employee_uuid?: string | null;
  requested_by_employee_name?: string | null;
  requested_asset_id?: number | null;
  requested_asset_uuid?: string | null;
  requested_asset_code?: string | null;
  requested_asset_name?: string | null;
  asset_type?: string | null;
  quantity_requested?: number;
  quantity_allocated?: number;
  status: string;
  reason?: string | null;
  approved_by_user_id?: number | null;
  approved_by_user_name?: string | null;
  approved_at?: number | null;
  rejected_by_user_id?: number | null;
  rejected_by_user_name?: string | null;
  rejected_at?: number | null;
  rejection_reason?: string | null;
  allocated_by_user_id?: number | null;
  allocated_by_user_name?: string | null;
  allocated_at?: number | null;
  allocation_receipt_no?: string | null;
  requested_at?: number | null;
  notes?: string | null;
  can_edit?: boolean;
  can_delete?: boolean;
  assignment_uuid?: string | null;
  assignment_status?: string | null;
  assigned_date?: number | null;
  return_date?: number | null;
  assigned_quantity?: number | null;
  assigned_asset_id?: number | null;
  assigned_asset_uuid?: string | null;
  assigned_asset_code?: string | null;
  assigned_asset_name?: string | null;
  updated_at: number;
  created_at?: number;
};

export type StockMovementRow = {
  id?: number;
  uuid: string;
  material_id: number;
  material_uuid?: string | null;
  material_name?: string | null;
  material_unit?: string | null;
  warehouse_id: number;
  warehouse_uuid?: string | null;
  warehouse_name?: string | null;
  project_id?: number | null;
  project_uuid?: string | null;
  project_name?: string | null;
  employee_id?: number | null;
  employee_uuid?: string | null;
  employee_name?: string | null;
  material_request_item_id?: number | null;
  material_request_item_uuid?: string | null;
  material_request_uuid?: string | null;
  material_request_no?: string | null;
  quantity: number;
  movement_type: string;
  reference_type?: string | null;
  reference_no?: string | null;
  approved_by_user_id?: number | null;
  approved_by_user_name?: string | null;
  issued_by_user_id?: number | null;
  issued_by_user_name?: string | null;
  movement_date?: number | null;
  notes?: string | null;
  updated_at: number;
  created_at?: number;
};

export type WarehouseMaterialStockRow = {
  id?: number;
  uuid: string;
  warehouse_id: number;
  warehouse_uuid?: string | null;
  warehouse_name?: string | null;
  material_id: number;
  material_uuid?: string | null;
  material_name?: string | null;
  material_unit?: string | null;
  material_status?: string | null;
  min_stock_level: number;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  updated_at: number;
  created_at?: number;
};

export type ProjectMaterialStockRow = {
  id?: number;
  uuid: string;
  project_id: number;
  project_uuid?: string | null;
  project_name?: string | null;
  material_id: number;
  material_uuid?: string | null;
  material_name?: string | null;
  material_unit?: string | null;
  material_status?: string | null;
  qty_issued: number;
  qty_consumed: number;
  qty_returned: number;
  qty_on_site: number;
  updated_at: number;
  created_at?: number;
};

export type SystemDocumentLocalRow = {
  id: number;
  module: string;
  module_label: string;
  document_type: string;
  document_type_label: string;
  reference_id: number;
  reference_uuid?: string | null;
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
  awaiting_reference_sync?: boolean;
};

export type DocumentTypeLocalRow = {
  uuid: string;
  code: string;
  module: string;
  label: string;
  is_active: boolean;
  can_delete?: boolean;
  delete_blocked_reason?: string | null;
  updated_at: number;
  created_at?: string | null;
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
  salary_advances!: Table<SalaryAdvanceRow, string>;
  salary_advance_deductions!: Table<SalaryAdvanceDeductionRow, string>;
  salary_payments!: Table<SalaryPaymentRow, string>;
  accounts!: Table<AccountRow, string>;
  account_transactions!: Table<AccountTransactionRow, string>;
  exchange_rates!: Table<ExchangeRateRow, string>;
  employee_salary_histories!: Table<EmployeeSalaryHistoryRow, string>;
  vendors!: Table<VendorRow, string>;
  warehouses!: Table<WarehouseRow, string>;
  materials!: Table<MaterialRow, string>;
  company_assets!: Table<CompanyAssetRow, string>;
  projects!: Table<ProjectRow, string>;
  material_requests!: Table<MaterialRequestRow, string>;
  purchase_requests!: Table<PurchaseRequestRow, string>;
  asset_requests!: Table<AssetRequestRow, string>;
  stock_movements!: Table<StockMovementRow, string>;
  warehouse_material_stocks!: Table<WarehouseMaterialStockRow, string>;
  project_material_stocks!: Table<ProjectMaterialStockRow, string>;
  system_documents!: Table<SystemDocumentLocalRow, number>;
  document_types!: Table<DocumentTypeLocalRow, string>;
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
    });

    this.version(13).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(14).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(15).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(16).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(17).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(18).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(19).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(20).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(21).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, account_id, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(22).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, remaining_amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, account_id, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(23).stores({
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
      salary_advances: "&uuid, updated_at, employee_id, status, amount, remaining_amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, paid_at, account_id, payment_currency_code, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status, currency_code",
      exchange_rates: "&uuid, updated_at, effective_date, is_active, base_currency, quote_currency",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(24).stores({
      sync_queue: "++id, created_at, entity, uuid, local_key",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      employees: "&uuid, updated_at, last_name, first_name, status, salary_type, salary_currency_code, email, phone",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      salary_advances: "&uuid, updated_at, employee_id, status, currency_code, amount, remaining_amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, salary_currency_code, paid_at, account_id, payment_currency_code, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status, currency_code",
      exchange_rates: "&uuid, updated_at, effective_date, is_active, base_currency, quote_currency",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      document_types: "&uuid, updated_at, module, code, label, is_active",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(25).stores({
      sync_queue: "++id, created_at, entity, uuid, local_key",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      employees: "&uuid, updated_at, last_name, first_name, status, salary_type, salary_currency_code, email, phone",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      salary_advances: "&uuid, updated_at, employee_id, status, currency_code, amount, remaining_amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, salary_currency_code, paid_at, account_id, payment_currency_code, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status, currency_code",
      exchange_rates: "&uuid, updated_at, effective_date, is_active, base_currency, quote_currency",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, document_type, created_at",
      document_types: "&uuid, updated_at, module, code, label, is_active",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(26).stores({
      sync_queue: "++id, created_at, entity, uuid, local_key",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      employees: "&uuid, updated_at, last_name, first_name, status, salary_type, salary_currency_code, email, phone",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      salary_advances: "&uuid, updated_at, employee_id, status, currency_code, amount, remaining_amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, salary_currency_code, paid_at, account_id, payment_currency_code, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status, currency_code",
      exchange_rates: "&uuid, updated_at, effective_date, is_active, base_currency, quote_currency",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_employee_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_employee_id, project_id, requested_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, reference_uuid, document_type, created_at",
      document_types: "&uuid, updated_at, module, code, label, is_active",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
    });

    this.version(27).stores({
      sync_queue: "++id, created_at, entity, uuid, local_key",
      pending_module_ops: "++id, created_at, module, action, target_id",
      pending_attachments: "++id, created_at, entity, entity_uuid",
      session: "++id, expires_at",
      api_cache: "&key, updated_at",
      customers: "&uuid, updated_at, phone, name",
      roles: "&uuid, updated_at, name",
      users: "&uuid, updated_at, name,phone",
      apartments: "&uuid, updated_at, apartment_code, usage_type",
      employees: "&uuid, updated_at, last_name, first_name, status, salary_type, salary_currency_code, email, phone",
      apartment_sales: "&uuid, updated_at, sale_date, status, apartment_id, customer_id",
      installments: "&uuid, updated_at, due_date, status, apartment_sale_id, sale_uuid",
      apartment_sale_financials: "&sale_uuid, updated_at, apartment_sale_id",
      rentals: "&uuid, updated_at, status, apartment_id, tenant_id, rental_id, next_due_date",
      rental_payments: "&uuid, updated_at, rental_id, due_date, status, payment_type, tenant_id, rental_uuid, bill_no, approved_at",
      salary_advances: "&uuid, updated_at, employee_id, status, currency_code, amount, remaining_amount, created_at",
      salary_advance_deductions: "&uuid, salary_payment_uuid, salary_advance_uuid, updated_at, created_at",
      salary_payments: "&uuid, updated_at, employee_id, status, period, salary_currency_code, paid_at, account_id, payment_currency_code, created_at",
      accounts: "&uuid, updated_at, name, account_type, currency, status",
      account_transactions: "&uuid, updated_at, account_id, transaction_date, module, reference_type, status, currency_code",
      exchange_rates: "&uuid, updated_at, effective_date, is_active, base_currency, quote_currency",
      employee_salary_histories: "&uuid, updated_at, employee_id, effective_from, source, created_at",
      vendors: "&uuid, updated_at, name, email, status",
      warehouses: "&uuid, updated_at, name, location, status",
      materials: "&uuid, updated_at, name, material_type, status, supplier_id, quantity, reference_unit_price, min_stock_level, expiry_date",
      company_assets: "&uuid, updated_at, asset_code, asset_name, asset_type, status, supplier_id, current_employee_id, current_project_id, current_warehouse_id",
      projects: "&uuid, updated_at, name, status, start_date, end_date, project_manager_user_id",
      material_requests: "&uuid, updated_at, request_no, status, warehouse_id, requested_by_user_id, project_id, requested_at",
      purchase_requests: "&uuid, updated_at, request_no, request_type, status, warehouse_id, vendor_id, requested_by_user_id, project_id, requested_at, payment_processed_at, received_at",
      asset_requests: "&uuid, updated_at, request_no, status, requested_by_employee_id, requested_asset_id, project_id, requested_at, assigned_date",
      stock_movements: "&uuid, updated_at, movement_date, material_id, warehouse_id, project_id, movement_type, reference_type",
      warehouse_material_stocks: "&uuid, updated_at, warehouse_id, material_id, warehouse_name, material_name",
      project_material_stocks: "&uuid, updated_at, project_id, material_id, project_name, material_name",
      system_documents: "id, updated_at, module, reference_id, reference_uuid, document_type, created_at",
      document_types: "&uuid, updated_at, module, code, label, is_active",
      crm_messages: "id, updated_at, customer_id, status, channel, created_at",
      admin_notifications: "&id, updated_at, read_at, category, created_at",
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
    this.salary_advances = this.table("salary_advances");
    this.salary_advance_deductions = this.table("salary_advance_deductions");
    this.salary_payments = this.table("salary_payments");
    this.accounts = this.table("accounts");
    this.account_transactions = this.table("account_transactions");
    this.exchange_rates = this.table("exchange_rates");
    this.employee_salary_histories = this.table("employee_salary_histories");
    this.vendors = this.table("vendors");
    this.warehouses = this.table("warehouses");
    this.materials = this.table("materials");
    this.company_assets = this.table("company_assets");
    this.projects = this.table("projects");
    this.material_requests = this.table("material_requests");
    this.purchase_requests = this.table("purchase_requests");
    this.asset_requests = this.table("asset_requests");
    this.stock_movements = this.table("stock_movements");
    this.warehouse_material_stocks = this.table("warehouse_material_stocks");
    this.project_material_stocks = this.table("project_material_stocks");
    this.system_documents = this.table("system_documents");
    this.document_types = this.table("document_types");
    this.crm_messages = this.table("crm_messages");
    this.admin_notifications = this.table("admin_notifications");
  }
}

export const db = new LocalDB();
