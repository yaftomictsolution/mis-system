<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Apartment;
use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use App\Models\Customer;
use App\Models\Installment;
use App\Models\Roles;
use App\Models\User;
use App\Services\ApartmentSaleFinancialService;
use App\Services\MunicipalityWorkflowService;
use App\Services\SaleCreatedFinanceAlertService;
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
        private readonly SaleCreatedFinanceAlertService $saleCreatedAlerts
    )
    {
    }

    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['required', 'string'],
            'entity' => ['required', Rule::in(['customers', 'roles', 'users', 'apartments', 'apartment_sales', 'installments', 'apartment_sale_financials'])],
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
            ]);

            return;
        }

        if ($entity === 'customers') {
            $existing = Customer::withTrashed()->where('uuid', $uuid)->first();

            $request->validate([
                'payload.name' => ['required', 'string', 'max:255'],
                'payload.fname' => ['nullable', 'string', 'max:255'],
                'payload.gname' => ['nullable', 'string', 'max:255'],
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

        if ($entity === 'installments') {
            $request->validate([
                'payload.apartment_sale_id' => ['required', 'integer', 'min:1', Rule::exists('apartment_sales', 'id')],
                'payload.installment_no' => ['required', 'integer', 'min:1'],
                'payload.amount' => ['required', 'numeric', 'min:0'],
                'payload.due_date' => ['required', 'date'],
                'payload.paid_amount' => ['nullable', 'numeric', 'min:0'],
                'payload.paid_date' => ['nullable', 'date'],
                'payload.status' => ['nullable', Rule::in(['pending', 'paid', 'overdue', 'cancelled'])],
                'payload.updated_at' => ['nullable'],
            ]);
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
            $user->save();

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
            return;
        }

        if ($entity === 'apartment_sales') {
            if ($action === 'delete') {
                $sale = ApartmentSale::withTrashed()->where('uuid', $uuid)->first();
                if ($sale) {
                    if (! $sale->trashed()) {
                        $state = $this->resolveSaleMutationState($sale);
                        if (!($state['can_delete'] ?? false)) {
                            abort(409, 'Sale cannot be deleted after approval, payment, completion, or cancellation.');
                        }
                        $sale->delete();
                    }
                    ApartmentSaleFinancial::query()->where('apartment_sale_id', $sale->id)->delete();
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
                $this->workflow->ensurePaymentLetter($sale->fresh(), $financial);
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
                $this->workflow->ensurePaymentLetter($freshSale, $financial);
            });

            if ($action === 'create' && $createdNewSale) {
                $this->saleCreatedAlerts->notifyFinance(
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
                        $this->workflow->ensurePaymentLetter($freshSale, $financial);
                    }
                }

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
                $this->workflow->ensurePaymentLetter($freshSale, $financial);
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
        if ($sale->payment_type !== 'installment') {
            Installment::query()->where('apartment_sale_id', $sale->id)->delete();
            return;
        }

        $rows = [];
        $now = now();
        $frequency = (string) ($payload['frequency_type'] ?? 'monthly');

        if ($frequency === 'custom_dates') {
            foreach ((array) ($payload['custom_dates'] ?? []) as $idx => $item) {
                $amount = max(0, round((float) ($item['amount'] ?? 0), 2));
                if ($amount <= 0) {
                    continue;
                }

                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'apartment_sale_id' => $sale->id,
                    'installment_no' => max(1, (int) ($item['installment_no'] ?? ($idx + 1))),
                    'amount' => $amount,
                    'due_date' => CarbonImmutable::parse((string) ($item['due_date'] ?? $sale->sale_date))->toDateString(),
                    'paid_amount' => 0,
                    'paid_date' => null,
                    'status' => 'pending',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        } else {
            $count = max(1, (int) ($payload['installment_count'] ?? 1));
            $interval = max(1, (int) ($payload['interval_count'] ?? 1));
            $startDate = CarbonImmutable::parse((string) ($payload['first_due_date'] ?? $sale->sale_date))->startOfDay();

            $totalCents = (int) round(max(0, (float) $sale->net_price) * 100);
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
                    'status' => 'pending',
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

        $hasUnpaid = $sale->installments()
            ->where(function ($builder): void {
                $builder
                    ->whereRaw('paid_amount < amount')
                    ->orWhere('status', '!=', 'paid');
            })
            ->exists();

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
}
