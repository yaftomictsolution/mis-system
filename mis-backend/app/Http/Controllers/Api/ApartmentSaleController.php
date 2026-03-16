<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreApartmentSaleRequest;
use App\Models\ApartmentSaleFinancial;
use App\Models\ApartmentSalePossessionLog;
use App\Models\ApartmentSale;
use App\Models\Installment;
use App\Models\InstallmentPayment;
use App\Services\ApartmentSaleFinancialService;
use App\Services\MunicipalityWorkflowService;
use App\Services\SaleCreatedFinanceAlertService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ApartmentSaleController extends Controller
{
    private const DEFAULTED_MIN_CHARGE_RATE = 0.20;

    public function __construct(
        private readonly ApartmentSaleFinancialService $financials,
        private readonly MunicipalityWorkflowService $workflow,
        private readonly SaleCreatedFinanceAlertService $saleCreatedAlerts
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $offline = $request->boolean('offline');
        $since = $validated['since'] ?? null;
        $includeDeleted = $offline || !is_null($since);

        $query = ApartmentSale::query()
            ->select([
                'id',
                'uuid',
                'sale_id',
                'apartment_id',
                'customer_id',
                'user_id',
                'sale_date',
                'total_price',
                'discount',
                'payment_type',
                'frequency_type',
                'interval_count',
                'installment_count',
                'first_due_date',
                'custom_dates',
                'schedule_locked',
                'schedule_locked_at',
                'approved_at',
                'net_price',
                'actual_net_revenue',
                'status',
                'deed_status',
                'deed_issued_at',
                'deed_issued_by',
                'key_handover_status',
                'key_handover_at',
                'key_handover_by',
                'possession_start_date',
                'vacated_at',
                'key_returned_at',
                'key_returned_by',
                'updated_at',
                'deleted_at',
            ])
            ->withSum('installments as installments_paid_total', 'paid_amount')
            ->with([
                'financial:id,uuid,apartment_sale_id,accounts_status,municipality_share_15,delivered_to_municipality,remaining_municipality,company_share_85,delivered_to_company,rahnama_fee_1,customer_debt,discount_or_contractor_deduction,updated_at',
                'termination:id,apartment_sale_id,reason,termination_charge,refund_amount,remaining_debt_after_termination,updated_at',
            ])
            ->withCount('installments as installments_count')
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('uuid', 'like', "%{$search}%")
                    ->orWhere('sale_id', 'like', "%{$search}%")
                    ->orWhere('apartment_id', 'like', "%{$search}%")
                    ->orWhere('customer_id', 'like', "%{$search}%")
                    ->orWhere('payment_type', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('frequency_type', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['since'])) {
            $query->where(function ($builder) use ($validated) {
                $builder
                    ->where('updated_at', '>', $validated['since'])
                    ->orWhere('deleted_at', '>', $validated['since']);
            });
        }

        if (!empty($validated['offline'])) {
            $windowStart = now()->subMonths(6);
            $query->where(function ($builder) use ($windowStart) {
                $builder
                    ->where('updated_at', '>=', $windowStart)
                    ->orWhere(function ($deleted) use ($windowStart) {
                        $deleted
                            ->whereNotNull('deleted_at')
                            ->where('deleted_at', '>=', $windowStart);
                    });
            });
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(fn (ApartmentSale $sale) => $this->salePayload($sale))
            ->values()
            ->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }



    public function store(StoreApartmentSaleRequest $request): JsonResponse
    {
        $data = $this->normalizeSaleInput($request->validated());
        $actorId = (int) (optional($request->user())->id ?? 0);
        $incomingUuid = (string) ($data['uuid'] ?? '');

        $sale = null;
        if ($incomingUuid !== '') {
            $sale = ApartmentSale::withTrashed()->where('uuid', $incomingUuid)->first();
        }

        $created = false;
        $restored = false;
        if (!$sale) {
            $sale = new ApartmentSale();
            $sale->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($sale->trashed()) {
            $sale->restore();
            $restored = true;
        }

        if ($this->hasBlockingDuplicateSale($data, $sale->exists ? (int) $sale->id : null)) {
            return response()->json([
                'message' => 'This customer already has a sale for the selected apartment.',
            ], 409);
        }

        DB::transaction(function () use ($sale, $data, $actorId): void {
            $this->fillAndSaveSale($sale, $data, $actorId);
            $this->syncInstallmentsForSale($sale, $data);
            $financial = $this->financials->recalculateForSale($sale);
            $this->workflow->ensurePaymentLetter($sale, $financial);
        });

        if ($created) {
            $this->saleCreatedAlerts->notifyFinance(
                $sale->fresh(['customer:id,name', 'apartment:id,apartment_code,unit_number'])
            );
        }

        return response()->json([
            'data' => $this->salePayload($sale->fresh()),
            'restored' => $restored,
        ], $created ? 201 : 200);

    }

    public function update(StoreApartmentSaleRequest $request, string $uuid): JsonResponse
    {
        $sale = ApartmentSale::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($sale->trashed()) {
            $sale->restore();
        }

        $data = $this->normalizeSaleInput($request->validated());
        $actorId = (int) (optional($request->user())->id ?? 0);
        unset($data['uuid']);

        if ($this->hasBlockingDuplicateSale($data, (int) $sale->id)) {
            return response()->json([
                'message' => 'This customer already has a sale for the selected apartment.',
            ], 409);
        }

        $state = $this->resolveSaleMutationState($sale);

        if ($state['edit_scope'] === 'none') {
            return response()->json([
                'message' => 'Completed/cancelled/terminated/defaulted sales cannot be updated.',
            ], 409);
        }

        if ($state['edit_scope'] === 'limited' && $this->hasRestrictedSaleChanges($sale, $data)) {
            return response()->json([
                'message' => 'Only status update is allowed after approval or when payments exist.',
            ], 409);
        }

        if ($state['edit_scope'] === 'limited') {
            $sale->status = $data['status'];
            if ($actorId > 0) {
                $sale->user_id = $actorId;
            }
            $sale->save();
        } else {
            DB::transaction(function () use ($sale, $data, $actorId): void {
                $this->fillAndSaveSale($sale, $data, $actorId);
                $this->syncInstallmentsForSale($sale, $data);
                $financial = $this->financials->recalculateForSale($sale);
                $this->workflow->ensurePaymentLetter($sale, $financial);
            });
        }

        if ($state['edit_scope'] === 'limited') {
            $this->financials->recalculateForSale($sale);
        }

        return response()->json([
            'data' => $this->salePayload($sale->fresh()),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $sale = ApartmentSale::withTrashed()->where('uuid', $uuid)->first();
        if ($sale && !$sale->trashed()) {
            $state = $this->resolveSaleMutationState($sale);
            if (!$state['can_delete']) {
                return response()->json([
                    'message' => 'Sale cannot be deleted after approval, payment, completion, cancellation, termination, or default.',
                ], 409);
            }
            $sale->delete();
            ApartmentSaleFinancial::query()->where('apartment_sale_id', $sale->id)->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function issueDeed(Request $request, string $uuid): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->can('sales.approve')) {
            return response()->json([
                'message' => 'Only admin users can approve and issue ownership deed.',
            ], 403);
        }

        $sale = ApartmentSale::query()
            ->with(['apartment', 'financial'])
            ->where('uuid', $uuid)
            ->firstOrFail();

        $deedStatus = strtolower(trim((string) ($sale->deed_status ?? 'not_issued')));
        if ($deedStatus === 'issued') {
            return response()->json([
                'message' => 'Ownership deed already issued.',
                'data' => $this->salePayload($sale->fresh()),
            ]);
        }

        if (in_array(strtolower(trim((string) $sale->status)), ['cancelled', 'terminated', 'defaulted'], true)) {
            return response()->json([
                'message' => 'Cannot issue deed for cancelled/terminated/defaulted sale.',
            ], 409);
        }

        $financial = $this->financials->recalculateForSale($sale->fresh());
        $sale = $sale->fresh();

        if (strtolower(trim((string) $sale->status)) !== 'completed') {
            return response()->json([
                'message' => 'Deed can be issued only after sale status is completed.',
            ], 409);
        }

        $hasUnpaidInstallment = $sale->installments()->whereRaw('paid_amount < amount')->exists();
        if ($hasUnpaidInstallment) {
            return response()->json([
                'message' => 'Deed cannot be issued until all installments are fully paid.',
            ], 409);
        }

        if ((float) $financial->customer_debt > 0.0001) {
            return response()->json([
                'message' => 'Deed cannot be issued while customer debt is remaining.',
            ], 409);
        }

        if ((float) $financial->remaining_municipality > 0.0001) {
            return response()->json([
                'message' => 'Deed cannot be issued until municipality share is fully settled.',
            ], 409);
        }

        $actorId = (int) $actor->id;

        DB::transaction(function () use ($sale, $actorId): void {
            $currentHandoverStatus = strtolower(trim((string) ($sale->key_handover_status ?? 'not_handed_over')));

            $sale->deed_status = 'issued';
            $sale->deed_issued_at = now();
            $sale->deed_issued_by = $actorId;

            if ($currentHandoverStatus !== 'handed_over') {
                $sale->key_handover_status = 'handed_over';
                $sale->key_handover_at = now();
                $sale->key_handover_by = $actorId;
                if (!$sale->possession_start_date) {
                    $sale->possession_start_date = now()->toDateString();
                }
            }

            $sale->save();

            if ($sale->apartment) {
                $sale->apartment->status = 'sold';
                $sale->apartment->save();
            }

            if ($currentHandoverStatus !== 'handed_over') {
                $this->logPossessionAction(
                    $sale,
                    'key_handover',
                    $actorId,
                    'Key possession auto-marked as handed over during deed issuance.'
                );
            }
        });

        return response()->json([
            'message' => 'Ownership deed issued successfully.',
            'data' => $this->salePayload($sale->fresh()),
        ]);
    }

    public function installmentPayments(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $sale = ApartmentSale::query()->where('uuid', $uuid)->firstOrFail();
        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);

        $installmentIds = Installment::query()
            ->where('apartment_sale_id', $sale->id)
            ->pluck('id');

        $query = InstallmentPayment::query()
            ->with(['installment:id,uuid,apartment_sale_id,installment_no', 'receiver:id,name'])
            ->whereIn('installment_id', $installmentIds)
            ->orderByDesc('payment_date')
            ->orderByDesc('id');

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(function (InstallmentPayment $payment) use ($sale): array {
                return [
                    'id' => $payment->id,
                    'uuid' => $payment->uuid,
                    'installment_id' => $payment->installment_id,
                    'installment_uuid' => $payment->installment?->uuid,
                    'installment_no' => $payment->installment?->installment_no,
                    'amount' => (float) $payment->amount,
                    'payment_date' => $payment->payment_date?->toISOString(),
                    'payment_method' => $payment->payment_method,
                    'reference_no' => $payment->reference_no,
                    'notes' => $payment->notes,
                    'received_by' => $payment->received_by,
                    'received_by_name' => $payment->receiver?->name,
                    'sale_uuid' => $sale->uuid,
                    'sale_id' => $sale->sale_id,
                    'created_at' => $payment->created_at?->toISOString(),
                    'updated_at' => $payment->updated_at?->toISOString(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    public function possessionLogs(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $sale = ApartmentSale::query()->where('uuid', $uuid)->firstOrFail();
        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);

        $query = ApartmentSalePossessionLog::query()
            ->with(['user:id,name'])
            ->where('apartment_sale_id', $sale->id)
            ->orderByDesc('action_date')
            ->orderByDesc('id');

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(function (ApartmentSalePossessionLog $log) use ($sale): array {
                return [
                    'id' => $log->id,
                    'uuid' => $log->uuid,
                    'apartment_sale_id' => $log->apartment_sale_id,
                    'action' => $log->action,
                    'action_date' => $log->action_date?->toISOString(),
                    'user_id' => $log->user_id,
                    'user_name' => $log->user?->name,
                    'note' => $log->note,
                    'sale_uuid' => $sale->uuid,
                    'sale_id' => $sale->sale_id,
                    'created_at' => $log->created_at?->toISOString(),
                    'updated_at' => $log->updated_at?->toISOString(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    public function handoverKey(Request $request, string $uuid): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->can('sales.create')) {
            return response()->json([
                'message' => 'You do not have permission to hand over apartment keys.',
            ], 403);
        }

        $sale = ApartmentSale::query()
            ->with(['installments', 'apartment'])
            ->where('uuid', $uuid)
            ->firstOrFail();

        $saleStatus = strtolower(trim((string) $sale->status));
        if (in_array($saleStatus, ['cancelled', 'terminated', 'defaulted'], true)) {
            return response()->json([
                'message' => 'Cannot hand over keys for cancelled/terminated/defaulted sale.',
            ], 409);
        }

        if (strtolower(trim((string) ($sale->deed_status ?? 'not_issued'))) === 'issued') {
            return response()->json([
                'message' => 'Sale already has issued deed. Key handover is closed.',
            ], 409);
        }

        $handoverStatus = strtolower(trim((string) ($sale->key_handover_status ?? 'not_handed_over')));
        if ($handoverStatus === 'handed_over') {
            return response()->json([
                'message' => 'Apartment key is already handed over.',
                'data' => $this->salePayload($sale->fresh()),
            ]);
        }

        if ($sale->payment_type === 'installment') {
            $hasAnyInstallmentPayment = $sale->installments()->where('paid_amount', '>', 0)->exists();
            if (!$hasAnyInstallmentPayment) {
                return response()->json([
                    'message' => 'At least one installment payment must be recorded before key handover.',
                ], 409);
            }
        } elseif ($saleStatus !== 'completed') {
            return response()->json([
                'message' => 'Full-payment sale must be completed before key handover.',
            ], 409);
        }

        DB::transaction(function () use ($sale, $actor): void {
            $sale->key_handover_status = 'handed_over';
            $sale->key_handover_at = now();
            $sale->key_handover_by = (int) $actor->id;
            if (!$sale->possession_start_date) {
                $sale->possession_start_date = now()->toDateString();
            }
            if ($sale->status === 'pending') {
                $sale->status = 'active';
            }
            $sale->save();

            $this->logPossessionAction(
                $sale,
                'key_handover',
                (int) $actor->id,
                'Key handed over after payment eligibility check.'
            );

            $freshSale = $sale->fresh();
            $financial = $this->financials->recalculateForSale($freshSale);
            $this->workflow->ensurePaymentLetter($freshSale, $financial);
        });

        return response()->json([
            'message' => 'Apartment key handed over successfully.',
            'data' => $this->salePayload($sale->fresh()),
        ]);
    }

    public function terminate(Request $request, string $uuid): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->can('sales.create')) {
            return response()->json([
                'message' => 'You do not have permission to terminate sale contracts.',
            ], 403);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'status' => ['nullable', 'in:terminated,defaulted'],
            'vacated_at' => ['nullable', 'date'],
            'termination_charge' => ['nullable', 'numeric', 'min:0'],
        ]);

        $sale = ApartmentSale::query()
            ->with(['installments', 'apartment'])
            ->where('uuid', $uuid)
            ->firstOrFail();

        $saleStatus = strtolower(trim((string) $sale->status));
        if (in_array($saleStatus, ['cancelled', 'terminated', 'defaulted', 'completed'], true)) {
            return response()->json([
                'message' => 'Sale is already completed/cancelled/terminated/defaulted.',
            ], 409);
        }

        if (strtolower(trim((string) ($sale->deed_status ?? 'not_issued'))) === 'issued') {
            return response()->json([
                'message' => 'Cannot terminate sale after deed issuance.',
            ], 409);
        }

        $paidTotal = round((float) $sale->installments()->sum('paid_amount'), 2);
        $netPrice = round((float) ($sale->net_price ?? ((float) $sale->total_price - (float) $sale->discount)), 2);
        $terminationStatus = (string) ($validated['status'] ?? 'terminated');
        $terminationCharge = max(0, round((float) ($validated['termination_charge'] ?? 0), 2));

        if ($terminationCharge - $paidTotal > 0.0001) {
            return response()->json([
                'message' => "Termination charge cannot exceed paid amount ({$paidTotal} USD).",
            ], 422);
        }

        if ($terminationStatus === 'defaulted') {
            $defaultedMinCharge = round($paidTotal * self::DEFAULTED_MIN_CHARGE_RATE, 2);
            if ($terminationCharge + 0.0001 < $defaultedMinCharge) {
                return response()->json([
                    'message' => "Defaulted status requires minimum {$defaultedMinCharge} USD termination charge.",
                ], 422);
            }
        }

        $settlementBase = max(0, round($paidTotal - $terminationCharge, 2));
        $remainingDebtAfterTermination = max(0, round($netPrice - $settlementBase, 2));
        $refundAmount = max(0, round($settlementBase - $netPrice, 2));

        DB::transaction(function () use (
            $sale,
            $validated,
            $actor,
            $terminationStatus,
            $terminationCharge,
            $remainingDebtAfterTermination,
            $refundAmount
        ): void {
            $sale->status = $terminationStatus;
            $sale->deed_status = 'not_issued';
            $sale->vacated_at = $validated['vacated_at'] ?? now()->toDateString();

            $currentHandoverStatus = strtolower(trim((string) ($sale->key_handover_status ?? 'not_handed_over')));
            if ($currentHandoverStatus === 'handed_over') {
                $sale->key_handover_status = 'returned';
                $sale->key_returned_at = now();
                $sale->key_returned_by = (int) $actor->id;
            }

            $sale->save();
            $sale->termination()->updateOrCreate(
                ['apartment_sale_id' => $sale->id],
                [
                    'reason' => trim((string) $validated['reason']),
                    'termination_charge' => $terminationCharge,
                    'refund_amount' => $refundAmount,
                    'remaining_debt_after_termination' => $remainingDebtAfterTermination,
                ]
            );

            Installment::query()
                ->where('apartment_sale_id', $sale->id)
                ->whereRaw('paid_amount < amount')
                ->update(['status' => 'cancelled']);

            $this->logPossessionAction(
                $sale,
                'terminated',
                (int) $actor->id,
                trim((string) $validated['reason'])
            );

            if ($currentHandoverStatus === 'handed_over') {
                $this->logPossessionAction(
                    $sale,
                    'key_return',
                    (int) $actor->id,
                    'Key returned during sale termination/default.'
                );
            }

            $freshSale = $sale->fresh();
            $financial = $this->financials->recalculateForSale($freshSale);
            $this->workflow->ensurePaymentLetter($freshSale, $financial);
        });

        return response()->json([
            'message' => 'Sale contract terminated and settlement recorded.',
            'data' => $this->salePayload($sale->fresh()),
        ]);
    }

    private function normalizeSaleInput(array $data): array
    {
        
        $totalPrice = max(0, round((float) ($data['total_price'] ?? 0), 2));
        $discount = max(0, round((float) ($data['discount'] ?? 0), 2));
        if ($discount > $totalPrice) {
            $discount = $totalPrice;
        }

        $paymentType = (string) ($data['payment_type'] ?? 'full');
        $paymentType = $paymentType === 'installment' ? 'installment' : 'full';

        $status = (string) ($data['status'] ?? 'active');
        if (!in_array($status, ['active', 'pending', 'approved', 'completed', 'cancelled', 'defaulted', 'terminated'], true)) {
            $status = 'active';
        }

        $frequencyType = (string) ($data['frequency_type'] ?? 'monthly');
        if (!in_array($frequencyType, ['weekly', 'monthly', 'quarterly', 'custom_dates'], true)) {
            $frequencyType = 'monthly';
        }

        $scheduleLocked = (bool) ($data['schedule_locked'] ?? false);
        $scheduleLockedAt = $data['schedule_locked_at'] ?? null;
        if ($scheduleLocked && !$scheduleLockedAt) {
            $scheduleLockedAt = now();
        }
        if (!$scheduleLocked) {
            $scheduleLockedAt = null;
        }

        $customDates = collect((array) ($data['custom_dates'] ?? []))
            ->map(function ($row, int $index): array {
                $item = is_array($row) ? $row : [];
                $amount = max(0, round((float) ($item['amount'] ?? 0), 2));

                return [
                    'installment_no' => max(1, (int) ($item['installment_no'] ?? ($index + 1))),
                    'due_date' => isset($item['due_date']) ? (string) $item['due_date'] : now()->toDateString(),
                    'amount' => $amount,
                ];
            })
            ->values()
            ->all();

        $installmentCount = max(0, (int) ($data['installment_count'] ?? 0));
        if ($frequencyType === 'custom_dates' && $installmentCount === 0) {
            $installmentCount = count($customDates);
        }

        $netPrice = $data['net_price'] ?? ($totalPrice - $discount);
        $netPrice = max(0, round((float) $netPrice, 2));
        $keyHandoverStatus = (string) ($data['key_handover_status'] ?? 'not_handed_over');
        if (!in_array($keyHandoverStatus, ['not_handed_over', 'handed_over', 'returned'], true)) {
            $keyHandoverStatus = 'not_handed_over';
        }

        return [
            'uuid' => $data['uuid'] ?? null,
            'sale_id' => isset($data['sale_id']) ? trim((string) $data['sale_id']) : null,
            'apartment_id' => (int) $data['apartment_id'],
            'customer_id' => (int) $data['customer_id'],
            'sale_date' => $data['sale_date'],
            'total_price' => $totalPrice,
            'discount' => $discount,
            'payment_type' => $paymentType,
            'status' => $status,
            'frequency_type' => $paymentType === 'installment' ? $frequencyType : null,
            'interval_count' => max(1, (int) ($data['interval_count'] ?? 1)),
            'installment_count' => $paymentType === 'installment' ? $installmentCount : null,
            'first_due_date' => $paymentType === 'installment' ? ($data['first_due_date'] ?? $data['sale_date']) : null,
            'custom_dates' => $paymentType === 'installment' ? $customDates : null,
            'schedule_locked' => $scheduleLocked,
            'schedule_locked_at' => $scheduleLockedAt,
            'approved_at' => $data['approved_at'] ?? null,
            'net_price' => $netPrice,
            'key_handover_status' => $keyHandoverStatus,
            'key_handover_at' => $data['key_handover_at'] ?? null,
            'key_handover_by' => $data['key_handover_by'] ?? null,
            'possession_start_date' => $data['possession_start_date'] ?? null,
            'vacated_at' => $data['vacated_at'] ?? null,
            'key_returned_at' => $data['key_returned_at'] ?? null,
            'key_returned_by' => $data['key_returned_by'] ?? null,
        ];
    }

    private function fillAndSaveSale(ApartmentSale $sale, array $data, int $actorId = 0): void
    {
        $fillableData = [
            'apartment_id' => $data['apartment_id'],
            'customer_id' => $data['customer_id'],
            'sale_date' => $data['sale_date'],
            'total_price' => $data['total_price'],
            'discount' => $data['discount'],
            'payment_type' => $data['payment_type'],
            'status' => $data['status'],
            'frequency_type' => $data['frequency_type'],
            'interval_count' => $data['interval_count'],
            'installment_count' => $data['installment_count'],
            'first_due_date' => $data['first_due_date'],
            'custom_dates' => $data['custom_dates'],
            'schedule_locked' => $data['schedule_locked'],
            'schedule_locked_at' => $data['schedule_locked_at'],
            'approved_at' => $data['approved_at'],
            'net_price' => $data['net_price'],
            'key_handover_status' => $data['key_handover_status'],
            'key_handover_at' => $data['key_handover_at'],
            'key_handover_by' => $data['key_handover_by'],
            'possession_start_date' => $data['possession_start_date'],
            'vacated_at' => $data['vacated_at'],
            'key_returned_at' => $data['key_returned_at'],
            'key_returned_by' => $data['key_returned_by'],
        ];
        if ($actorId > 0) {
            $fillableData['user_id'] = $actorId;
        }

        $sale->fill($fillableData);
        $sale->save();

        if (trim((string) $sale->sale_id) === '') {
            $requestedSaleId = trim((string) ($data['sale_id'] ?? ''));
            if ($requestedSaleId !== '' && $this->isSaleIdAvailable($requestedSaleId, (int) $sale->id)) {
                $sale->sale_id = $requestedSaleId;
            } else {
                $sale->sale_id = $this->generateSaleId((int) $sale->id);
            }
            $sale->save();
        }
    }

    private function syncInstallmentsForSale(ApartmentSale $sale, array $data): void
    {
        if ($sale->payment_type !== 'installment') {
            Installment::query()->where('apartment_sale_id', $sale->id)->delete();
            return;
        }

        $rows = $this->buildInstallments($sale, $data);

        Installment::query()->where('apartment_sale_id', $sale->id)->delete();
        if (!empty($rows)) {
            Installment::query()->insert($rows);
        }
    }

    private function buildInstallments(ApartmentSale $sale, array $data): array
    {
        $now = now();
        $rows = [];
        $frequency = (string) ($data['frequency_type'] ?? 'monthly');

        if ($frequency === 'custom_dates') {
            foreach ((array) ($data['custom_dates'] ?? []) as $idx => $item) {
                $installmentNo = max(1, (int) ($item['installment_no'] ?? ($idx + 1)));
                $amount = max(0, round((float) ($item['amount'] ?? 0), 2));
                if ($amount <= 0) {
                    continue;
                }

                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'apartment_sale_id' => $sale->id,
                    'installment_no' => $installmentNo,
                    'amount' => $amount,
                    'due_date' => CarbonImmutable::parse((string) ($item['due_date'] ?? $sale->sale_date))->toDateString(),
                    'paid_amount' => 0,
                    'paid_date' => null,
                    'status' => 'pending',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            usort($rows, fn (array $a, array $b): int => $a['installment_no'] <=> $b['installment_no']);
            return $rows;
        }

        $count = max(1, (int) ($data['installment_count'] ?? 1));
        $interval = max(1, (int) ($data['interval_count'] ?? 1));
        $startDate = CarbonImmutable::parse((string) ($data['first_due_date'] ?? $sale->sale_date))->startOfDay();

        $totalCents = (int) round(max(0, (float) $sale->net_price) * 100);
        $base = intdiv($totalCents, $count);
        $remainder = $totalCents % $count;

        for ($i = 1; $i <= $count; $i++) {
            $amountCents = $base + ($i <= $remainder ? 1 : 0);
            $dueDate = $this->advanceDueDate($startDate, $frequency, $interval, $i - 1);

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

        return $rows;
    }

    private function advanceDueDate(CarbonImmutable $start, string $frequency, int $interval, int $offset): CarbonImmutable
    {
        if ($offset <= 0) {
            return $start;
        }

        if ($frequency === 'weekly') {
            return $start->addWeeks($offset * $interval);
        }
        if ($frequency === 'quarterly') {
            return $start->addMonths($offset * $interval * 3);
        }

        return $start->addMonths($offset * $interval);
    }

    private function salePayload(ApartmentSale $sale): array
    {
        $payload = $sale->only([
            'id',
            'uuid',
            'sale_id',
            'apartment_id',
            'customer_id',
            'user_id',
            'sale_date',
            'total_price',
            'discount',
            'payment_type',
            'frequency_type',
            'interval_count',
            'installment_count',
            'first_due_date',
            'custom_dates',
            'schedule_locked',
            'schedule_locked_at',
            'approved_at',
            'net_price',
            'actual_net_revenue',
            'status',
            'deed_status',
            'deed_issued_at',
            'deed_issued_by',
            'key_handover_status',
            'key_handover_at',
            'key_handover_by',
            'possession_start_date',
            'vacated_at',
            'key_returned_at',
            'key_returned_by',
            'updated_at',
            'deleted_at',
        ]);

        $sale->loadMissing(['financial', 'termination']);
        $termination = null;
        if ($sale->relationLoaded('termination')) {
            $termination = $sale->termination;
        }
        $terminationData = [
            'termination_reason' => $termination?->reason,
            'termination_charge' => round((float) ($termination?->termination_charge ?? 0), 2),
            'refund_amount' => round((float) ($termination?->refund_amount ?? 0), 2),
            'remaining_debt_after_termination' => round((float) ($termination?->remaining_debt_after_termination ?? 0), 2),
        ];

        $financial = null;
        if ($sale->relationLoaded('financial')) {
            $financial = $sale->financial?->only([
                'uuid',
                'apartment_sale_id',
                'accounts_status',
                'municipality_share_15',
                'delivered_to_municipality',
                'remaining_municipality',
                'company_share_85',
                'delivered_to_company',
                'rahnama_fee_1',
                'customer_debt',
                'discount_or_contractor_deduction',
                'updated_at',
            ]);
        }

        return [...$payload, ...$terminationData, ...$this->resolveSaleMutationState($sale), 'financial' => $financial];
    }

    private function logPossessionAction(
        ApartmentSale $sale,
        string $action,
        int $actorId = 0,
        ?string $note = null
    ): void {
        ApartmentSalePossessionLog::query()->create([
            'uuid' => (string) Str::uuid(),
            'apartment_sale_id' => $sale->id,
            'action' => $action,
            'action_date' => now(),
            'user_id' => $actorId > 0 ? $actorId : null,
            'note' => $note,
        ]);
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

    private function resolveSaleMutationState(ApartmentSale $sale): array
    {
        $paidTotalRaw = $sale->getAttribute('installments_paid_total');
        $countRaw = $sale->getAttribute('installments_count');

        if ($paidTotalRaw === null || $countRaw === null) {
            $agg = Installment::query()
                ->where('apartment_sale_id', $sale->id)
                ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_total, COUNT(*) as rows_count')
                ->first();
            $paidTotal = round((float) ($agg?->paid_total ?? 0), 2);
            $rowsCount = (int) ($agg?->rows_count ?? 0);
        } else {
            $paidTotal = round((float) $paidTotalRaw, 2);
            $rowsCount = (int) $countRaw;
        }

        $hasPaidInstallments = $paidTotal > 0;
        $status = strtolower(trim((string) $sale->status));
        $deedIssued = strtolower(trim((string) ($sale->deed_status ?? 'not_issued'))) === 'issued';
        $handoverStatus = strtolower(trim((string) ($sale->key_handover_status ?? 'not_handed_over')));
        $isTerminal = in_array($status, ['completed', 'cancelled', 'terminated', 'defaulted'], true);
        $fullAccess = in_array($status, ['pending', 'active'], true) && !$hasPaidInstallments;
        $limitedAccess = !$isTerminal && ($status === 'approved' || $hasPaidInstallments);
        $editScope = $deedIssued ? 'none' : ($fullAccess ? 'full' : ($limitedAccess ? 'limited' : 'none'));
        $firstInstallmentPaid = $sale->payment_type === 'installment'
            ? Installment::query()
                ->where('apartment_sale_id', $sale->id)
                ->where('paid_amount', '>', 0)
                ->exists()
            : ($status === 'completed' || $hasPaidInstallments);
        $canHandoverKey =
            !$deedIssued &&
            !in_array($status, ['cancelled', 'terminated', 'defaulted'], true) &&
            $handoverStatus !== 'handed_over' &&
            $firstInstallmentPaid;

        return [
            'installments_count' => $rowsCount,
            'installments_paid_total' => $paidTotal,
            'has_paid_installments' => $hasPaidInstallments,
            'has_first_installment_paid' => $firstInstallmentPaid,
            'edit_scope' => $editScope,
            'can_update' => $editScope !== 'none',
            'can_delete' => $editScope === 'full',
            'key_handover_status' => $handoverStatus,
            'can_handover_key' => $canHandoverKey,
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

    private function hasBlockingDuplicateSale(array $data, ?int $ignoreId = null): bool
    {
        $query = ApartmentSale::query()
            ->where('customer_id', (int) ($data['customer_id'] ?? 0))
            ->where('apartment_id', (int) ($data['apartment_id'] ?? 0))
            ->whereNotIn('status', ['cancelled', 'terminated', 'defaulted']);

        if ($ignoreId && $ignoreId > 0) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->exists();
    }

    private function toDateString(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return CarbonImmutable::parse((string) $value)->toDateString();
    }
}
