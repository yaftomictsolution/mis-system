<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApartmentSale;
use App\Models\Installment;
use App\Models\InstallmentPayment;
use App\Services\AccountLedgerService;
use App\Services\ApartmentSaleFinancialService;
use App\Services\MunicipalityWorkflowService;
use App\Services\SaleWorkflowSalesOfficerAlertService;
use App\Support\ApartmentSaleCustomerAmounts;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InstallmentController extends Controller
{
    public function __construct(
        private readonly ApartmentSaleFinancialService $financials,
        private readonly MunicipalityWorkflowService $workflow,
        private readonly AccountLedgerService $accountLedgerService,
        private readonly SaleWorkflowSalesOfficerAlertService $saleWorkflowAlerts,
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
            'apartment_sale_id' => ['nullable', 'integer', 'min:1'],
            'sale_uuid' => ['nullable', 'uuid'],
            'sale_id' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', 'in:pending,paid,overdue,cancelled'],
        ]);

        $query = Installment::query()
            ->with([
                'sale:id,uuid,sale_id,apartment_id,customer_id,status,payment_type,total_price,discount,net_price',
                'sale.installments:id,uuid,apartment_sale_id,installment_no,amount,paid_amount,status,due_date',
            ])
            ->select([
                'id',
                'uuid',
                'apartment_sale_id',
                'installment_no',
                'amount',
                'due_date',
                'paid_amount',
                'paid_date',
                'status',
                'updated_at',
                'created_at',
            ])
            ->orderByDesc('updated_at');

        if (!empty($validated['apartment_sale_id'])) {
            $query->where('apartment_sale_id', (int) $validated['apartment_sale_id']);
        }

        if (!empty($validated['sale_uuid'])) {
            $query->whereHas('sale', function ($builder) use ($validated): void {
                $builder->where('uuid', $validated['sale_uuid']);
            });
        }

        if (!empty($validated['sale_id'])) {
            $query->whereHas('sale', function ($builder) use ($validated): void {
                $builder->where('sale_id', $validated['sale_id']);
            });
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('uuid', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('apartment_sale_id', 'like', "%{$search}%")
                    ->orWhere('installment_no', 'like', "%{$search}%")
                    ->orWhere('due_date', 'like', "%{$search}%")
                    ->orWhereHas('sale', function ($saleQuery) use ($search): void {
                        $saleQuery
                            ->where('uuid', 'like', "%{$search}%")
                            ->orWhere('sale_id', 'like', "%{$search}%");
                    });
            });
        }

        if (!empty($validated['since'])) {
            $query->where('updated_at', '>', $validated['since']);
        }

        if (!empty($validated['offline'])) {
            $windowStart = now()->subMonths(6);
            $query->where('updated_at', '>=', $windowStart);
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(fn (Installment $installment) => $this->installmentPayload($installment))
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

    public function pay(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_date' => ['nullable', 'date'],
            'account_id' => ['required', 'integer', 'min:1', 'exists:accounts,id'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $installment = Installment::query()->with(['sale.installments'])->where('uuid', $uuid)->firstOrFail();

        $saleStatus = strtolower(trim((string) ($installment->sale?->status ?? '')));
        if ($saleStatus === 'pending') {
            return response()->json([
                'message' => 'Admin approval is required before recording installment payments.',
            ], 409);
        }
        if (in_array($saleStatus, ['cancelled', 'terminated', 'defaulted'], true)) {
            return response()->json([
                'message' => 'Cannot apply payment on cancelled/terminated/defaulted sale.',
            ], 409);
        }

        $scaledAmounts = $installment->sale
            ? ApartmentSaleCustomerAmounts::installmentAmounts($installment->sale, $installment->sale->installments)
            : [];
        $amountKey = $installment->id ? 'id:' . $installment->id : (!empty($installment->uuid) ? 'uuid:' . $installment->uuid : null);
        $total = (float) (($amountKey && array_key_exists($amountKey, $scaledAmounts)) ? $scaledAmounts[$amountKey] : $installment->amount);
        $currentPaid = (float) $installment->paid_amount;
        $remaining = max(0, round($total - $currentPaid, 2));
        if ($remaining <= 0) {
            return response()->json([
                'message' => 'Installment is already fully paid.',
                'data' => $this->installmentPayload($installment),
            ], 409);
        }

        $requested = max(0, round((float) $validated['amount'], 2));
        $applied = min($requested, $remaining);
        $newPaid = round($currentPaid + $applied, 2);
        $paidDate = isset($validated['paid_date'])
            ? CarbonImmutable::parse($validated['paid_date'])->toDateString()
            : now()->toDateString();
        $paymentMethod = trim((string) ($validated['payment_method'] ?? 'cash')) ?: 'cash';

        DB::transaction(function () use ($installment, $newPaid, $total, $paidDate, $applied, $request, $validated, $paymentMethod): void {
            $installment->paid_amount = $newPaid;
            $installment->paid_date = $paidDate;
            $installment->status = $this->deriveInstallmentStatus($newPaid, $total, $installment->due_date?->toDateString());
            $installment->save();

            $payment = InstallmentPayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'installment_id' => $installment->id,
                'amount' => $applied,
                'payment_date' => isset($paidDate) ? CarbonImmutable::parse($paidDate)->toDateTimeString() : now(),
                'payment_method' => $paymentMethod,
                'reference_no' => $validated['reference_no'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'received_by' => optional($request->user())->id,
                'account_id' => (int) $validated['account_id'],
            ]);

            $sale = $installment->sale;
            $posting = $this->accountLedgerService->postModuleTransaction(
                accountId: (int) $validated['account_id'],
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
                actorId: optional($request->user())->id,
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
                $this->workflow->ensurePaymentLetter($freshSale, $financial);
            }
        });

        $freshInstallment = $installment->fresh([
            'sale.customer:id,name',
            'sale.apartment:id,apartment_code,unit_number',
            'sale.user:id,name,full_name,email,status',
            'sale.installments:id,uuid,apartment_sale_id,installment_no,amount,paid_amount,status,due_date',
        ]);
        if ($freshInstallment?->sale) {
            $this->saleWorkflowAlerts->notifyPaymentReceived(
                sale: $freshInstallment->sale,
                amount: $applied,
                installmentNo: (int) ($freshInstallment->installment_no ?? 1),
                actor: $request->user(),
                paymentMethod: $paymentMethod,
            );
        }

        return response()->json([
            'message' => 'Payment recorded successfully.',
            'data' => $this->installmentPayload($freshInstallment ?? $installment->fresh(['sale'])),
        ]);
    }

    private function syncSaleStatusFromInstallments(ApartmentSale $sale): void
    {
        if (in_array($sale->status, ['cancelled', 'terminated', 'defaulted'], true)) return;

        $sale->loadMissing('installments');
        $hasUnpaid = ApartmentSaleCustomerAmounts::hasUnpaidInstallments($sale, $sale->installments);

        if (!$hasUnpaid) {
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
        if ($paidAmount >= $amount) return 'paid';
        if ($dueDate && CarbonImmutable::parse($dueDate)->isBefore(now()->startOfDay())) return 'overdue';
        return 'pending';
    }

    private function installmentPayload(Installment $installment): array
    {
        $data = $installment->only([
            'id',
            'uuid',
            'apartment_sale_id',
            'installment_no',
            'amount',
            'due_date',
            'paid_amount',
            'paid_date',
            'status',
            'updated_at',
            'created_at',
        ]);

        $sale = $installment->relationLoaded('sale') ? $installment->sale : null;
        $amount = (float) ($installment->amount ?? 0);
        if ($sale && $sale->relationLoaded('installments')) {
            $scaledAmounts = ApartmentSaleCustomerAmounts::installmentAmounts($sale, $sale->installments);
            $amountKey = $installment->id ? 'id:' . $installment->id : (!empty($installment->uuid) ? 'uuid:' . $installment->uuid : null);
            if ($amountKey && array_key_exists($amountKey, $scaledAmounts)) {
                $amount = (float) $scaledAmounts[$amountKey];
            }
        }
        $paid = (float) ($installment->paid_amount ?? 0);
        $remaining = max(0, round($amount - $paid, 2));
        $data['amount'] = $amount;
        $data['paid_amount'] = $paid;
        $data['remaining_amount'] = $remaining;

        if ($installment->relationLoaded('sale') && $installment->sale) {
            $data['sale_uuid'] = $installment->sale->uuid;
            $data['sale_id'] = $installment->sale->sale_id;
            $data['apartment_id'] = $installment->sale->apartment_id;
            $data['customer_id'] = $installment->sale->customer_id;
            $data['sale_status'] = $installment->sale->status;
        }

        return $data;
    }
}
