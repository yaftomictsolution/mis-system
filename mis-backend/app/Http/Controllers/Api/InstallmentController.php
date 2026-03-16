<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApartmentSale;
use App\Models\Installment;
use App\Models\InstallmentPayment;
use App\Services\ApartmentSaleFinancialService;
use App\Services\MunicipalityWorkflowService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InstallmentController extends Controller
{
    public function __construct(
        private readonly ApartmentSaleFinancialService $financials,
        private readonly MunicipalityWorkflowService $workflow
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
            ->with(['sale:id,uuid,sale_id,apartment_id,customer_id,status,payment_type'])
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
        ]);

        $installment = Installment::query()->with('sale')->where('uuid', $uuid)->firstOrFail();

        $saleStatus = strtolower(trim((string) ($installment->sale?->status ?? '')));
        if (in_array($saleStatus, ['cancelled', 'terminated', 'defaulted'], true)) {
            return response()->json([
                'message' => 'Cannot apply payment on cancelled/terminated/defaulted sale.',
            ], 409);
        }

        $total = (float) $installment->amount;
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

        DB::transaction(function () use ($installment, $newPaid, $total, $paidDate, $applied, $request): void {
            $installment->paid_amount = $newPaid;
            $installment->paid_date = $paidDate;
            $installment->status = $this->deriveInstallmentStatus($newPaid, $total, $installment->due_date?->toDateString());
            $installment->save();

            InstallmentPayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'installment_id' => $installment->id,
                'amount' => $applied,
                'payment_date' => isset($paidDate) ? CarbonImmutable::parse($paidDate)->toDateTimeString() : now(),
                'payment_method' => 'cash',
                'reference_no' => null,
                'notes' => null,
                'received_by' => optional($request->user())->id,
            ]);

            if ($installment->sale) {
                $this->syncSaleStatusFromInstallments($installment->sale);
                $freshSale = $installment->sale->fresh();
                $financial = $this->financials->recalculateForSale($freshSale);
                $this->workflow->ensurePaymentLetter($freshSale, $financial);
            }
        });

        return response()->json([
            'message' => 'Payment recorded successfully.',
            'data' => $this->installmentPayload($installment->fresh(['sale'])),
        ]);
    }

    private function syncSaleStatusFromInstallments(ApartmentSale $sale): void
    {
        if (in_array($sale->status, ['cancelled', 'terminated', 'defaulted'], true)) return;

        $hasUnpaid = $sale->installments()
            ->where(function ($builder): void {
                $builder
                    ->whereRaw('paid_amount < amount')
                    ->orWhere('status', '!=', 'paid');
            })
            ->exists();

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

        $amount = (float) ($installment->amount ?? 0);
        $paid = (float) ($installment->paid_amount ?? 0);
        $remaining = max(0, round($amount - $paid, 2));
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
