<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Apartment;
use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\ExchangeRate;
use App\Models\Installment;
use App\Models\InstallmentPayment;
use App\Models\Roles;
use App\Models\SalaryAdvance;
use App\Models\SalaryPayment;
use App\Models\SalaryAdvanceDeduction;
use App\Models\Vendor;
use App\Models\Warehouse;
use App\Models\Material;
use App\Models\CompanyAsset;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestItem;
use App\Models\AssetRequest;
use App\Models\AssetAssignment;
use App\Models\Project;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\AccountLedgerService;
use App\Services\ApartmentSaleFinancialService;
use App\Services\EmployeeSalaryHistoryService;
use App\Services\ExchangeRateService;
use App\Services\MaterialStockService;
use App\Services\MunicipalityWorkflowService;
use App\Services\SaleApprovalAlertService;
use App\Services\SaleCreatedFinanceAlertService;
use App\Services\SalaryAdvanceBalanceService;
use App\Support\ApartmentSaleCustomerAmounts;
use App\Models\SyncInbox;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SyncController extends Controller
{
    public function __construct(
        private readonly ApartmentSaleFinancialService $financials,
        private readonly MunicipalityWorkflowService $workflow,
        private readonly SaleApprovalAlertService $saleApprovalAlerts,
        private readonly SaleCreatedFinanceAlertService $saleCreatedAlerts,
        private readonly MaterialStockService $materialStocks,
        private readonly EmployeeSalaryHistoryService $salaryHistoryService,
        private readonly ExchangeRateService $exchangeRateService,
        private readonly AccountLedgerService $accountLedgerService,
        private readonly SalaryAdvanceBalanceService $salaryAdvanceBalanceService,
    )
    {
    }

    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['required', 'string'],
            'entity' => ['required', Rule::in(['customers', 'roles', 'users', 'apartments', 'apartment_sales', 'installments', 'apartment_sale_financials', 'employees', 'salary_advances', 'salary_payments', 'accounts', 'exchange_rates', 'projects', 'vendors', 'warehouses', 'materials', 'company_assets', 'material_requests', 'purchase_requests', 'asset_requests'])],
            'uuid' => ['required', 'uuid'],
            'action' => ['required', 'in:create,update,delete'],
            'payload' => ['nullable', 'array'],
        ]);

        $this->validateEntityPayload(
            $request,
            $validated['entity'],
            $validated['action'],
            $validated['uuid'],
        );

        $exists = SyncInbox::query()
            ->where('idempotency_key', $validated['idempotency_key'])
            ->first();

        if ($exists) {
            return response()->json(['message' => 'Already processed'], 200);
        }

        $this->applyEntityOperation(
            $validated['entity'],
            $validated['uuid'],
            $validated['action'],
            $validated['payload'] ?? [],
            (int) (optional($request->user())->id ?? 0),
        );

        try {
            SyncInbox::query()->create([
                'user_id' => optional($request->user())->id,
                'idempotency_key' => $validated['idempotency_key'],
                'entity' => $validated['entity'],
                'entity_uuid' => $validated['uuid'],
                'action' => $validated['action'],
                'processed_at' => now(),
            ]);
        } catch (QueryException $exception) {
            if ($exception->getCode() !== '23000') {
                throw $exception;
            }

            return response()->json(['message' => 'Already processed'], 200);
        }

        return response()->json([
            'message' => 'Accepted',
            'server_time' => now()->toISOString(),
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $request->validate([
            'since' => ['nullable', 'date'],
        ]);

        return response()->json([
            'message' => 'Pull endpoint skeleton',
            'since' => $request->since,
            'data' => [],
        ]);
    }

    private function validateEntityPayload(Request $request, string $entity, string $action, string $uuid): void
    {
        if ($action === 'delete') {
            return;
        }

        if ($entity === 'users') {
            $existing = User::withTrashed()->where('uuid', $uuid)->first();
            $role = trim((string) ($request->input('payload.role') ?? ''));
            $customerId = (int) ($request->input('payload.customer_id') ?? 0);

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('users', 'email')
                        ->whereNull('deleted_at')
                        ->ignore($existing?->id),
                ],
                'payload.password' => [($action === 'create' ? 'required' : 'nullable'), 'string', 'max:255'],
                'payload.role' => ['nullable', 'string', 'max:255'],
                'payload.customer_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                    Rule::exists('customers', 'id'),
                    Rule::unique('users', 'customer_id')
                        ->whereNull('deleted_at')
                        ->ignore($existing?->id),
                ],
            ]);

            if ($role === 'Customer' && $customerId <= 0) {
                abort(422, 'Linked customer is required for Customer portal accounts.');
            }

            if ($role !== '' && $role !== 'Customer' && $customerId > 0) {
                abort(422, 'Only the Customer role can be linked to a customer account.');
            }

            return;
        }

        if ($entity === 'employees') {
            $existing = Employee::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.first_name' => ['required', 'string', 'max:255'],
                'payload.last_name' => ['nullable', 'string', 'max:255'],
                'payload.job_title' => ['nullable', 'string', 'max:255'],
                'payload.salary_type' => ['required', 'string', 'max:255'],
                'payload.base_salary' => ['nullable', 'numeric', 'min:0'],
                'payload.salary_currency_code' => ['nullable', Rule::in(['USD', 'AFN'])],
                'payload.salary_change_reason' => ['nullable', 'string', 'max:2000'],
                'payload.salary_effective_from' => ['nullable', 'date'],
                'payload.salary_history_uuid' => ['nullable', 'string', 'size:36'],
                'payload.address' => ['nullable', 'string', 'max:255'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('employees', 'email')->ignore($existing?->id),
                ],
                'payload.phone' => ['nullable', 'string', 'max:255'],
                'payload.hire_date' => ['nullable', 'date'],
                'payload.status' => ['nullable', 'string', 'max:255'],
            ]);

            return;
        }

        if ($entity === 'accounts') {
            $existing = Account::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('accounts', 'name')->ignore($existing?->id),
                ],
                'payload.account_type' => [
                'required',
                'string',
                'max:80',
                Rule::exists('document_types', 'code')->where(fn ($query) => $query->where('module', 'accounts')),
            ],
                'payload.bank_name' => ['nullable', 'string', 'max:255'],
                'payload.account_number' => ['nullable', 'string', 'max:100'],
                'payload.currency' => ['nullable', Rule::in(['USD', 'AFN'])],
                'payload.opening_balance' => ['nullable', 'numeric'],
                'payload.status' => ['nullable', Rule::in(['active', 'inactive'])],
                'payload.notes' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'exchange_rates') {
            $request->validate([
                'payload.base_currency' => ['nullable', Rule::in(['USD'])],
                'payload.quote_currency' => ['nullable', Rule::in(['AFN'])],
                'payload.rate' => ['required', 'numeric', 'gt:0'],
                'payload.source' => ['nullable', Rule::in(['manual', 'api'])],
                'payload.effective_date' => ['nullable', 'date'],
                'payload.is_active' => ['nullable', 'boolean'],
                'payload.notes' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'projects') {
            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.location' => ['nullable', 'string', 'max:255'],
                'payload.status' => ['nullable', Rule::in(['planned', 'active', 'completed'])],
                'payload.start_date' => ['nullable', 'date'],
                'payload.end_date' => ['nullable', 'date', 'after_or_equal:payload.start_date'],
            ]);

            return;
        }

        

        if ($entity === 'vendors') {
            $existing = Vendor::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.phone' => ['nullable', 'string', 'max:50'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('vendors', 'email')
                        ->whereNull('deleted_at')
                        ->ignore($existing?->id),
                ],
                'payload.address' => ['nullable', 'string'],
                'payload.status' => ['nullable', Rule::in(['active', 'inactive'])],
            ]);

            return;
        }

        if ($entity === 'warehouses') {
            $warehouseName = trim((string) ($request->input('payload.name') ?? ''));
            $existing = Warehouse::withTrashed()->where('uuid', $uuid)->first();
            if (! $existing && $warehouseName !== '') {
                $existing = Warehouse::withTrashed()->where('name', $warehouseName)->first();
            }

            $request->validate([
                'payload.name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('warehouses', 'name')->ignore($existing?->id),
                ],
                'payload.location' => ['nullable', 'string', 'max:255'],
                'payload.status' => ['nullable', Rule::in(['active', 'inactive'])],
            ]);

            return;
        }

        if ($entity === 'materials') {
            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.material_type' => ['nullable', 'string', 'max:255'],
                'payload.unit' => ['required', 'string', 'max:100'],
                'payload.quantity' => ['nullable', 'numeric', 'min:0'],
                'payload.reference_unit_price' => ['nullable', 'numeric', 'min:0'],
                'payload.opening_warehouse_id' => ['nullable', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
                'payload.supplier_id' => ['nullable', 'integer', 'min:1', Rule::exists('vendors', 'id')],
                'payload.batch_no' => ['nullable', 'string', 'max:255'],
                'payload.serial_no' => ['nullable', 'string', 'max:255'],
                'payload.expiry_date' => ['nullable', 'date'],
                'payload.min_stock_level' => ['nullable', 'numeric', 'min:0'],
                'payload.status' => ['nullable', Rule::in(['active', 'inactive'])],
                'payload.notes' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'company_assets') {
            $assetCode = trim((string) ($request->input('payload.asset_code') ?? ''));
            $existing = CompanyAsset::withTrashed()->where('uuid', $uuid)->first();
            if (! $existing && $assetCode !== '') {
                $existing = CompanyAsset::withTrashed()->where('asset_code', $assetCode)->first();
            }

            $request->validate([
                'payload.asset_code' => [
                    'required',
                    'string',
                    'max:100',
                    Rule::unique('company_assets', 'asset_code')->ignore($existing?->id),
                ],
                'payload.asset_name' => ['required', 'string', 'max:255'],
                'payload.asset_type' => ['required', Rule::in(['vehicle', 'machine', 'tool', 'IT'])],
                'payload.quantity' => ['required', 'numeric', 'min:0'],
                'payload.supplier_id' => ['nullable', 'integer', 'min:1', Rule::exists('vendors', 'id')],
                'payload.serial_no' => ['nullable', 'string', 'max:255'],
                'payload.status' => ['nullable', Rule::in(['available', 'allocated', 'maintenance', 'damaged', 'retired'])],
                'payload.current_employee_id' => ['nullable', 'integer', 'min:1', Rule::exists('employees', 'id')],
                'payload.current_project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
                'payload.current_warehouse_id' => ['nullable', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
                'payload.notes' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'material_requests') {
            $request->validate([
                'payload.project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
                'payload.warehouse_id' => ['required', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
                'payload.requested_by_employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
                'payload.notes' => ['nullable', 'string'],
                'payload.items' => ['required', 'array', 'min:1'],
                'payload.items.*.uuid' => ['nullable', 'string', 'size:36'],
                'payload.items.*.material_id' => ['required', 'integer', 'min:1', Rule::exists('materials', 'id')],
                'payload.items.*.quantity_requested' => ['required', 'numeric', 'min:0.01'],
                'payload.items.*.unit' => ['required', 'string', 'max:100'],
                'payload.items.*.notes' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'purchase_requests') {
            $request->validate([
                'payload.request_type' => ['nullable', Rule::in(['material', 'asset'])],
                'payload.source_material_request_id' => ['nullable', 'integer', 'min:1', Rule::exists('material_requests', 'id')],
                'payload.project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
                'payload.warehouse_id' => ['required', 'integer', 'min:1', Rule::exists('warehouses', 'id')],
                'payload.vendor_id' => ['nullable', 'integer', 'min:1', Rule::exists('vendors', 'id')],
                'payload.requested_by_employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
                'payload.notes' => ['nullable', 'string'],
                'payload.items' => ['required', 'array', 'min:1'],
                'payload.items.*.uuid' => ['nullable', 'string', 'size:36'],
                'payload.items.*.item_kind' => ['nullable', Rule::in(['material', 'asset'])],
                'payload.items.*.material_id' => ['nullable', 'integer', 'min:1', Rule::exists('materials', 'id')],
                'payload.items.*.company_asset_id' => ['nullable', 'integer', 'min:1', Rule::exists('company_assets', 'id')],
                'payload.items.*.asset_name' => ['nullable', 'string', 'max:255'],
                'payload.items.*.asset_type' => ['nullable', Rule::in(['vehicle', 'machine', 'tool', 'IT'])],
                'payload.items.*.asset_code_prefix' => ['nullable', 'string', 'max:50'],
                'payload.items.*.quantity_requested' => ['required', 'numeric', 'min:0.01'],
                'payload.items.*.estimated_unit_price' => ['nullable', 'numeric', 'min:0'],
                'payload.items.*.unit' => ['required', 'string', 'max:100'],
                'payload.items.*.notes' => ['nullable', 'string'],
            ]);

            return;
        }
        if ($entity === 'asset_requests') {
            $request->validate([
                'payload.project_id' => ['nullable', 'integer', 'min:1', Rule::exists('projects', 'id')],
                'payload.requested_by_employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
                'payload.requested_asset_id' => ['nullable', 'integer', 'min:1', Rule::exists('company_assets', 'id')],
                'payload.asset_type' => ['nullable', Rule::in(['vehicle', 'machine', 'tool', 'IT'])],
                'payload.quantity_requested' => ['required', 'numeric', 'min:0.01'],
                'payload.reason' => ['nullable', 'string'],
                'payload.notes' => ['nullable', 'string'],
            ]);

            return;
        }
        if ($entity === 'customers') {
            $existing = Customer::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.fname' => ['nullable', 'string', 'max:255'],
                'payload.gname' => ['nullable', 'string', 'max:255'],
                'payload.job_title' => ['nullable', 'string', 'max:255'],
                'payload.tazkira_number' => ['nullable', 'string', 'max:255'],
                'payload.phone' => [
                    'required',
                    'string',
                    'max:50',
                ],
                'payload.phone1' => ['nullable', 'string', 'max:50'],
                'payload.status' => ['nullable', 'string', 'max:50'],
                'payload.email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('customers', 'email')
                        ->whereNull('deleted_at')
                        ->ignore($existing?->id),
                ],
                'payload.address' => ['nullable', 'string'],
                'payload.current_area' => ['nullable', 'string', 'max:255'],
                'payload.current_district' => ['nullable', 'string', 'max:255'],
                'payload.current_province' => ['nullable', 'string', 'max:255'],
                'payload.original_area' => ['nullable', 'string', 'max:255'],
                'payload.original_district' => ['nullable', 'string', 'max:255'],
                'payload.original_province' => ['nullable', 'string', 'max:255'],
                'payload.representative_name' => ['nullable', 'string', 'max:255'],
                'payload.representative_fname' => ['nullable', 'string', 'max:255'],
                'payload.representative_gname' => ['nullable', 'string', 'max:255'],
                'payload.representative_job_title' => ['nullable', 'string', 'max:255'],
                'payload.representative_relationship' => ['nullable', 'string', 'max:255'],
                'payload.representative_phone' => ['nullable', 'string', 'max:50'],
                'payload.representative_tazkira_number' => ['nullable', 'string', 'max:255'],
                'payload.representative_current_area' => ['nullable', 'string', 'max:255'],
                'payload.representative_current_district' => ['nullable', 'string', 'max:255'],
                'payload.representative_current_province' => ['nullable', 'string', 'max:255'],
                'payload.representative_original_area' => ['nullable', 'string', 'max:255'],
                'payload.representative_original_district' => ['nullable', 'string', 'max:255'],
                'payload.representative_original_province' => ['nullable', 'string', 'max:255'],
            ]);

            return;
        }

        if ($entity === 'roles') {
            $guardName = (string) ($request->input('payload.guard_name') ?: 'web');
            $roleName = trim((string) ($request->input('payload.name') ?: ''));
            $existing = Roles::withTrashed()->where('uuid', $uuid)->first();
            if (! $existing && $roleName !== '') {
                $existing = Roles::withTrashed()
                    ->where('name', $roleName)
                    ->where('guard_name', $guardName)
                    ->first();
            }

            $request->validate([
                'payload.name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('roles', 'name')
                        ->where(fn ($query) => $query->where('guard_name', $guardName)->whereNull('deleted_at'))
                        ->ignore($existing?->id),
                ],
                'payload.guard_name' => ['nullable', 'string', 'max:255'],
                'payload.permissions' => ['nullable', 'array'],
                'payload.permissions.*' => [
                    'distinct:ignore_case',
                    'string',
                    'max:255',
                    Rule::exists('permissions', 'name')
                        ->where(fn ($query) => $query->where('guard_name', $guardName)),
                ],
            ]);

            return;
        }

        if ($entity === 'apartments') {
            $apartmentCode = trim((string) ($request->input('payload.apartment_code') ?? ''));
            $existing = Apartment::withTrashed()->where('uuid', $uuid)->first();
            if (! $existing && $apartmentCode !== '') {
                $existing = Apartment::withTrashed()->where('apartment_code', $apartmentCode)->first();
            }

            $request->validate([
                'payload.apartment_code' => [
                    'required',
                    'string',
                    'max:100',
                    Rule::unique('apartments', 'apartment_code')
                        ->ignore($existing?->id),
                ],
                'payload.total_price' => ['nullable', 'numeric', 'min:0'],
                'payload.usage_type' => ['required', Rule::in(['residential', 'commercial'])],
                'payload.block_number' => ['nullable', 'string', 'max:50'],
                'payload.unit_number' => ['required', 'string', 'max:50'],
                'payload.floor_number' => ['nullable', 'string', 'max:50'],
                'payload.bedrooms' => ['nullable', 'integer', 'min:0'],
                'payload.halls' => ['nullable', 'integer', 'min:0'],
                'payload.bathrooms' => ['nullable', 'integer', 'min:0'],
                'payload.kitchens' => ['nullable', 'integer', 'min:0'],
                'payload.balcony' => ['nullable', 'boolean'],
                'payload.area_sqm' => ['nullable', 'numeric', 'min:0'],
                'payload.apartment_shape' => ['nullable', 'string', 'max:100'],
                'payload.corridor' => ['nullable', 'string', 'max:100'],
                'payload.north_boundary' => ['nullable', 'string', 'max:255'],
                'payload.south_boundary' => ['nullable', 'string', 'max:255'],
                'payload.east_boundary' => ['nullable', 'string', 'max:255'],
                'payload.west_boundary' => ['nullable', 'string', 'max:255'],
                'payload.status' => ['nullable', Rule::in(['available', 'reserved', 'handed_over', 'sold', 'rented', 'company_use'])],
                'payload.qr_code' => ['nullable', 'string', 'max:255'],
                'payload.additional_info' => ['nullable', 'string'],
            ]);

            return;
        }

        if ($entity === 'apartment_sales') {
            $request->validate([
                'payload.sale_id' => ['nullable', 'string', 'max:30'],
                'payload.apartment_id' => ['required', 'integer', 'min:1', Rule::exists('apartments', 'id')],
                'payload.customer_id' => ['required', 'integer', 'min:1', Rule::exists('customers', 'id')],
                'payload.sale_date' => ['required', 'date'],
                'payload.total_price' => ['required', 'numeric', 'min:0.01'],
                'payload.discount' => ['nullable', 'numeric', 'min:0'],
                'payload.payment_type' => ['required', Rule::in(['full', 'installment'])],
                'payload.status' => ['nullable', Rule::in(['active', 'pending', 'approved', 'completed', 'cancelled', 'defaulted', 'terminated'])],
                'payload.frequency_type' => ['nullable', Rule::in(['weekly', 'monthly', 'quarterly', 'custom_dates'])],
                'payload.interval_count' => ['nullable', 'integer', 'min:1'],
                'payload.installment_count' => ['nullable', 'integer', 'min:1'],
                'payload.first_due_date' => ['nullable', 'date'],
                'payload.custom_dates' => ['nullable', 'array'],
                'payload.custom_dates.*.installment_no' => ['nullable', 'integer', 'min:1'],
                'payload.custom_dates.*.due_date' => ['required_with:payload.custom_dates', 'date'],
                'payload.custom_dates.*.amount' => ['required_with:payload.custom_dates', 'numeric', 'min:0.01'],
                'payload.schedule_locked' => ['nullable', 'boolean'],
                'payload.schedule_locked_at' => ['nullable', 'date'],
                'payload.approved_at' => ['nullable', 'date'],
                'payload.net_price' => ['nullable', 'numeric', 'min:0'],
                'payload.deed_status' => ['nullable', Rule::in(['not_issued', 'eligible', 'issued'])],
                'payload.deed_issued_at' => ['nullable', 'date'],
                'payload.deed_issued_by' => ['nullable', 'integer', Rule::exists('users', 'id')],
                'payload.key_handover_status' => ['nullable', Rule::in(['not_handed_over', 'handed_over', 'returned'])],
                'payload.key_handover_at' => ['nullable', 'date'],
                'payload.key_handover_by' => ['nullable', 'integer', Rule::exists('users', 'id')],
                'payload.possession_start_date' => ['nullable', 'date'],
                'payload.vacated_at' => ['nullable', 'date'],
                'payload.key_returned_at' => ['nullable', 'date'],
                'payload.key_returned_by' => ['nullable', 'integer', Rule::exists('users', 'id')],
                'payload.termination_reason' => ['nullable', 'string'],
                'payload.termination_charge' => ['nullable', 'numeric', 'min:0'],
                'payload.refund_amount' => ['nullable', 'numeric', 'min:0'],
                'payload.remaining_debt_after_termination' => ['nullable', 'numeric', 'min:0'],
            ]);

            return;
        }

        if ($entity === 'apartment_sale_financials') {
            $request->validate([
                'payload.apartment_sale_id' => ['nullable', 'integer', 'min:1', Rule::exists('apartment_sales', 'id')],
                'payload.sale_uuid' => ['nullable', 'uuid', Rule::exists('apartment_sales', 'uuid')],
                'payload.accounts_status' => ['nullable', 'string', 'max:100'],
                'payload.municipality_share_15' => ['nullable', 'numeric', 'min:0'],
                'payload.delivered_to_municipality' => ['nullable', 'numeric', 'min:0'],
                'payload.remaining_municipality' => ['nullable', 'numeric', 'min:0'],
                'payload.company_share_85' => ['nullable', 'numeric', 'min:0'],
                'payload.delivered_to_company' => ['nullable', 'numeric', 'min:0'],
                'payload.rahnama_fee_1' => ['nullable', 'numeric', 'min:0'],
                'payload.customer_debt' => ['nullable', 'numeric', 'min:0'],
                'payload.discount_or_contractor_deduction' => ['nullable', 'numeric', 'min:0'],
                'payload.updated_at' => ['nullable'],
            ]);
            $saleId = (int) $request->input('payload.apartment_sale_id', 0);
            $saleUuid = trim((string) $request->input('payload.sale_uuid', ''));
            if ($saleId <= 0 && $saleUuid === '') {
                abort(422, 'apartment_sale_id or sale_uuid is required for apartment_sale_financials.');
            }
            return;
        }
        if ($entity === 'salary_advances') {
            $request->validate([
                'payload.employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
                'payload.amount' => ['required', 'numeric', 'min:0.01'],
                'payload.currency_code' => ['nullable', Rule::in(['USD', 'AFN'])],
                'payload.user_id' => ['nullable', 'integer', 'min:1', Rule::exists('users', 'id')],
                'payload.reason' => ['nullable', 'string'],
                'payload.status' => ['nullable', Rule::in(['pending', 'approved', 'partial_deducted', 'deducted', 'rejected'])],
                'payload.updated_at' => ['nullable'],
            ]);
            return;
        }
        if ($entity === 'salary_payments') {
            $request->validate([
                'payload.employee_id' => ['required', 'integer', 'min:1', Rule::exists('employees', 'id')],
                'payload.period' => ['required', 'string', 'max:100'],
                'payload.gross_salary' => ['required', 'numeric', 'min:0'],
                'payload.salary_currency_code' => ['nullable', Rule::in(['USD', 'AFN'])],
                'payload.advance_deducted' => ['nullable', 'numeric', 'min:0'],
                'payload.tax_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
                'payload.tax_deducted' => ['nullable', 'numeric', 'min:0'],
                'payload.other_deductions' => ['nullable', 'numeric', 'min:0'],
                'payload.net_salary' => ['nullable', 'numeric', 'min:0'],
                'payload.status' => ['nullable', Rule::in(['draft', 'paid', 'cancelled'])],
                'payload.account_id' => ['nullable', 'integer', 'min:1', Rule::exists('accounts', 'id')],
                'payload.user_id' => ['nullable', 'integer', 'min:1', Rule::exists('users', 'id')],
                'payload.paid_at' => ['nullable', 'date'],
                'payload.updated_at' => ['nullable'],
            ]);

            return;
        }
        if ($entity === 'installments') {
            $request->validate([
                'payload.apartment_sale_id' => ['required', 'integer', 'min:1', Rule::exists('apartment_sales', 'id')],
                'payload.installment_no' => ['required', 'integer', 'min:1'],
                'payload.amount' => ['required', 'numeric', 'min:0'],
                'payload.due_date' => ['required', 'date'],
                'payload.paid_amount' => ['nullable', 'numeric', 'min:0'],
                'payload.paid_date' => ['nullable', 'date'],
                'payload.payment_amount' => ['nullable', 'numeric', 'min:0.01'],
                'payload.account_id' => ['nullable', 'integer', 'min:1', Rule::exists('accounts', 'id')],
                'payload.payment_method' => ['nullable', 'string', 'max:30'],
                'payload.reference_no' => ['nullable', 'string', 'max:100'],
                'payload.notes' => ['nullable', 'string'],
                'payload.status' => ['nullable', Rule::in(['pending', 'paid', 'overdue', 'cancelled'])],
                'payload.updated_at' => ['nullable'],
            ]);
            if ($request->filled('payload.payment_amount')) {
                $request->validate([
                    'payload.account_id' => ['required', 'integer', 'min:1', Rule::exists('accounts', 'id')],
                ]);
            }
            return;
        }

    }
    private function applyEntityOperation(string $entity, string $uuid, string $action, array $payload, int $actorId = 0): void
    {
        if ($entity === 'users') {
            if ($action === 'delete') {
                $user = User::withTrashed()->where('uuid', $uuid)->first();
                if ($user && ! $user->trashed()) {
                    $user->delete();
                }

                return;
            }

            $email = trim((string) ($payload['email'] ?? ''));
            $user = User::withTrashed()->where('uuid', $uuid)->first();
            if (! $user && $email !== '') {
                $user = User::withTrashed()->where('email', $email)->first();
            }

            if (! $user) {
                $user = new User();
                $user->uuid = $uuid;
            } elseif ($user->trashed()) {
                $user->restore();
            }

            if (array_key_exists('name', $payload)) {
                $user->name = $payload['name'];
                $user->full_name = $payload['name'];
            }
            if (array_key_exists('email', $payload)) {
                $user->email = $payload['email'] ?: null;
            }
            if (array_key_exists('password', $payload) && trim((string) $payload['password']) !== '') {
                $user->password = Hash::make((string) $payload['password']);
            } elseif (! $user->exists && empty($user->password)) {
                $user->password = Hash::make(Str::random(32));
            }

            $role = trim((string) ($payload['role'] ?? (is_array($payload['roles'] ?? null) ? ($payload['roles'][0] ?? '') : '')));
            $customerId = array_key_exists('customer_id', $payload)
                ? (int) ($payload['customer_id'] ?? 0)
                : (int) ($user->customer_id ?? 0);

            if ($role === 'Customer') {
                $user->customer_id = $customerId > 0 ? $customerId : null;
            } elseif (array_key_exists('customer_id', $payload)) {
                $user->customer_id = null;
            }

            $user->save();

            if ($role !== '') {
                $user->syncRoles([$role]);
            } elseif (array_key_exists('role', $payload) || array_key_exists('roles', $payload)) {
                $user->syncRoles([]);
            }

            return;
        }

        if ($entity === 'employees') {
            if ($action === 'delete') {
                $employee = Employee::withTrashed()->where('uuid', $uuid)->first();
                if ($employee && ! $employee->trashed()) {
                    $employee->delete();
                }

                return;
            }

            $email = trim((string) ($payload['email'] ?? ''));
            $employee = Employee::withTrashed()->where('uuid', $uuid)->first();
            if (! $employee && $email !== '') {
                $employee = Employee::withTrashed()->where('email', $email)->first();
            }

            $isNew = false;
            if (! $employee) {
                $employee = new Employee();
                $employee->uuid = $uuid;
                $isNew = true;
            } elseif ($employee->trashed()) {
                $employee->restore();
            }

            $previousSalary = $employee->base_salary;
            $previousSalaryCurrency = $employee->salary_currency_code;

            if (array_key_exists('first_name', $payload)) {
                $employee->first_name = trim((string) $payload['first_name']);
            }
            if (array_key_exists('last_name', $payload)) {
                $employee->last_name = trim((string) ($payload['last_name'] ?? '')) ?: null;
            }
            if (array_key_exists('job_title', $payload)) {
                $employee->job_title = trim((string) ($payload['job_title'] ?? '')) ?: null;
            }
            if (array_key_exists('salary_type', $payload)) {
                $employee->salary_type = trim((string) ($payload['salary_type'] ?? '')) ?: 'fixed';
            }
            if (array_key_exists('base_salary', $payload)) {
                $employee->base_salary = $payload['base_salary'] !== null
                    ? max(0, round((float) $payload['base_salary'], 2))
                    : null;
            }
            if (array_key_exists('salary_currency_code', $payload)) {
                $currency = strtoupper(trim((string) ($payload['salary_currency_code'] ?? 'USD')));
                $employee->salary_currency_code = in_array($currency, ['USD', 'AFN'], true) ? $currency : 'USD';
            } elseif (! $employee->salary_currency_code) {
                $employee->salary_currency_code = 'USD';
            }
            if (array_key_exists('address', $payload)) {
                $employee->address = trim((string) ($payload['address'] ?? '')) ?: null;
            }
            if (array_key_exists('email', $payload)) {
                $employee->email = $email !== '' ? $email : null;
            }
            if (array_key_exists('phone', $payload)) {
                $employee->phone = trim((string) ($payload['phone'] ?? '')) ?: null;
            }
            if (array_key_exists('status', $payload)) {
                $employee->status = trim((string) ($payload['status'] ?? '')) ?: 'active';
            }
            if (array_key_exists('hire_date', $payload)) {
                $employee->hire_date = !empty($payload['hire_date'])
                    ? CarbonImmutable::parse((string) $payload['hire_date'])->toDateString()
                    : null;
            }
            $employee->save();

            if ($isNew) {
                $this->salaryHistoryService->recordInitialSalary($employee, $actorId > 0 ? $actorId : null);
            } else {
                $this->salaryHistoryService->recordSalaryChange(
                    $employee,
                    $previousSalary,
                    $employee->base_salary,
                    $previousSalaryCurrency,
                    $employee->salary_currency_code,
                    isset($payload['salary_effective_from']) && !empty($payload['salary_effective_from'])
                        ? CarbonImmutable::parse((string) $payload['salary_effective_from'])->toDateString()
                        : null,
                    isset($payload['salary_change_reason']) ? (string) $payload['salary_change_reason'] : null,
                    isset($payload['salary_history_uuid']) ? (string) $payload['salary_history_uuid'] : null,
                    $actorId > 0 ? $actorId : null,
                );
            }

            return;
        }

        if ($entity === 'accounts') {
            if ($action === 'delete') {
                $account = Account::withTrashed()->where('uuid', $uuid)->first();
                if ($account && ! $account->trashed()) {
                    $hasTransactions = $account->transactions()->exists();
                    $hasSalaryPayments = $account->salaryPayments()->whereNull('deleted_at')->exists();

                    if ($hasTransactions && $hasSalaryPayments) {
                        abort(409, 'Cannot delete account with transaction and salary payment history. Mark it inactive instead.');
                    }

                    if ($hasTransactions) {
                        abort(409, 'Cannot delete account with transaction history. Mark it inactive instead.');
                    }

                    if ($hasSalaryPayments) {
                        abort(409, 'Cannot delete account linked to salary payments. Mark it inactive instead.');
                    }

                    $account->delete();
                }

                return;
            }

            $account = Account::withTrashed()->where('uuid', $uuid)->first();
            $isNew = false;
            if (! $account) {
                $account = new Account();
                $account->uuid = $uuid;
                $isNew = true;
            } elseif ($account->trashed()) {
                $account->restore();
            }

            $previousOpening = round((float) ($account->opening_balance ?? 0), 2);

            if (array_key_exists('name', $payload)) {
                $account->name = trim((string) $payload['name']);
            }
            if (array_key_exists('account_type', $payload)) {
                $account->account_type = trim((string) ($payload['account_type'] ?? '')) ?: 'office';
            }
            if (array_key_exists('bank_name', $payload)) {
                $account->bank_name = trim((string) ($payload['bank_name'] ?? '')) ?: null;
            }
            if (array_key_exists('account_number', $payload)) {
                $account->account_number = trim((string) ($payload['account_number'] ?? '')) ?: null;
            }
            if (array_key_exists('currency', $payload)) {
                $account->currency = strtoupper(trim((string) ($payload['currency'] ?? 'USD'))) ?: 'USD';
            }
            if (array_key_exists('opening_balance', $payload)) {
                $account->opening_balance = round((float) ($payload['opening_balance'] ?? 0), 2);
            }
            if (array_key_exists('status', $payload)) {
                $account->status = trim((string) ($payload['status'] ?? '')) ?: 'active';
            }
            if (array_key_exists('notes', $payload)) {
                $account->notes = trim((string) ($payload['notes'] ?? '')) ?: null;
            }

            if ($isNew) {
                $account->current_balance = round((float) ($account->opening_balance ?? 0), 2);
            } else {
                $delta = round((float) ($account->opening_balance ?? 0) - $previousOpening, 2);
                $account->current_balance = round((float) ($account->current_balance ?? 0) + $delta, 2);
            }

            $account->save();

            return;
        }

        if ($entity === 'exchange_rates') {
            if ($action === 'delete') {
                $rate = ExchangeRate::withTrashed()->where('uuid', $uuid)->first();
                if ($rate && ! $rate->trashed()) {
                    $this->exchangeRateService->ensureCanDelete($rate);
                    $rate->delete();
                }

                return;
            }

            $rate = ExchangeRate::withTrashed()->where('uuid', $uuid)->first();
            if (! $rate) {
                $rate = new ExchangeRate();
                $rate->uuid = $uuid;
            } elseif ($rate->trashed()) {
                $rate->restore();
            }

            $rate->base_currency = 'USD';
            $rate->quote_currency = 'AFN';
            $rate->rate = round((float) ($payload['rate'] ?? $rate->rate ?? 0), 6);
            $rate->source = trim((string) ($payload['source'] ?? $rate->source ?? 'manual')) ?: 'manual';
            $rate->effective_date = array_key_exists('effective_date', $payload) && !empty($payload['effective_date'])
                ? CarbonImmutable::parse((string) $payload['effective_date'])->toDateString()
                : ($rate->effective_date ?: now()->toDateString());
            if ($actorId > 0) {
                $rate->approved_by_user_id = $actorId;
            }
            if (array_key_exists('notes', $payload)) {
                $rate->notes = trim((string) ($payload['notes'] ?? '')) ?: null;
            }
            if (array_key_exists('is_active', $payload)) {
                $rate->is_active = (bool) $payload['is_active'];
            } elseif (! $rate->exists) {
                $rate->is_active = true;
            }
            $rate->save();
            $this->exchangeRateService->syncActivation($rate);

            return;
        }



        

        if ($entity === 'projects') {
            if ($action === 'delete') {
                $project = Project::withTrashed()->where('uuid', $uuid)->first();
                if ($project && ! $project->trashed()) {
                    $project->delete();
                }

                return;
            }

            $project = Project::withTrashed()->where('uuid', $uuid)->first();
            if (! $project) {
                $project = new Project();
                $project->uuid = $uuid;
            } elseif ($project->trashed()) {
                $project->restore();
            }

            if (array_key_exists('name', $payload)) {
                $project->name = trim((string) $payload['name']);
            }
            $project->location = array_key_exists('location', $payload)
                ? (trim((string) ($payload['location'] ?? '')) !== '' ? trim((string) $payload['location']) : null)
                : $project->location;
            if (array_key_exists('status', $payload)) {
                $status = strtolower(trim((string) $payload['status']));
                $project->status = in_array($status, ['active', 'completed'], true) ? $status : 'planned';
            } elseif (! $project->status) {
                $project->status = 'planned';
            }
            $project->start_date = array_key_exists('start_date', $payload)
                ? ($payload['start_date'] ? CarbonImmutable::parse((string) $payload['start_date'])->toDateString() : null)
                : $project->start_date;
            $project->end_date = array_key_exists('end_date', $payload)
                ? ($payload['end_date'] ? CarbonImmutable::parse((string) $payload['end_date'])->toDateString() : null)
                : $project->end_date;
            $project->save();

            return;
        }

        if ($entity === 'vendors') {
            if ($action === 'delete') {
                $vendor = Vendor::withTrashed()->where('uuid', $uuid)->first();
                if ($vendor && ! $vendor->trashed()) {
                    $vendor->delete();
                }

                return;
            }

            $email = trim((string) ($payload['email'] ?? ''));
            $vendor = Vendor::withTrashed()->where('uuid', $uuid)->first();
            if (! $vendor && $email !== '') {
                $vendor = Vendor::withTrashed()->where('email', $email)->first();
            }

            if (! $vendor) {
                $vendor = new Vendor();
                $vendor->uuid = $uuid;
            } elseif ($vendor->trashed()) {
                $vendor->restore();
            }

            $vendor->name = trim((string) ($payload['name'] ?? $vendor->name ?? ''));
            $vendor->phone = array_key_exists('phone', $payload)
                ? (trim((string) ($payload['phone'] ?? '')) !== '' ? trim((string) $payload['phone']) : null)
                : $vendor->phone;
            $vendor->email = array_key_exists('email', $payload)
                ? (trim((string) ($payload['email'] ?? '')) !== '' ? trim((string) $payload['email']) : null)
                : $vendor->email;
            $vendor->address = array_key_exists('address', $payload)
                ? (trim((string) ($payload['address'] ?? '')) !== '' ? trim((string) $payload['address']) : null)
                : $vendor->address;
            if (array_key_exists('status', $payload)) {
                $vendor->status = strtolower(trim((string) $payload['status'])) === 'inactive' ? 'inactive' : 'active';
            } elseif (! $vendor->status) {
                $vendor->status = 'active';
            }
            $vendor->save();

            return;
        }

        if ($entity === 'warehouses') {
            if ($action === 'delete') {
                $warehouse = Warehouse::withTrashed()->where('uuid', $uuid)->first();
                if ($warehouse && ! $warehouse->trashed()) {
                    $warehouse->delete();
                }

                return;
            }

            $name = trim((string) ($payload['name'] ?? ''));
            $warehouse = Warehouse::withTrashed()->where('uuid', $uuid)->first();
            if (! $warehouse && $name !== '') {
                $warehouse = Warehouse::withTrashed()->where('name', $name)->first();
            }

            if (! $warehouse) {
                $warehouse = new Warehouse();
                $warehouse->uuid = $uuid;
            } elseif ($warehouse->trashed()) {
                $warehouse->restore();
            }

            if (array_key_exists('name', $payload)) {
                $warehouse->name = trim((string) $payload['name']);
            }
            $warehouse->location = array_key_exists('location', $payload)
                ? (trim((string) ($payload['location'] ?? '')) !== '' ? trim((string) $payload['location']) : null)
                : $warehouse->location;
            if (array_key_exists('status', $payload)) {
                $warehouse->status = strtolower(trim((string) $payload['status'])) === 'inactive' ? 'inactive' : 'active';
            } elseif (! $warehouse->status) {
                $warehouse->status = 'active';
            }
            $warehouse->save();

            return;
        }

        if ($entity === 'materials') {
            if ($action === 'delete') {
                $material = Material::withTrashed()->where('uuid', $uuid)->first();
                if ($material && ! $material->trashed()) {
                    $material->delete();
                }

                return;
            }

            $material = Material::withTrashed()->where('uuid', $uuid)->first();
            if (! $material) {
                $material = new Material();
                $material->uuid = $uuid;
            } elseif ($material->trashed()) {
                $material->restore();
            }

            $hasStructuredStock = $material->warehouseMaterialStocks()->exists();
            $requestedQuantity = array_key_exists('quantity', $payload)
                ? max(0, round((float) $payload['quantity'], 2))
                : null;

            if (array_key_exists('name', $payload)) {
                $material->name = trim((string) $payload['name']);
            }
            $material->material_type = array_key_exists('material_type', $payload)
                ? (trim((string) ($payload['material_type'] ?? '')) !== '' ? trim((string) $payload['material_type']) : null)
                : $material->material_type;
            if (array_key_exists('unit', $payload)) {
                $material->unit = trim((string) $payload['unit']);
            }
            if (! $hasStructuredStock && $requestedQuantity !== null) {
                $material->quantity = $requestedQuantity;
            } elseif ($material->quantity === null) {
                $material->quantity = 0;
            }
            if (array_key_exists('reference_unit_price', $payload)) {
                $material->reference_unit_price = $payload['reference_unit_price'] !== null
                    ? max(0, round((float) $payload['reference_unit_price'], 2))
                    : null;
            }
            $material->supplier_id = array_key_exists('supplier_id', $payload)
                ? ($payload['supplier_id'] !== null ? (int) $payload['supplier_id'] : null)
                : $material->supplier_id;
            $material->batch_no = array_key_exists('batch_no', $payload)
                ? (trim((string) ($payload['batch_no'] ?? '')) !== '' ? trim((string) $payload['batch_no']) : null)
                : $material->batch_no;
            $material->serial_no = array_key_exists('serial_no', $payload)
                ? (trim((string) ($payload['serial_no'] ?? '')) !== '' ? trim((string) $payload['serial_no']) : null)
                : $material->serial_no;
            $material->expiry_date = array_key_exists('expiry_date', $payload)
                ? ($payload['expiry_date'] ?: null)
                : $material->expiry_date;
            if (array_key_exists('min_stock_level', $payload)) {
                $material->min_stock_level = max(0, round((float) $payload['min_stock_level'], 2));
            } elseif ($material->min_stock_level === null) {
                $material->min_stock_level = 0;
            }
            if (array_key_exists('status', $payload)) {
                $material->status = strtolower(trim((string) $payload['status'])) === 'inactive' ? 'inactive' : 'active';
            } elseif (! $material->status) {
                $material->status = 'active';
            }
            $material->notes = array_key_exists('notes', $payload)
                ? (trim((string) ($payload['notes'] ?? '')) !== '' ? trim((string) $payload['notes']) : null)
                : $material->notes;
            $material->save();

            $openingWarehouseId = array_key_exists('opening_warehouse_id', $payload) && $payload['opening_warehouse_id'] !== null
                ? (int) $payload['opening_warehouse_id']
                : null;
            if ($openingWarehouseId && ! $hasStructuredStock) {
                $legacyQuantity = $this->materialStocks->getLegacyQuantity($material);
                if ($legacyQuantity > 0) {
                    $this->materialStocks->assignLegacyStock($material->id, $openingWarehouseId);
                    StockMovement::query()->create([
                        'uuid' => (string) Str::uuid(),
                        'material_id' => $material->id,
                        'warehouse_id' => $openingWarehouseId,
                        'project_id' => null,
                        'employee_id' => null,
                        'material_request_item_id' => null,
                        'quantity' => $legacyQuantity,
                        'movement_type' => 'IN',
                        'reference_type' => 'opening_balance',
                        'reference_no' => 'MOB-' . str_pad((string) $material->id, 6, '0', STR_PAD_LEFT),
                        'approved_by_user_id' => null,
                        'issued_by_user_id' => null,
                        'movement_date' => now(),
                        'notes' => trim((string) ($payload['notes'] ?? '')) ?: null,
                    ]);
                }
            }

            return;
        }

        if ($entity === 'company_assets') {
            if ($action === 'delete') {
                $asset = CompanyAsset::withTrashed()->where('uuid', $uuid)->first();
                if ($asset && ! $asset->trashed()) {
                    $asset->delete();
                }

                return;
            }

            $assetCode = trim((string) ($payload['asset_code'] ?? ''));
            $asset = CompanyAsset::withTrashed()->where('uuid', $uuid)->first();
            if (! $asset && $assetCode !== '') {
                $asset = CompanyAsset::withTrashed()->where('asset_code', $assetCode)->first();
            }

            if (! $asset) {
                $asset = new CompanyAsset();
                $asset->uuid = $uuid;
            } elseif ($asset->trashed()) {
                $asset->restore();
            }

            if (array_key_exists('asset_code', $payload)) {
                $asset->asset_code = trim((string) $payload['asset_code']);
            }
            if (array_key_exists('asset_name', $payload)) {
                $asset->asset_name = trim((string) $payload['asset_name']);
            }
            if (array_key_exists('asset_type', $payload)) {
                $asset->asset_type = trim((string) $payload['asset_type']);
            }
            if (array_key_exists('quantity', $payload)) {
                $asset->quantity = max(0, round((float) ($payload['quantity'] ?? 0), 2));
            }
            $asset->supplier_id = array_key_exists('supplier_id', $payload)
                ? ($payload['supplier_id'] !== null ? (int) $payload['supplier_id'] : null)
                : $asset->supplier_id;
            $asset->serial_no = array_key_exists('serial_no', $payload)
                ? (trim((string) ($payload['serial_no'] ?? '')) !== '' ? trim((string) $payload['serial_no']) : null)
                : $asset->serial_no;
            if (array_key_exists('status', $payload)) {
                $status = strtolower(trim((string) $payload['status']));
                $asset->status = in_array($status, ['allocated', 'maintenance', 'damaged', 'retired'], true) ? $status : 'available';
            } elseif (! $asset->status) {
                $asset->status = 'available';
            }
            $asset->current_employee_id = array_key_exists('current_employee_id', $payload)
                ? ($payload['current_employee_id'] !== null ? (int) $payload['current_employee_id'] : null)
                : $asset->current_employee_id;
            $asset->current_project_id = array_key_exists('current_project_id', $payload)
                ? ($payload['current_project_id'] !== null ? (int) $payload['current_project_id'] : null)
                : $asset->current_project_id;
            $asset->current_warehouse_id = array_key_exists('current_warehouse_id', $payload)
                ? ($payload['current_warehouse_id'] !== null ? (int) $payload['current_warehouse_id'] : null)
                : $asset->current_warehouse_id;
            $asset->notes = array_key_exists('notes', $payload)
                ? (trim((string) ($payload['notes'] ?? '')) !== '' ? trim((string) $payload['notes']) : null)
                : $asset->notes;
            $asset->allocated_quantity = $asset->allocated_quantity ?? 0;
            $asset->maintenance_quantity = $asset->maintenance_quantity ?? 0;
            $asset->damaged_quantity = $asset->damaged_quantity ?? 0;
            $asset->retired_quantity = $asset->retired_quantity ?? 0;
            $asset->save();

            return;
        }
        if ($entity === 'material_requests') {
            if ($action === 'delete') {
                $materialRequest = MaterialRequest::withTrashed()->where('uuid', $uuid)->first();
                if ($materialRequest && ! $materialRequest->trashed()) {
                    $materialRequest->delete();
                }

                return;
            }

            $materialRequest = MaterialRequest::withTrashed()->where('uuid', $uuid)->first();
            if (! $materialRequest) {
                $materialRequest = new MaterialRequest();
                $materialRequest->uuid = $uuid;
                $materialRequest->request_no = 'MR-' . str_pad((string) ((int) MaterialRequest::withTrashed()->max('id') + 1), 6, '0', STR_PAD_LEFT);
                $materialRequest->requested_at = now();
            } elseif ($materialRequest->trashed()) {
                $materialRequest->restore();
            }

            $materialRequest->project_id = array_key_exists('project_id', $payload)
                ? ($payload['project_id'] !== null ? (int) $payload['project_id'] : null)
                : $materialRequest->project_id;
            $materialRequest->warehouse_id = (int) ($payload['warehouse_id'] ?? $materialRequest->warehouse_id);
            $materialRequest->requested_by_employee_id = (int) ($payload['requested_by_employee_id'] ?? $materialRequest->requested_by_employee_id);
            $materialRequest->status = 'pending';
            $materialRequest->notes = array_key_exists('notes', $payload)
                ? (trim((string) ($payload['notes'] ?? '')) !== '' ? trim((string) $payload['notes']) : null)
                : $materialRequest->notes;
            $materialRequest->save();

            $materialRequest->items()->delete();
            foreach ((array) ($payload['items'] ?? []) as $row) {
                MaterialRequestItem::query()->create([
                    'uuid' => (string) ($row['uuid'] ?? Str::uuid()),
                    'material_request_id' => $materialRequest->id,
                    'material_id' => (int) ($row['material_id'] ?? 0),
                    'quantity_requested' => round((float) ($row['quantity_requested'] ?? 0), 2),
                    'quantity_approved' => 0,
                    'quantity_issued' => 0,
                    'unit' => trim((string) ($row['unit'] ?? '')),
                    'notes' => isset($row['notes']) && trim((string) $row['notes']) !== '' ? trim((string) $row['notes']) : null,
                ]);
            }

            return;
        }

        if ($entity === 'purchase_requests') {
            if ($action === 'delete') {
                $purchaseRequest = PurchaseRequest::withTrashed()->where('uuid', $uuid)->first();
                if ($purchaseRequest && ! $purchaseRequest->trashed()) {
                    $purchaseRequest->delete();
                }

                return;
            }

            $purchaseRequest = PurchaseRequest::withTrashed()->where('uuid', $uuid)->first();
            if (! $purchaseRequest) {
                $purchaseRequest = new PurchaseRequest();
                $purchaseRequest->uuid = $uuid;
                $purchaseRequest->request_no = 'PR-' . str_pad((string) ((int) PurchaseRequest::withTrashed()->max('id') + 1), 6, '0', STR_PAD_LEFT);
                $purchaseRequest->requested_at = now();
            } elseif ($purchaseRequest->trashed()) {
                $purchaseRequest->restore();
            }

            if (array_key_exists('request_type', $payload)) {
                $purchaseRequest->request_type = strtolower(trim((string) ($payload['request_type'] ?? ''))) === 'asset' ? 'asset' : 'material';
            } elseif (! $purchaseRequest->request_type) {
                $purchaseRequest->request_type = 'material';
            }
            $purchaseRequest->source_material_request_id = array_key_exists('source_material_request_id', $payload)
                ? ($payload['source_material_request_id'] !== null ? (int) $payload['source_material_request_id'] : null)
                : $purchaseRequest->source_material_request_id;
            $purchaseRequest->project_id = array_key_exists('project_id', $payload)
                ? ($payload['project_id'] !== null ? (int) $payload['project_id'] : null)
                : $purchaseRequest->project_id;
            $purchaseRequest->warehouse_id = (int) ($payload['warehouse_id'] ?? $purchaseRequest->warehouse_id);
            $purchaseRequest->vendor_id = array_key_exists('vendor_id', $payload)
                ? ($payload['vendor_id'] !== null ? (int) $payload['vendor_id'] : null)
                : $purchaseRequest->vendor_id;
            $purchaseRequest->requested_by_employee_id = (int) ($payload['requested_by_employee_id'] ?? $purchaseRequest->requested_by_employee_id);
            $purchaseRequest->status = 'pending';
            $purchaseRequest->notes = array_key_exists('notes', $payload)
                ? (trim((string) ($payload['notes'] ?? '')) !== '' ? trim((string) $payload['notes']) : null)
                : $purchaseRequest->notes;
            $purchaseRequest->save();

            $purchaseRequest->items()->delete();
            foreach ((array) ($payload['items'] ?? []) as $row) {
                $itemKind = strtolower(trim((string) ($row['item_kind'] ?? $purchaseRequest->request_type ?? 'material'))) === 'asset'
                    ? 'asset'
                    : 'material';
                $companyAssetId = $itemKind === 'asset' ? (int) ($row['company_asset_id'] ?? 0) : 0;
                $companyAsset = $companyAssetId > 0 ? CompanyAsset::withTrashed()->find($companyAssetId) : null;
                PurchaseRequestItem::query()->create([
                    'uuid' => (string) ($row['uuid'] ?? Str::uuid()),
                    'purchase_request_id' => $purchaseRequest->id,
                    'item_kind' => $itemKind,
                    'material_id' => $itemKind === 'material' ? (int) ($row['material_id'] ?? 0) : null,
                    'company_asset_id' => $itemKind === 'asset' && $companyAsset ? (int) $companyAsset->id : null,
                    'asset_name' => $itemKind === 'asset'
                        ? ($companyAsset?->asset_name ?: (trim((string) ($row['asset_name'] ?? '')) !== '' ? trim((string) $row['asset_name']) : null))
                        : null,
                    'asset_type' => $itemKind === 'asset'
                        ? ($companyAsset
                            ? (trim((string) $companyAsset->asset_type) === 'IT' ? 'IT' : strtolower(trim((string) $companyAsset->asset_type)))
                            : (trim((string) ($row['asset_type'] ?? '')) === 'IT' ? 'IT' : strtolower(trim((string) ($row['asset_type'] ?? '')))))
                        : null,
                    'asset_code_prefix' => $itemKind === 'asset' && ! $companyAsset && trim((string) ($row['asset_code_prefix'] ?? '')) !== '' ? strtoupper(trim((string) $row['asset_code_prefix'])) : null,
                    'quantity_requested' => $itemKind === 'asset'
                        ? max(0, (int) round((float) ($row['quantity_requested'] ?? 0)))
                        : round((float) ($row['quantity_requested'] ?? 0), 2),
                    'quantity_approved' => 0,
                    'quantity_received' => 0,
                    'estimated_unit_price' => array_key_exists('estimated_unit_price', $row) && $row['estimated_unit_price'] !== null
                        ? round(max(0, (float) $row['estimated_unit_price']), 2)
                        : null,
                    'estimated_line_total' => array_key_exists('estimated_unit_price', $row) && $row['estimated_unit_price'] !== null
                        ? round(
                            (($itemKind === 'asset'
                                ? max(0, (int) round((float) ($row['quantity_requested'] ?? 0)))
                                : round((float) ($row['quantity_requested'] ?? 0), 2))
                            * max(0, (float) $row['estimated_unit_price'])),
                            2
                        )
                        : null,
                    'actual_unit_price' => null,
                    'actual_line_total' => null,
                    'unit' => trim((string) ($row['unit'] ?? '')),
                    'notes' => isset($row['notes']) && trim((string) $row['notes']) !== '' ? trim((string) $row['notes']) : null,
                ]);
            }

            return;
        }
        if ($entity === 'asset_requests') {
            if ($action === 'delete') {
                $assetRequest = AssetRequest::withTrashed()->where('uuid', $uuid)->first();
                if ($assetRequest && ! $assetRequest->trashed()) {
                    $assetRequest->delete();
                }

                return;
            }

            $assetRequest = AssetRequest::withTrashed()->where('uuid', $uuid)->first();
            if (! $assetRequest) {
                $assetRequest = new AssetRequest();
                $assetRequest->uuid = $uuid;
                $assetRequest->request_no = 'AR-' . str_pad((string) ((int) AssetRequest::withTrashed()->max('id') + 1), 6, '0', STR_PAD_LEFT);
                $assetRequest->requested_at = now();
            } elseif ($assetRequest->trashed()) {
                $assetRequest->restore();
            }

            $asset = isset($payload['requested_asset_id']) && $payload['requested_asset_id'] !== null
                ? CompanyAsset::withTrashed()->find((int) $payload['requested_asset_id'])
                : null;
            $assetType = array_key_exists('asset_type', $payload)
                ? (trim((string) ($payload['asset_type'] ?? '')) !== '' ? trim((string) $payload['asset_type']) : null)
                : ($asset?->asset_type ?: $assetRequest->asset_type);

            $assetRequest->project_id = array_key_exists('project_id', $payload)
                ? ($payload['project_id'] !== null ? (int) $payload['project_id'] : null)
                : $assetRequest->project_id;
            $assetRequest->requested_by_employee_id = (int) ($payload['requested_by_employee_id'] ?? $assetRequest->requested_by_employee_id);
            $assetRequest->requested_asset_id = array_key_exists('requested_asset_id', $payload)
                ? ($payload['requested_asset_id'] !== null ? (int) $payload['requested_asset_id'] : null)
                : $assetRequest->requested_asset_id;
            $assetRequest->asset_type = $assetType;
            $assetRequest->quantity_requested = array_key_exists('quantity_requested', $payload)
                ? max(0.01, round((float) ($payload['quantity_requested'] ?? 1), 2))
                : ($assetRequest->quantity_requested ?: 1);
            $assetRequest->quantity_allocated = $assetRequest->quantity_allocated ?? 0;
            $assetRequest->status = 'pending';
            $assetRequest->reason = array_key_exists('reason', $payload)
                ? (trim((string) ($payload['reason'] ?? '')) !== '' ? trim((string) $payload['reason']) : null)
                : $assetRequest->reason;
            $assetRequest->notes = array_key_exists('notes', $payload)
                ? (trim((string) ($payload['notes'] ?? '')) !== '' ? trim((string) $payload['notes']) : null)
                : $assetRequest->notes;
            $assetRequest->save();

            return;
        }
        if ($entity === 'customers') {
            if ($action === 'delete') {
                $customer = Customer::withTrashed()->where('uuid', $uuid)->first();
                if ($customer && ! $customer->trashed()) {
                    $customer->delete();
                }

                return;
            }

            $phone = trim((string) ($payload['phone'] ?? ''));
            $email = trim((string) ($payload['email'] ?? ''));

            $customer = Customer::withTrashed()->where('uuid', $uuid)->first();
            if (! $customer && $phone !== '') {
                $customer = Customer::withTrashed()->where('phone', $phone)->first();
            }
            if (! $customer && $email !== '') {
                $customer = Customer::withTrashed()->where('email', $email)->first();
            }

            if (! $customer) {
                $customer = new Customer();
                $customer->uuid = $uuid;
            } elseif ($customer->trashed()) {
                $customer->restore();
            }

            if (array_key_exists('name', $payload)) {
                $customer->name = $payload['name'];
            }
            if (array_key_exists('fname', $payload)) {
                $customer->fname = $payload['fname'];
            }
            if (array_key_exists('gname', $payload)) {
                $customer->gname = $payload['gname'];
            }
            if (array_key_exists('job_title', $payload)) {
                $customer->job_title = $payload['job_title'];
            }
            if (array_key_exists('tazkira_number', $payload)) {
                $customer->tazkira_number = $payload['tazkira_number'];
            }
            if (array_key_exists('phone', $payload)) {
                $customer->phone = $payload['phone'];
            }
            if (array_key_exists('phone1', $payload)) {
                $customer->phone1 = $payload['phone1'];
            }
            if (array_key_exists('email', $payload)) {
                $customer->email = $payload['email'] ?: null;
            }
            if (array_key_exists('address', $payload)) {
                $customer->address = $payload['address'];
            }
            if (array_key_exists('current_area', $payload)) {
                $customer->current_area = $payload['current_area'];
            }
            if (array_key_exists('current_district', $payload)) {
                $customer->current_district = $payload['current_district'];
            }
            if (array_key_exists('current_province', $payload)) {
                $customer->current_province = $payload['current_province'];
            }
            if (array_key_exists('original_area', $payload)) {
                $customer->original_area = $payload['original_area'];
            }
            if (array_key_exists('original_district', $payload)) {
                $customer->original_district = $payload['original_district'];
            }
            if (array_key_exists('original_province', $payload)) {
                $customer->original_province = $payload['original_province'];
            }
            if (array_key_exists('representative_name', $payload)) {
                $customer->representative_name = $payload['representative_name'];
            }
            if (array_key_exists('representative_fname', $payload)) {
                $customer->representative_fname = $payload['representative_fname'];
            }
            if (array_key_exists('representative_gname', $payload)) {
                $customer->representative_gname = $payload['representative_gname'];
            }
            if (array_key_exists('representative_job_title', $payload)) {
                $customer->representative_job_title = $payload['representative_job_title'];
            }
            if (array_key_exists('representative_relationship', $payload)) {
                $customer->representative_relationship = $payload['representative_relationship'];
            }
            if (array_key_exists('representative_phone', $payload)) {
                $customer->representative_phone = $payload['representative_phone'];
            }
            if (array_key_exists('representative_tazkira_number', $payload)) {
                $customer->representative_tazkira_number = $payload['representative_tazkira_number'];
            }
            if (array_key_exists('representative_current_area', $payload)) {
                $customer->representative_current_area = $payload['representative_current_area'];
            }
            if (array_key_exists('representative_current_district', $payload)) {
                $customer->representative_current_district = $payload['representative_current_district'];
            }
            if (array_key_exists('representative_current_province', $payload)) {
                $customer->representative_current_province = $payload['representative_current_province'];
            }
            if (array_key_exists('representative_original_area', $payload)) {
                $customer->representative_original_area = $payload['representative_original_area'];
            }
            if (array_key_exists('representative_original_district', $payload)) {
                $customer->representative_original_district = $payload['representative_original_district'];
            }
            if (array_key_exists('representative_original_province', $payload)) {
                $customer->representative_original_province = $payload['representative_original_province'];
            }
            if (array_key_exists('status', $payload)) {
                $customer->status = $payload['status'];
            }
            $customer->save();

            return;
        }

        if ($entity === 'roles') {
            if ($action === 'delete') {
                $role = Roles::withTrashed()->where('uuid', $uuid)->first();
                if ($role && ! $role->trashed()) {
                    $role->delete();
                }
                return;
            }

            $guardName = $payload['guard_name'] ?? 'web';
            $role = Roles::withTrashed()->where('uuid', $uuid)->first();
            if (! $role) {
                $role = Roles::withTrashed()
                    ->where('name', $payload['name'] ?? null)
                    ->where('guard_name', $guardName)
                    ->first();
            }

            if (! $role) {
                $role = Roles::query()->create([
                    'uuid' => $uuid,
                    'name' => $payload['name'] ?? null,
                    'guard_name' => $guardName,
                ]);
            } else {
                $role->fill([
                    'name' => $payload['name'] ?? null,
                    'guard_name' => $guardName,
                ]);
                $role->save();
            }

            if ($role->trashed()) {
                $role->restore();
            }
            if (array_key_exists('permissions', $payload)) {
                $permissionNames = collect((array) $payload['permissions'])
                    ->filter(fn ($name) => is_string($name))
                    ->map(fn ($name) => trim($name))
                    ->filter()
                    ->unique(fn ($name) => mb_strtolower($name))
                    ->values()
                    ->all();
                $role->syncPermissions($permissionNames);
            }

            return;
        }

        if ($entity === 'salary_advances') {
            if ($action === 'delete') {
                $advance = SalaryAdvance::withTrashed()->where('uuid', $uuid)->first();
                if ($advance && ! $advance->trashed()) {
                    $advance->delete();
                }

                return;
            }

            $advance = SalaryAdvance::withTrashed()->where('uuid', $uuid)->first();
            if (! $advance) {
                $advance = new SalaryAdvance();
                $advance->uuid = $uuid;
            } elseif ($advance->trashed()) {
                $advance->restore();
            }

            $advance->employee_id = (int) ($payload['employee_id'] ?? $advance->employee_id ?? 0);
            $advance->amount = max(0.01, round((float) ($payload['amount'] ?? $advance->amount ?? 0), 2));
            $requestedAdvanceCurrency = strtoupper(trim((string) ($payload['currency_code'] ?? '')));
            $employeeAdvanceCurrency = Employee::query()
                ->where('id', $advance->employee_id)
                ->value('salary_currency_code');
            $advance->currency_code = in_array($requestedAdvanceCurrency, ['USD', 'AFN'], true)
                ? $requestedAdvanceCurrency
                : (in_array(strtoupper(trim((string) $advance->currency_code)), ['USD', 'AFN'], true)
                    ? strtoupper(trim((string) $advance->currency_code))
                    : (in_array(strtoupper(trim((string) $employeeAdvanceCurrency)), ['USD', 'AFN'], true)
                        ? strtoupper(trim((string) $employeeAdvanceCurrency))
                        : 'USD'));
            $advance->user_id = array_key_exists('user_id', $payload)
                ? ($payload['user_id'] !== null ? (int) $payload['user_id'] : null)
                : ($advance->user_id ?: ($actorId > 0 ? $actorId : null));
                $advance->reason = array_key_exists('reason', $payload)
                    ? (trim((string) ($payload['reason'] ?? '')) !== '' ? trim((string) $payload['reason']) : null)
                    : $advance->reason;
            $this->salaryAdvanceBalanceService->syncAdvanceSnapshot(
                $advance,
                (string) ($payload['status'] ?? $advance->status ?? 'pending')
            );
            $advance->save();

            return;
        }

        if ($entity === 'salary_payments') {
            if ($action === 'delete') {
                DB::transaction(function () use ($uuid, $actorId): void {
                    $payment = SalaryPayment::withTrashed()->where('uuid', $uuid)->lockForUpdate()->first();
                    if ($payment && ! $payment->trashed()) {
                        $this->salaryAdvanceBalanceService->reverseSalaryPaymentDeductions($payment);
                        $this->accountLedgerService->reverseLinkedSalaryPaymentPosting(
                            $payment,
                            $actorId > 0 ? $actorId : null
                        );
                        $payment->delete();
                    }
                });

                return;
            }

            DB::transaction(function () use ($uuid, $payload, $actorId): void {
                $payment = SalaryPayment::withTrashed()->where('uuid', $uuid)->lockForUpdate()->first();
                if (! $payment) {
                    $payment = new SalaryPayment();
                    $payment->uuid = $uuid;
                } elseif ($payment->trashed()) {
                    $payment->restore();
                }

                $grossSalary = max(0, round((float) ($payload['gross_salary'] ?? $payment->gross_salary ?? 0), 2));
                $advanceDeducted = max(0, round((float) ($payload['advance_deducted'] ?? $payment->advance_deducted ?? 0), 2));
                if ($advanceDeducted > $grossSalary) {
                    $advanceDeducted = $grossSalary;
                }
                $taxPercentage = min(100, max(0, round((float) ($payload['tax_percentage'] ?? $payment->tax_percentage ?? 0), 2)));
                $taxDeducted = array_key_exists('tax_percentage', $payload)
                    ? min($grossSalary, round($grossSalary * ($taxPercentage / 100), 2))
                    : min($grossSalary, max(0, round((float) ($payload['tax_deducted'] ?? $payment->tax_deducted ?? 0), 2)));
                $otherDeductions = min($grossSalary, max(0, round((float) ($payload['other_deductions'] ?? $payment->other_deductions ?? 0), 2)));

                $payment->employee_id = (int) ($payload['employee_id'] ?? $payment->employee_id ?? 0);
                $employeeCurrency = Employee::query()
                    ->where('id', $payment->employee_id)
                    ->value('salary_currency_code');
                $salaryCurrency = $this->exchangeRateService->normalizeCurrency(
                    (string) ($payload['salary_currency_code'] ?? $employeeCurrency ?? $payment->salary_currency_code ?? 'USD')
                );
                $salaryRateSnapshot = $this->exchangeRateService->rateSnapshotForCurrency($salaryCurrency);
                $payment->period = trim((string) ($payload['period'] ?? $payment->period ?? ''));
                $payment->gross_salary = $grossSalary;
                $payment->gross_salary_usd = $this->exchangeRateService->convertCurrencyAmountToUsd($grossSalary, $salaryCurrency, $salaryRateSnapshot);
                $payment->salary_currency_code = $salaryCurrency;
                $payment->salary_exchange_rate_snapshot = $salaryRateSnapshot;
                $payment->advance_deducted = $advanceDeducted;
                $payment->advance_deducted_usd = $this->exchangeRateService->convertCurrencyAmountToUsd($advanceDeducted, $salaryCurrency, $salaryRateSnapshot);
                $payment->tax_percentage = $taxPercentage;
                $payment->tax_deducted = $taxDeducted;
                $payment->tax_deducted_usd = $this->exchangeRateService->convertCurrencyAmountToUsd($taxDeducted, $salaryCurrency, $salaryRateSnapshot);
                $payment->other_deductions = $otherDeductions;
                $payment->other_deductions_usd = $this->exchangeRateService->convertCurrencyAmountToUsd($otherDeductions, $salaryCurrency, $salaryRateSnapshot);
                $payment->net_salary = max(0, round($grossSalary - $advanceDeducted - $taxDeducted - $otherDeductions, 2));
                $payment->net_salary_usd = $this->exchangeRateService->convertCurrencyAmountToUsd($payment->net_salary, $salaryCurrency, $salaryRateSnapshot);
                $paymentStatus = strtolower(trim((string) ($payload['status'] ?? $payment->status ?? 'draft')));
                $payment->status = in_array($paymentStatus, ['paid', 'cancelled'], true) ? $paymentStatus : 'draft';
                $payment->account_id = array_key_exists('account_id', $payload)
                    ? ($payload['account_id'] !== null ? (int) $payload['account_id'] : null)
                    : $payment->account_id;
                $payment->user_id = array_key_exists('user_id', $payload)
                    ? ($payload['user_id'] !== null ? (int) $payload['user_id'] : null)
                    : ($payment->user_id ?: ($actorId > 0 ? $actorId : null));
                $payment->paid_at = array_key_exists('paid_at', $payload) && !empty($payload['paid_at'])
                    ? CarbonImmutable::parse((string) $payload['paid_at'])->toDateTimeString()
                    : (array_key_exists('paid_at', $payload) ? null : ($payment->status === 'paid' ? ($payment->paid_at ?: now()) : $payment->paid_at));
                $payment->save();

                $this->salaryAdvanceBalanceService->syncSalaryPaymentDeductions($payment);
                $this->accountLedgerService->syncSalaryPaymentPosting(
                    $payment,
                    $actorId > 0 ? $actorId : null
                );
            });

            return;
        }

        if ($entity === 'apartments') {
            if ($action === 'delete') {
                $apartment = Apartment::withTrashed()->where('uuid', $uuid)->first();
                if ($apartment && ! $apartment->trashed()) {
                    $apartment->delete();
                }

                return;
            }

            $apartmentCode = trim((string) ($payload['apartment_code'] ?? ''));
            $apartment = Apartment::withTrashed()->where('uuid', $uuid)->first();
            if (! $apartment && $apartmentCode !== '') {
                $apartment = Apartment::withTrashed()->where('apartment_code', $apartmentCode)->first();
            }

            if (! $apartment) {
                $apartment = new Apartment();
                $apartment->uuid = $uuid;
            } elseif ($apartment->trashed()) {
                $apartment->restore();
            }

            if (array_key_exists('apartment_code', $payload)) {
                $apartment->apartment_code = (string) $payload['apartment_code'];
            }
            if (array_key_exists('total_price', $payload)) {
                $apartment->total_price = $payload['total_price'] !== null ? max(0, (float) $payload['total_price']) : 0;
            }
            if (array_key_exists('usage_type', $payload)) {
                $apartment->usage_type = (string) $payload['usage_type'];
            }
            if (array_key_exists('block_number', $payload)) {
                $apartment->block_number = $payload['block_number'] !== null ? (string) $payload['block_number'] : null;
            }
            if (array_key_exists('unit_number', $payload)) {
                $apartment->unit_number = (string) $payload['unit_number'];
            }
            if (array_key_exists('floor_number', $payload)) {
                $apartment->floor_number = $payload['floor_number'] !== null ? (string) $payload['floor_number'] : null;
            }
            if (array_key_exists('bedrooms', $payload)) {
                $apartment->bedrooms = max(0, (int) $payload['bedrooms']);
            }
            if (array_key_exists('halls', $payload)) {
                $apartment->halls = max(0, (int) $payload['halls']);
            }
            if (array_key_exists('bathrooms', $payload)) {
                $apartment->bathrooms = max(0, (int) $payload['bathrooms']);
            }
            if (array_key_exists('kitchens', $payload)) {
                $apartment->kitchens = max(0, (int) $payload['kitchens']);
            }
            if (array_key_exists('balcony', $payload)) {
                $apartment->balcony = (bool) $payload['balcony'];
            }
            if (array_key_exists('area_sqm', $payload)) {
                $apartment->area_sqm = $payload['area_sqm'] !== null ? max(0, (float) $payload['area_sqm']) : null;
            }
            if (array_key_exists('apartment_shape', $payload)) {
                $apartment->apartment_shape = $payload['apartment_shape'] !== null ? (string) $payload['apartment_shape'] : null;
            }
            if (array_key_exists('corridor', $payload)) {
                $apartment->corridor = $payload['corridor'] !== null ? (string) $payload['corridor'] : null;
            }
            if (array_key_exists('north_boundary', $payload)) {
                $apartment->north_boundary = $payload['north_boundary'] !== null ? (string) $payload['north_boundary'] : null;
            }
            if (array_key_exists('south_boundary', $payload)) {
                $apartment->south_boundary = $payload['south_boundary'] !== null ? (string) $payload['south_boundary'] : null;
            }
            if (array_key_exists('east_boundary', $payload)) {
                $apartment->east_boundary = $payload['east_boundary'] !== null ? (string) $payload['east_boundary'] : null;
            }
            if (array_key_exists('west_boundary', $payload)) {
                $apartment->west_boundary = $payload['west_boundary'] !== null ? (string) $payload['west_boundary'] : null;
            }
            if (array_key_exists('status', $payload)) {
                $apartment->status = (string) $payload['status'];
            }
            if (array_key_exists('qr_code', $payload)) {
                $apartment->qr_code = $payload['qr_code'] !== null ? (string) $payload['qr_code'] : null;
            }
            if (array_key_exists('additional_info', $payload)) {
                $apartment->additional_info = $payload['additional_info'] !== null ? (string) $payload['additional_info'] : null;
            }

            $apartment->save();

            ApartmentQrAccessToken::query()->firstOrCreate(
                ['apartment_id' => $apartment->id],
                [
                    'uuid' => (string) Str::uuid(),
                    'token' => Str::random(64),
                    'status' => 'active',
                    'created_by_user_id' => $actorId > 0 ? $actorId : null,
                ]
            );

            return;
        }

        if ($entity === 'apartment_sales') {
            if ($action === 'delete') {
                $sale = ApartmentSale::withTrashed()->where('uuid', $uuid)->first();
                if ($sale) {
                    DB::transaction(function () use ($sale): void {
                        if (! $sale->trashed()) {
                            $state = $this->resolveSaleMutationState($sale);
                            if (!($state['can_delete'] ?? false)) {
                                abort(409, 'Sale cannot be deleted after approval, payment, completion, or cancellation.');
                            }
                        }

                        $apartmentId = (int) $sale->apartment_id;
                        $installmentIds = Installment::query()
                            ->where('apartment_sale_id', $sale->id)
                            ->pluck('id');

                        if ($installmentIds->isNotEmpty()) {
                            InstallmentPayment::query()->whereIn('installment_id', $installmentIds)->delete();
                        }
                        Installment::query()->where('apartment_sale_id', $sale->id)->delete();

                        if (! $sale->trashed()) {
                            $sale->delete();
                        }

                        ApartmentSaleFinancial::query()->where('apartment_sale_id', $sale->id)->delete();
                        $this->financials->refreshApartmentStatusForApartment($apartmentId);
                    });
                }

                return;
            }

            $sale = ApartmentSale::withTrashed()->where('uuid', $uuid)->first();
            $createdNewSale = false;
            if (! $sale) {
                $sale = new ApartmentSale();
                $sale->uuid = $uuid;
                $createdNewSale = true;
            } elseif ($sale->trashed()) {
                $sale->restore();
            }

            $normalized = $this->normalizeApartmentSalePayload($payload);
            if ($action === 'create') {
                $normalized['status'] = 'pending';
                $normalized['approved_at'] = null;
            }
            $state = $this->resolveSaleMutationState($sale);

            if ($action === 'update' && ($state['edit_scope'] ?? 'none') === 'none') {
                abort(409, 'Completed or cancelled sales cannot be updated.');
            }

            if (
                $action === 'update' &&
                ($state['edit_scope'] ?? 'none') === 'limited' &&
                $this->hasRestrictedSaleChanges($sale, $normalized)
            ) {
                abort(409, 'Only status update is allowed after approval or when payments exist.');
            }

            if ($action === 'update' && ($state['edit_scope'] ?? 'none') === 'limited') {
                $sale->status = (string) ($normalized['status'] ?? $sale->status);
                if ($actorId > 0) {
                    $sale->user_id = $actorId;
                }
                $sale->save();
                $financial = $this->financials->recalculateForSale($sale->fresh());
                if (! $this->isPendingApartmentSaleStatus($sale->status)) {
                    $this->workflow->ensurePaymentLetter($sale->fresh(), $financial);
                }
                return;
            }

            DB::transaction(function () use ($sale, $normalized, $actorId): void {
                $requestedSaleId = trim((string) ($normalized['sale_id'] ?? ''));
                $salePayload = $normalized;
                $terminationPayload = [
                    'termination_reason' => $salePayload['termination_reason'] ?? null,
                    'termination_charge' => $salePayload['termination_charge'] ?? 0,
                    'refund_amount' => $salePayload['refund_amount'] ?? 0,
                    'remaining_debt_after_termination' => $salePayload['remaining_debt_after_termination'] ?? 0,
                ];
                unset($salePayload['sale_id']);
                unset(
                    $salePayload['termination_reason'],
                    $salePayload['termination_charge'],
                    $salePayload['refund_amount'],
                    $salePayload['remaining_debt_after_termination']
                );
                if ($actorId > 0) {
                    $salePayload['user_id'] = $actorId;
                }

                $sale->fill($salePayload);
                $sale->save();

                if (trim((string) $sale->sale_id) === '') {
                    if ($requestedSaleId !== '' && $this->isSaleIdAvailable($requestedSaleId, (int) $sale->id)) {
                        $sale->sale_id = $requestedSaleId;
                    } else {
                        $sale->sale_id = $this->generateSaleId((int) $sale->id);
                    }
                    $sale->save();
                }

                $this->syncSaleTermination($sale, $terminationPayload);
                $this->syncSaleInstallments($sale, $normalized);
                $freshSale = $sale->fresh();
                $financial = $this->financials->recalculateForSale($freshSale);
                if (! $this->isPendingApartmentSaleStatus($freshSale->status)) {
                    $this->workflow->ensurePaymentLetter($freshSale, $financial);
                }
            });

            if ($action === 'create' && $createdNewSale) {
                $this->saleApprovalAlerts->notifyAdmins(
                    $sale->fresh(['customer:id,name', 'apartment:id,apartment_code,unit_number'])
                );
            }

            return;
        }

        if ($entity === 'apartment_sale_financials') {
            if ($action === 'delete') {
                $financial = ApartmentSaleFinancial::query()->where('uuid', $uuid)->first();
                if ($financial) {
                    $financial->delete();
                }
                return;
            }

            $saleId = (int) ($payload['apartment_sale_id'] ?? 0);
            $sale = $saleId > 0
                ? ApartmentSale::withTrashed()->where('id', $saleId)->first()
                : null;

            if (!$sale) {
                $saleUuid = trim((string) ($payload['sale_uuid'] ?? ''));
                if ($saleUuid !== '') {
                    $sale = ApartmentSale::withTrashed()->where('uuid', $saleUuid)->first();
                }
            }

            if (!$sale) {
                $sale = ApartmentSale::withTrashed()->where('uuid', $uuid)->first();
            }

            if (!$sale) {
                abort(422, 'Apartment sale not found for financial record.');
            }

            if ($this->isPendingApartmentSaleStatus($sale->status)) {
                abort(409, 'Admin approval is required before financial workflow can continue.');
            }

            $overrides = [];
            foreach ([
                'accounts_status',
                'delivered_to_municipality',
                'delivered_to_company',
                'rahnama_fee_1',
                'discount_or_contractor_deduction',
            ] as $key) {
                if (array_key_exists($key, $payload)) {
                    $overrides[$key] = $payload[$key];
                }
            }

            $freshSale = $sale->fresh();
            $financial = $this->financials->recalculateForSale($freshSale, $overrides);
            $this->workflow->ensurePaymentLetter($freshSale, $financial);
            return;
        }

        if ($entity === 'installments') {
            if ($action === 'delete') {
                $installment = Installment::query()->with('sale')->where('uuid', $uuid)->first();
                if ($installment) {
                    $sale = $installment->sale;
                    $installment->delete();
                    if ($sale) {
                        $freshSale = $sale->fresh();
                        $this->syncSaleStatusFromInstallments($freshSale);
                        $financial = $this->financials->recalculateForSale($freshSale);
                        if (! $this->isPendingApartmentSaleStatus($freshSale->status)) {
                            $this->workflow->ensurePaymentLetter($freshSale, $financial);
                        }
                    }
                }

                return;
            }

            if (array_key_exists('payment_amount', $payload)) {
                DB::transaction(function () use ($uuid, $payload, $actorId): void {
                    $installment = Installment::query()
                        ->with('sale')
                        ->where('uuid', $uuid)
                        ->lockForUpdate()
                        ->first();

                    if (! $installment && isset($payload['apartment_sale_id'], $payload['installment_no'])) {
                        $installment = Installment::query()
                            ->with('sale')
                            ->where('apartment_sale_id', (int) $payload['apartment_sale_id'])
                            ->where('installment_no', max(1, (int) $payload['installment_no']))
                            ->lockForUpdate()
                            ->first();
                    }

                    if (! $installment) {
                        abort(422, 'Installment not found for offline payment sync.');
                    }

                    $installment->loadMissing('sale.installments');
                    $sale = $installment->sale;
                    $saleStatus = strtolower(trim((string) ($sale?->status ?? '')));
                    if ($saleStatus === 'pending') {
                        abort(409, 'Admin approval is required before recording installment payments.');
                    }
                    if (in_array($saleStatus, ['cancelled', 'terminated', 'defaulted'], true)) {
                        abort(409, 'Cannot apply payment on cancelled/terminated/defaulted sale.');
                    }

                    $scaledAmounts = $sale
                        ? ApartmentSaleCustomerAmounts::installmentAmounts($sale, $sale->installments)
                        : [];
                    $amountKey = $installment->id ? 'id:' . $installment->id : (!empty($installment->uuid) ? 'uuid:' . $installment->uuid : null);
                    $total = $amountKey && array_key_exists($amountKey, $scaledAmounts)
                        ? round((float) $scaledAmounts[$amountKey], 2)
                        : round((float) ($installment->amount ?? 0), 2);
                    $currentPaid = round((float) ($installment->paid_amount ?? 0), 2);
                    $remaining = max(0, round($total - $currentPaid, 2));
                    if ($remaining <= 0) {
                        return;
                    }

                    $requested = max(0, round((float) ($payload['payment_amount'] ?? 0), 2));
                    if ($requested <= 0) {
                        abort(422, 'Payment amount must be greater than 0.');
                    }

                    $applied = min($requested, $remaining);
                    $newPaid = round($currentPaid + $applied, 2);
                    $paidDate = ! empty($payload['paid_date'])
                        ? CarbonImmutable::parse((string) $payload['paid_date'])->toDateString()
                        : now()->toDateString();
                    $paymentMethod = trim((string) ($payload['payment_method'] ?? 'cash')) ?: 'cash';
                    $accountId = (int) ($payload['account_id'] ?? 0);
                    if ($accountId <= 0) {
                        abort(422, 'Payment account is required.');
                    }

                    $installment->paid_amount = $newPaid;
                    $installment->paid_date = $paidDate;
                    $installment->status = $this->deriveInstallmentStatus(
                        $newPaid,
                        $total,
                        $installment->due_date ? CarbonImmutable::parse((string) $installment->due_date)->toDateString() : null
                    );
                    $installment->save();

                    $payment = InstallmentPayment::query()->create([
                        'uuid' => (string) Str::uuid(),
                        'installment_id' => $installment->id,
                        'amount' => $applied,
                        'payment_date' => CarbonImmutable::parse($paidDate)->toDateTimeString(),
                        'payment_method' => $paymentMethod,
                        'reference_no' => isset($payload['reference_no']) ? trim((string) $payload['reference_no']) ?: null : null,
                        'notes' => isset($payload['notes']) ? trim((string) $payload['notes']) ?: null : null,
                        'received_by' => $actorId > 0 ? $actorId : null,
                        'account_id' => $accountId,
                    ]);

                    $posting = $this->accountLedgerService->postModuleTransaction(
                        accountId: $accountId,
                        sourceAmount: $applied,
                        sourceCurrency: 'USD',
                        direction: 'in',
                        module: 'sales',
                        referenceType: 'installment_payment',
                        referenceUuid: $payment->uuid,
                        description: sprintf(
                            'Installment payment received for sale %s installment #%d',
                            trim((string) ($sale?->sale_id ?: $sale?->uuid ?: $installment->apartment_sale_id)),
                            (int) $installment->installment_no
                        ),
                        paymentMethod: $paymentMethod,
                        transactionDate: $payment->payment_date,
                        actorId: $actorId > 0 ? $actorId : null,
                        metadata: [
                            'installment_id' => $installment->id,
                            'installment_uuid' => $installment->uuid,
                            'apartment_sale_id' => $installment->apartment_sale_id,
                            'apartment_sale_uuid' => $sale?->uuid,
                            'sale_id' => $sale?->sale_id,
                        ]
                    );

                    $payment->account_transaction_id = $posting['transaction']->id;
                    $payment->payment_currency_code = $posting['account_currency'];
                    $payment->exchange_rate_snapshot = $posting['exchange_rate_snapshot'];
                    $payment->account_amount = $posting['account_amount'];
                    $payment->saveQuietly();

                    if ($sale) {
                        $this->syncSaleStatusFromInstallments($sale);
                        $freshSale = $sale->fresh();
                        $financial = $this->financials->recalculateForSale($freshSale);
                        if (! $this->isPendingApartmentSaleStatus($freshSale->status)) {
                            $this->workflow->ensurePaymentLetter($freshSale, $financial);
                        }
                    }
                });

                return;
            }

            $installment = Installment::query()->with('sale')->where('uuid', $uuid)->first();
            if (! $installment && isset($payload['apartment_sale_id'], $payload['installment_no'])) {
                $installment = Installment::query()
                    ->with('sale')
                    ->where('apartment_sale_id', (int) $payload['apartment_sale_id'])
                    ->where('installment_no', max(1, (int) $payload['installment_no']))
                    ->first();
            }

            if (! $installment) {
                $installment = new Installment();
                $installment->uuid = $uuid;
            }

            if (array_key_exists('apartment_sale_id', $payload)) {
                $installment->apartment_sale_id = (int) $payload['apartment_sale_id'];
            }
            if (array_key_exists('installment_no', $payload)) {
                $installment->installment_no = max(1, (int) $payload['installment_no']);
            }
            if (array_key_exists('amount', $payload)) {
                $installment->amount = max(0, round((float) $payload['amount'], 2));
            }
            if (array_key_exists('due_date', $payload)) {
                $installment->due_date = CarbonImmutable::parse((string) $payload['due_date'])->toDateString();
            }
            if (array_key_exists('paid_amount', $payload)) {
                $installment->paid_amount = max(0, round((float) $payload['paid_amount'], 2));
            }
            if ((float) $installment->paid_amount > (float) $installment->amount) {
                $installment->paid_amount = $installment->amount;
            }
            if (array_key_exists('paid_date', $payload)) {
                $installment->paid_date = $payload['paid_date']
                    ? CarbonImmutable::parse((string) $payload['paid_date'])->toDateString()
                    : null;
            }

            $status = array_key_exists('status', $payload) ? (string) $payload['status'] : null;
            if (!in_array($status, ['pending', 'paid', 'overdue', 'cancelled'], true)) {
                $dueDateForStatus = $installment->due_date
                    ? CarbonImmutable::parse((string) $installment->due_date)->toDateString()
                    : null;
                $status = $this->deriveInstallmentStatus(
                    (float) ($installment->paid_amount ?? 0),
                    (float) ($installment->amount ?? 0),
                    $dueDateForStatus
                );
            }
            $installment->status = $status;
            $installment->save();

            $installment->loadMissing('sale');
            if ($installment->sale) {
                $this->syncSaleStatusFromInstallments($installment->sale);
                $freshSale = $installment->sale->fresh();
                $financial = $this->financials->recalculateForSale($freshSale);
                if (! $this->isPendingApartmentSaleStatus($freshSale->status)) {
                    $this->workflow->ensurePaymentLetter($freshSale, $financial);
                }
            }
        }
    }

    private function normalizeApartmentSalePayload(array $payload): array
    {
        $totalPrice = max(0, round((float) ($payload['total_price'] ?? 0), 2));
        $discount = max(0, round((float) ($payload['discount'] ?? 0), 2));
        if ($discount > $totalPrice) {
            $discount = $totalPrice;
        }

        $paymentType = (string) ($payload['payment_type'] ?? 'full');
        $paymentType = $paymentType === 'installment' ? 'installment' : 'full';

        $status = (string) ($payload['status'] ?? 'active');
        if (!in_array($status, ['active', 'pending', 'approved', 'completed', 'cancelled', 'defaulted', 'terminated'], true)) {
            $status = 'active';
        }

        $frequencyType = (string) ($payload['frequency_type'] ?? 'monthly');
        if (!in_array($frequencyType, ['weekly', 'monthly', 'quarterly', 'custom_dates'], true)) {
            $frequencyType = 'monthly';
        }

        $customDates = collect((array) ($payload['custom_dates'] ?? []))
            ->map(function ($row, int $index): array {
                $item = is_array($row) ? $row : [];
                return [
                    'installment_no' => max(1, (int) ($item['installment_no'] ?? ($index + 1))),
                    'due_date' => isset($item['due_date']) ? (string) $item['due_date'] : now()->toDateString(),
                    'amount' => max(0, round((float) ($item['amount'] ?? 0), 2)),
                ];
            })
            ->values()
            ->all();

        $installmentCount = max(0, (int) ($payload['installment_count'] ?? 0));
        if ($frequencyType === 'custom_dates' && $installmentCount === 0) {
            $installmentCount = count($customDates);
        }

        $scheduleLocked = (bool) ($payload['schedule_locked'] ?? false);
        $scheduleLockedAt = $payload['schedule_locked_at'] ?? null;
        if ($scheduleLocked && !$scheduleLockedAt) {
            $scheduleLockedAt = now();
        }
        if (!$scheduleLocked) {
            $scheduleLockedAt = null;
        }

        $netPrice = $payload['net_price'] ?? ($totalPrice - $discount);
        $netPrice = max(0, round((float) $netPrice, 2));
        $keyHandoverStatus = (string) ($payload['key_handover_status'] ?? 'not_handed_over');
        if (!in_array($keyHandoverStatus, ['not_handed_over', 'handed_over', 'returned'], true)) {
            $keyHandoverStatus = 'not_handed_over';
        }

        return [
            'sale_id' => isset($payload['sale_id']) ? trim((string) $payload['sale_id']) : null,
            'apartment_id' => (int) ($payload['apartment_id'] ?? 0),
            'customer_id' => (int) ($payload['customer_id'] ?? 0),
            'sale_date' => (string) ($payload['sale_date'] ?? now()->toDateString()),
            'total_price' => $totalPrice,
            'discount' => $discount,
            'payment_type' => $paymentType,
            'status' => $status,
            'frequency_type' => $paymentType === 'installment' ? $frequencyType : null,
            'interval_count' => max(1, (int) ($payload['interval_count'] ?? 1)),
            'installment_count' => $paymentType === 'installment' ? $installmentCount : null,
            'first_due_date' => $paymentType === 'installment' ? ($payload['first_due_date'] ?? $payload['sale_date'] ?? now()->toDateString()) : null,
            'custom_dates' => $paymentType === 'installment' ? $customDates : null,
            'schedule_locked' => $scheduleLocked,
            'schedule_locked_at' => $scheduleLockedAt,
            'approved_at' => $payload['approved_at'] ?? null,
            'net_price' => $netPrice,
            'key_handover_status' => $keyHandoverStatus,
            'key_handover_at' => $payload['key_handover_at'] ?? null,
            'key_handover_by' => $payload['key_handover_by'] ?? null,
            'possession_start_date' => $payload['possession_start_date'] ?? null,
            'vacated_at' => $payload['vacated_at'] ?? null,
            'key_returned_at' => $payload['key_returned_at'] ?? null,
            'key_returned_by' => $payload['key_returned_by'] ?? null,
            'termination_reason' => isset($payload['termination_reason']) ? (string) $payload['termination_reason'] : null,
            'termination_charge' => max(0, round((float) ($payload['termination_charge'] ?? 0), 2)),
            'refund_amount' => max(0, round((float) ($payload['refund_amount'] ?? 0), 2)),
            'remaining_debt_after_termination' => max(0, round((float) ($payload['remaining_debt_after_termination'] ?? 0), 2)),
        ];
    }

    private function syncSaleTermination(ApartmentSale $sale, array $payload): void
    {
        $reason = trim((string) ($payload['termination_reason'] ?? ''));
        $terminationCharge = max(0, round((float) ($payload['termination_charge'] ?? 0), 2));
        $refundAmount = max(0, round((float) ($payload['refund_amount'] ?? 0), 2));
        $remainingDebt = max(0, round((float) ($payload['remaining_debt_after_termination'] ?? 0), 2));
        $saleStatus = strtolower(trim((string) ($sale->status ?? '')));

        $hasTerminationData =
            $reason !== '' ||
            $terminationCharge > 0 ||
            $refundAmount > 0 ||
            $remainingDebt > 0 ||
            in_array($saleStatus, ['terminated', 'defaulted'], true);

        if (!$hasTerminationData) {
            $sale->termination()->delete();
            return;
        }

        $sale->termination()->updateOrCreate(
            ['apartment_sale_id' => $sale->id],
            [
                'reason' => $reason !== '' ? $reason : null,
                'termination_charge' => $terminationCharge,
                'refund_amount' => $refundAmount,
                'remaining_debt_after_termination' => $remainingDebt,
            ]
        );
    }

    private function syncSaleInstallments(ApartmentSale $sale, array $payload): void
    {
        $rows = [];
        $now = now();
        $customerReceivable = ApartmentSaleCustomerAmounts::companyShare($sale);

        if ($sale->payment_type !== 'installment') {
            $amount = $customerReceivable;
            if ($amount > 0) {
                $dueDate = CarbonImmutable::parse((string) $sale->sale_date)->toDateString();
                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'apartment_sale_id' => $sale->id,
                    'installment_no' => 1,
                    'amount' => $amount,
                    'due_date' => $dueDate,
                    'paid_amount' => 0,
                    'paid_date' => null,
                    'status' => $this->deriveInstallmentStatus(0, $amount, $dueDate),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            Installment::query()->where('apartment_sale_id', $sale->id)->delete();
            if (!empty($rows)) {
                Installment::query()->insert($rows);
            }
            return;
        }

        $frequency = (string) ($payload['frequency_type'] ?? 'monthly');

        if ($frequency === 'custom_dates') {
            $draftRows = [];
            foreach ((array) ($payload['custom_dates'] ?? []) as $idx => $item) {
                $amount = max(0, round((float) ($item['amount'] ?? 0), 2));
                if ($amount <= 0) {
                    continue;
                }

                $draftRows[] = [
                    'uuid' => (string) Str::uuid(),
                    'apartment_sale_id' => $sale->id,
                    'installment_no' => max(1, (int) ($item['installment_no'] ?? ($idx + 1))),
                    'amount' => $amount,
                    'due_date' => CarbonImmutable::parse((string) ($item['due_date'] ?? $sale->sale_date))->toDateString(),
                    'paid_amount' => 0,
                    'paid_date' => null,
                    'status' => $this->deriveInstallmentStatus(
                        0,
                        $amount,
                        CarbonImmutable::parse((string) ($item['due_date'] ?? $sale->sale_date))->toDateString()
                    ),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            usort($draftRows, fn (array $a, array $b): int => $a['installment_no'] <=> $b['installment_no']);
            $amountCents = ApartmentSaleCustomerAmounts::distributeCents(
                (int) round($customerReceivable * 100),
                array_map(static fn (array $row): int => (int) round(((float) $row['amount']) * 100), $draftRows),
            );

            foreach ($draftRows as $index => $row) {
                $adjustedAmount = round(($amountCents[$index] ?? 0) / 100, 2);
                if ($adjustedAmount <= 0) {
                    continue;
                }

                $row['amount'] = $adjustedAmount;
                $row['status'] = $this->deriveInstallmentStatus(0, $adjustedAmount, $row['due_date']);
                $rows[] = $row;
            }
        } else {
            $count = max(1, (int) ($payload['installment_count'] ?? 1));
            $interval = max(1, (int) ($payload['interval_count'] ?? 1));
            $startDate = CarbonImmutable::parse((string) ($payload['first_due_date'] ?? $sale->sale_date))->startOfDay();

            $totalCents = (int) round($customerReceivable * 100);
            $base = intdiv($totalCents, $count);
            $remainder = $totalCents % $count;

            for ($i = 1; $i <= $count; $i++) {
                $amountCents = $base + ($i <= $remainder ? 1 : 0);
                $offset = $i - 1;
                if ($frequency === 'weekly') {
                    $dueDate = $startDate->addWeeks($offset * $interval);
                } elseif ($frequency === 'quarterly') {
                    $dueDate = $startDate->addMonths($offset * $interval * 3);
                } else {
                    $dueDate = $startDate->addMonths($offset * $interval);
                }

                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'apartment_sale_id' => $sale->id,
                    'installment_no' => $i,
                    'amount' => round($amountCents / 100, 2),
                    'due_date' => $dueDate->toDateString(),
                    'paid_amount' => 0,
                    'paid_date' => null,
                    'status' => $this->deriveInstallmentStatus(0, round($amountCents / 100, 2), $dueDate->toDateString()),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        Installment::query()->where('apartment_sale_id', $sale->id)->delete();
        if (!empty($rows)) {
            Installment::query()->insert($rows);
        }
    }

    private function syncSaleStatusFromInstallments(ApartmentSale $sale): void
    {
        if (in_array($sale->status, ['cancelled', 'terminated', 'defaulted'], true)) {
            return;
        }

        $sale->loadMissing('installments');
        $hasUnpaid = ApartmentSaleCustomerAmounts::hasUnpaidInstallments($sale, $sale->installments);

        if (! $hasUnpaid) {
            if ($sale->status !== 'completed') {
                $sale->status = 'completed';
                $sale->save();
            }

            return;
        }

        if ($sale->status === 'completed') {
            $sale->status = 'active';
            $sale->save();
        }
    }

    private function deriveInstallmentStatus(float $paidAmount, float $amount, ?string $dueDate): string
    {
        if ($paidAmount >= $amount) {
            return 'paid';
        }
        if ($dueDate && CarbonImmutable::parse($dueDate)->isBefore(now()->startOfDay())) {
            return 'overdue';
        }

        return 'pending';
    }

    private function resolveSaleMutationState(ApartmentSale $sale): array
    {
        $agg = Installment::query()
            ->where('apartment_sale_id', $sale->id)
            ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_total, COUNT(*) as rows_count')
            ->first();

        $paidTotal = round((float) ($agg?->paid_total ?? 0), 2);
        $rowsCount = (int) ($agg?->rows_count ?? 0);
        $hasPaidInstallments = $paidTotal > 0;
        $status = strtolower(trim((string) $sale->status));
        $deedIssued = strtolower(trim((string) ($sale->deed_status ?? 'not_issued'))) === 'issued';
        $isCompletedOrCancelled = in_array($status, ['completed', 'cancelled', 'terminated', 'defaulted'], true);
        $fullAccess = in_array($status, ['pending', 'active'], true) && !$hasPaidInstallments;
        $limitedAccess = !$isCompletedOrCancelled && ($status === 'approved' || $hasPaidInstallments);
        $editScope = $deedIssued ? 'none' : ($fullAccess ? 'full' : ($limitedAccess ? 'limited' : 'none'));

        return [
            'installments_count' => $rowsCount,
            'installments_paid_total' => $paidTotal,
            'has_paid_installments' => $hasPaidInstallments,
            'edit_scope' => $editScope,
            'can_update' => $editScope !== 'none',
            'can_delete' => $editScope === 'full',
        ];
    }

    private function hasRestrictedSaleChanges(ApartmentSale $sale, array $incoming): bool
    {
        $existingCustom = $this->normalizeCustomDates($sale->custom_dates ?? []);
        $incomingCustom = $this->normalizeCustomDates($incoming['custom_dates'] ?? []);
        $incomingSaleId = trim((string) ($incoming['sale_id'] ?? ''));
        $saleIdChanged = $incomingSaleId !== '' && trim((string) ($sale->sale_id ?? '')) !== $incomingSaleId;

        return
            $saleIdChanged ||
            (int) ($sale->apartment_id ?? 0) !== (int) ($incoming['apartment_id'] ?? 0) ||
            (int) ($sale->customer_id ?? 0) !== (int) ($incoming['customer_id'] ?? 0) ||
            $this->toDateString($sale->sale_date) !== $this->toDateString($incoming['sale_date'] ?? null) ||
            round((float) ($sale->total_price ?? 0), 2) !== round((float) ($incoming['total_price'] ?? 0), 2) ||
            round((float) ($sale->discount ?? 0), 2) !== round((float) ($incoming['discount'] ?? 0), 2) ||
            (string) ($sale->payment_type ?? '') !== (string) ($incoming['payment_type'] ?? '') ||
            (string) ($sale->frequency_type ?? '') !== (string) ($incoming['frequency_type'] ?? '') ||
            (int) ($sale->interval_count ?? 0) !== (int) ($incoming['interval_count'] ?? 0) ||
            (int) ($sale->installment_count ?? 0) !== (int) ($incoming['installment_count'] ?? 0) ||
            $this->toDateString($sale->first_due_date) !== $this->toDateString($incoming['first_due_date'] ?? null) ||
            $existingCustom !== $incomingCustom ||
            (bool) ($sale->schedule_locked ?? false) !== (bool) ($incoming['schedule_locked'] ?? false) ||
            round((float) ($sale->net_price ?? 0), 2) !== round((float) ($incoming['net_price'] ?? 0), 2);
    }

    private function normalizeCustomDates(array $rows): string
    {
        $normalized = collect($rows)
            ->map(function ($row, int $index): array {
                $item = is_array($row) ? $row : [];
                return [
                    'installment_no' => max(1, (int) ($item['installment_no'] ?? ($index + 1))),
                    'due_date' => $this->toDateString($item['due_date'] ?? null) ?? now()->toDateString(),
                    'amount' => round((float) ($item['amount'] ?? 0), 2),
                ];
            })
            ->sortBy('installment_no')
            ->values()
            ->all();

        return json_encode($normalized, JSON_UNESCAPED_SLASHES) ?: '[]';
    }

    private function toDateString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return CarbonImmutable::parse((string) $value)->toDateString();
    }

    private function generateSaleId(int $id): string
    {
        return 'SAL-' . str_pad((string) max(1, $id), 6, '0', STR_PAD_LEFT);
    }

    private function isSaleIdAvailable(string $saleId, int $currentId): bool
    {
        return ! ApartmentSale::withTrashed()
            ->where('sale_id', $saleId)
            ->where('id', '!=', $currentId)
            ->exists();
    }

    private function isPendingApartmentSaleStatus(?string $status): bool
    {
        return strtolower(trim((string) ($status ?? ''))) === 'pending';
    }
}


