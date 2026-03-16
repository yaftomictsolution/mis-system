<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Apartment;
use App\Models\ApartmentRental;
use App\Models\RentalPayment;
use App\Models\RentalPaymentReceipt;
use App\Services\RentalBillCreatedFinanceAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Throwable;

class ApartmentRentalController extends Controller
{
    public function __construct(
        private readonly RentalBillCreatedFinanceAlertService $billAlerts
    ) {
    }
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'since' => ['nullable', 'date'],
        ]);

        $query = ApartmentRental::query()
            ->with([
                'apartment:id,uuid,apartment_code,unit_number,status',
                'tenant:id,name,phone,email',
            ])
            ->latest('updated_at');

        $status = strtolower(trim((string) ($validated['status'] ?? '')));
        if ($status !== '') {
            $query->where('status', $status);
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('rental_id', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhereHas('tenant', function ($tenantQuery) use ($search): void {
                        $tenantQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('apartment', function ($apartmentQuery) use ($search): void {
                        $apartmentQuery
                            ->where('apartment_code', 'like', "%{$search}%")
                            ->orWhere('unit_number', 'like', "%{$search}%");
                    });
            });
        }

        if (!empty($validated['since'])) {
            $query->where('updated_at', '>', $validated['since']);
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 50);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(fn (ApartmentRental $rental): array => $this->rentalPayload($rental))
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

    public function paymentsIndex(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'payment_type' => ['nullable', 'in:advance,monthly,late_fee,adjustment'],
            'status' => ['nullable', 'string', 'max:50'],
            'tenant_id' => ['nullable', 'integer', 'exists:customers,id'],
            'rental_uuid' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'since' => ['nullable', 'date'],
        ]);

        $query = RentalPayment::query()
            ->with([
                'rental:id,uuid,rental_id,tenant_id,apartment_id,status',
                'rental.tenant:id,name,phone,email',
                'rental.apartment:id,apartment_code,unit_number',
                'approver:id,name',
            ])
            ->latest('updated_at');

        if (!empty($validated['payment_type'])) {
            $query->where('payment_type', (string) $validated['payment_type']);
        }
        if (!empty($validated['status'])) {
            $query->where('status', (string) $validated['status']);
        }
        if (!empty($validated['tenant_id'])) {
            $query->whereHas('rental', function ($builder) use ($validated): void {
                $builder->where('tenant_id', (int) $validated['tenant_id']);
            });
        }
        if (!empty($validated['rental_uuid'])) {
            $query->whereHas('rental', function ($builder) use ($validated): void {
                $builder->where('uuid', (string) $validated['rental_uuid']);
            });
        }
        if (!empty($validated['since'])) {
            $query->where('updated_at', '>', $validated['since']);
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('period_month', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('payment_type', 'like', "%{$search}%")
                    ->orWhereHas('rental', function ($rentalQuery) use ($search): void {
                        $rentalQuery->where('rental_id', 'like', "%{$search}%");
                    })
                    ->orWhereHas('rental.tenant', function ($tenantQuery) use ($search): void {
                        $tenantQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('rental.apartment', function ($apartmentQuery) use ($search): void {
                        $apartmentQuery
                            ->where('apartment_code', 'like', "%{$search}%")
                            ->orWhere('unit_number', 'like', "%{$search}%");
                    });
            });
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 50);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(fn (RentalPayment $payment): array => $this->paymentPayload($payment))
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

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'uuid' => ['nullable', 'string', 'max:100'],
            'apartment_id' => ['required', 'integer', 'exists:apartments,id'],
            'tenant_id' => ['required', 'integer', 'exists:customers,id'],
            'contract_start' => ['required', 'date'],
            'contract_end' => ['required', 'date', 'after_or_equal:contract_start'],
            'monthly_rent' => ['required', 'numeric', 'gt:0'],
            'advance_months' => ['nullable', 'integer', 'min:1', 'max:12'],
            'initial_advance_paid' => ['nullable', 'numeric', 'min:0'],
            'initial_payment_method' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $apartment = Apartment::query()->findOrFail((int) $data['apartment_id']);
        $apartmentStatus = strtolower(trim((string) ($apartment->status ?? 'available')));
        if (!in_array($apartmentStatus, ['available', 'reserved'], true)) {
            return response()->json([
                'message' => 'Only available apartments can start rental contract.',
            ], 422);
        }

        $hasOpenRental = ApartmentRental::query()
            ->where('apartment_id', (int) $data['apartment_id'])
            ->whereIn('status', ['draft', 'advance_pending', 'active'])
            ->exists();
        if ($hasOpenRental) {
            return response()->json([
                'message' => 'This apartment already has an open rental contract.',
            ], 409);
        }

        $monthlyRent = $this->toMoney($data['monthly_rent']);
        $advanceMonths = (int) ($data['advance_months'] ?? 3);
        $requiredAdvance = $this->toMoney($monthlyRent * $advanceMonths);
        $initialAdvancePaid = min($requiredAdvance, $this->toMoney($data['initial_advance_paid'] ?? 0));
        $remainingAdvance = $this->toMoney(max(0, $requiredAdvance - $initialAdvancePaid));

        $rental = new ApartmentRental();
        $rental->uuid = trim((string) ($data['uuid'] ?? '')) ?: (string) Str::uuid();
        $rental->rental_id = $this->nextRentalId();
        $rental->apartment_id = (int) $data['apartment_id'];
        $rental->tenant_id = (int) $data['tenant_id'];
        $rental->created_by = (int) ($request->user()?->id ?? 0) ?: null;
        $rental->contract_start = (string) $data['contract_start'];
        $rental->contract_end = $data['contract_end'] ?? null;
        $rental->monthly_rent = $monthlyRent;
        $rental->advance_months = $advanceMonths;
        $rental->advance_required_amount = $requiredAdvance;
        $rental->advance_paid_amount = $initialAdvancePaid;
        $rental->advance_remaining_amount = $remainingAdvance;
        $rental->total_paid_amount = $initialAdvancePaid;
        $rental->advance_status = $remainingAdvance <= 0 ? 'completed' : ($initialAdvancePaid > 0 ? 'partial' : 'pending');
        $rental->next_due_date = $this->computeNextDueDate((string) $data['contract_start']);
        $rental->status = $remainingAdvance <= 0 ? 'active' : 'advance_pending';
        $rental->key_handover_status = 'not_handed_over';
        $rental->save();

        if ($initialAdvancePaid > 0) {
            $payment = RentalPayment::query()->create([
                'uuid' => (string) Str::uuid(),
                'rental_id' => (int) $rental->id,
                'period_month' => null,
                'due_date' => now()->toDateString(),
                'payment_type' => 'advance',
                'amount_due' => $initialAdvancePaid,
                'amount_paid' => $initialAdvancePaid,
                'remaining_amount' => 0,
                'paid_date' => now(),
                'status' => 'paid',
                'notes' => $data['notes'] ?? null,
            ]);

            RentalPaymentReceipt::query()->create([
                'uuid' => (string) Str::uuid(),
                'rental_payment_id' => (int) $payment->id,
                'rental_id' => (int) $rental->id,
                'tenant_id' => (int) $rental->tenant_id,
                'receipt_no' => $this->nextReceiptNo(),
                'payment_date' => now(),
                'amount' => $initialAdvancePaid,
                'payment_method' => trim((string) ($data['initial_payment_method'] ?? 'cash')) ?: 'cash',
                'reference_no' => null,
                'received_by' => (int) ($request->user()?->id ?? 0) ?: null,
                'notes' => $data['notes'] ?? null,
            ]);
        }

        $this->syncRentalPaymentTotals($rental);

        $apartment->status = $rental->status === 'active' ? 'rented' : 'reserved';
        $apartment->save();

        return response()->json([
            'data' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
        ], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $rental = ApartmentRental::query()->where('uuid', $uuid)->firstOrFail();

        $data = $request->validate([
            'contract_start' => ['sometimes', 'date'],
            'contract_end' => ['nullable', 'date'],
            'monthly_rent' => ['sometimes', 'numeric', 'gt:0'],
            'advance_months' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'status' => ['nullable', 'in:draft,advance_pending,active,completed,terminated,defaulted,cancelled'],
        ]);

        $monthlyRent = array_key_exists('monthly_rent', $data) ? $this->toMoney($data['monthly_rent']) : (float) $rental->monthly_rent;
        $advanceMonths = array_key_exists('advance_months', $data) ? (int) $data['advance_months'] : (int) $rental->advance_months;
        $paidAdvance = $this->toMoney($rental->advance_paid_amount);
        $requiredAdvance = $this->toMoney($monthlyRent * $advanceMonths);
        $remainingAdvance = $this->toMoney(max(0, $requiredAdvance - $paidAdvance));

        $rental->fill($data);
        $rental->monthly_rent = $monthlyRent;
        $rental->advance_months = $advanceMonths;
        $rental->advance_required_amount = $requiredAdvance;
        $rental->advance_remaining_amount = $remainingAdvance;
        $rental->advance_status = $remainingAdvance <= 0 ? 'completed' : ($paidAdvance > 0 ? 'partial' : 'pending');
        $rental->save();
        $this->syncRentalPaymentTotals($rental);

        return response()->json([
            'data' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $rental = ApartmentRental::query()->where('uuid', $uuid)->firstOrFail();

        $hasPayments = RentalPayment::query()->where('rental_id', (int) $rental->id)->exists();
        if ($hasPayments) {
            return response()->json([
                'message' => 'Cannot delete rental with payment history.',
            ], 422);
        }

        $apartmentId = (int) $rental->apartment_id;
        $rental->delete();
        $this->updateApartmentStatusAfterClose($apartmentId);

        return response()->json(['message' => 'Deleted']);
    }

    public function addPayment(Request $request, string $uuid): JsonResponse
    {
        $rental = ApartmentRental::query()->where('uuid', $uuid)->firstOrFail();
        if (in_array($rental->status, ['completed', 'terminated', 'defaulted', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Closed rental cannot accept new payments.',
            ], 422);
        }

        $data = $request->validate([
            'payment_type' => ['required', 'in:advance,monthly,late_fee,adjustment'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'amount_due' => ['nullable', 'numeric', 'gt:0'],
            'due_date' => ['nullable', 'date'],
            'payment_date' => ['nullable', 'date'],
            'period_month' => ['nullable', 'string', 'max:20'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'reference_no' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $amountPaid = $this->toMoney($data['amount']);
        $amountDue = $this->toMoney($data['amount_due'] ?? $amountPaid);
        $remaining = $this->toMoney(max(0, $amountDue - $amountPaid));
        $status = $remaining <= 0 ? 'paid' : 'partial';

        $payment = RentalPayment::query()->create([
            'uuid' => (string) Str::uuid(),
            'rental_id' => (int) $rental->id,
            'period_month' => $data['period_month'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'payment_type' => (string) $data['payment_type'],
            'amount_due' => $amountDue,
            'amount_paid' => $amountPaid,
            'remaining_amount' => $remaining,
            'paid_date' => $data['payment_date'] ?? now()->toDateString(),
            'status' => $status,
            'notes' => $data['notes'] ?? null,
        ]);

        $receipt = RentalPaymentReceipt::query()->create([
            'uuid' => (string) Str::uuid(),
            'rental_payment_id' => (int) $payment->id,
            'rental_id' => (int) $rental->id,
            'tenant_id' => (int) $rental->tenant_id,
            'receipt_no' => $this->nextReceiptNo(),
            'payment_date' => $data['payment_date'] ?? now()->toDateString(),
            'amount' => $amountPaid,
            'payment_method' => trim((string) ($data['payment_method'] ?? 'cash')) ?: 'cash',
            'reference_no' => $data['reference_no'] ?? null,
            'received_by' => (int) ($request->user()?->id ?? 0) ?: null,
            'notes' => $data['notes'] ?? null,
        ]);

        $this->syncRentalPaymentTotals($rental);

        return response()->json([
            'message' => 'Payment saved.',
            'data' => [
                'rental' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
                'payment' => $payment->fresh(['approver']),
                'receipt' => $receipt->fresh(),
            ],
        ], 201);
    }

    public function generateBill(Request $request, string $uuid): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->can('sales.create')) {
            return response()->json([
                'message' => 'You do not have permission to generate customer bills.',
            ], 403);
        }

        $rental = ApartmentRental::query()->where('uuid', $uuid)->firstOrFail();
        if (in_array($rental->status, ['completed', 'terminated', 'defaulted', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Closed rental cannot generate new bills.',
            ], 422);
        }

        $data = $request->validate([
            'payment_type' => ['nullable', 'in:advance,monthly,late_fee,adjustment'],
            'amount_due' => ['required', 'numeric', 'gt:0'],
            'due_date' => ['required', 'date'],
            'period_month' => ['nullable', 'regex:/^\\d{4}-\\d{2}$/'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $paymentType = (string) ($data['payment_type'] ?? 'monthly');
        $amountDue = $this->toMoney($data['amount_due']);
        $dueDate = Carbon::parse((string) $data['due_date'])->toDateString();
        $periodMonth = trim((string) ($data['period_month'] ?? ''));
        if ($periodMonth === '') {
            $periodMonth = Carbon::parse($dueDate)->format('Y-m');
        }

        if ($paymentType === 'monthly') {
            $hasOpenMonthlyBill = RentalPayment::query()
                ->where('rental_id', (int) $rental->id)
                ->where('payment_type', 'monthly')
                ->where('period_month', $periodMonth)
                ->where('remaining_amount', '>', 0)
                ->exists();

            if ($hasOpenMonthlyBill) {
                return response()->json([
                    'message' => 'An unpaid monthly bill already exists for this period.',
                ], 409);
            }
        }

        $payment = RentalPayment::query()->create([
            'uuid' => (string) Str::uuid(),
            'bill_no' => $this->nextBillNo(),
            'bill_generated_at' => now(),
            'rental_id' => (int) $rental->id,
            'period_month' => $periodMonth,
            'due_date' => $dueDate,
            'payment_type' => $paymentType,
            'amount_due' => $amountDue,
            'amount_paid' => 0,
            'remaining_amount' => $amountDue,
            'paid_date' => null,
            'status' => 'pending',
            'notes' => $data['notes'] ?? null,
            'approved_by' => null,
            'approved_at' => null,
        ]);

        $this->syncRentalPaymentTotals($rental);
        try {
            $this->billAlerts->notifyFinance(
                $rental->fresh(['tenant:id,name,phone,email', 'apartment:id,apartment_code,unit_number']),
                $payment->fresh()
            );
        } catch (Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Bill generated successfully.',
            'data' => [
                'rental' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
                'payment' => $payment->fresh(['approver']),
            ],
        ], 201);
    }

    public function approvePayment(Request $request, string $uuid): JsonResponse
    {
        $actor = $request->user();
        if (!$actor || !$actor->can('installments.pay')) {
            return response()->json([
                'message' => 'Only finance users can approve rental payments.',
            ], 403);
        }

        $payment = RentalPayment::query()
            ->with(['rental'])
            ->where('uuid', $uuid)
            ->firstOrFail();

        $rental = $payment->rental;
        if (!$rental) {
            return response()->json([
                'message' => 'Rental contract not found for this bill.',
            ], 404);
        }

        if (in_array($rental->status, ['completed', 'terminated', 'defaulted', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Closed rental cannot accept finance approvals.',
            ], 422);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'reference_no' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $amountDue = $this->toMoney($payment->amount_due);
        $alreadyPaid = $this->toMoney($payment->amount_paid);
        $remainingBefore = $this->toMoney(max(0, $amountDue - $alreadyPaid));
        if ($remainingBefore <= 0) {
            return response()->json([
                'message' => 'This bill is already fully settled.',
            ], 409);
        }

        $requestedAmount = $this->toMoney($data['amount']);
        $approvedAmount = min($requestedAmount, $remainingBefore);
        if ($approvedAmount <= 0) {
            return response()->json([
                'message' => 'Approved amount must be greater than 0.',
            ], 422);
        }

        $newPaid = $this->toMoney($alreadyPaid + $approvedAmount);
        $remainingAfter = $this->toMoney(max(0, $amountDue - $newPaid));
        $paymentStatus = $remainingAfter <= 0 ? 'paid' : 'partial';
        $paymentDate = $data['payment_date'] ?? now()->toDateString();

        $payment->amount_paid = $newPaid;
        $payment->remaining_amount = $remainingAfter;
        $payment->paid_date = $paymentDate;
        $payment->status = $paymentStatus;
        $payment->approved_by = (int) $actor->id;
        $payment->approved_at = now();
        if (!empty($data['notes'])) {
            $payment->notes = trim((string) $data['notes']);
        }
        $payment->save();

        $receipt = RentalPaymentReceipt::query()->create([
            'uuid' => (string) Str::uuid(),
            'rental_payment_id' => (int) $payment->id,
            'rental_id' => (int) $rental->id,
            'tenant_id' => (int) $rental->tenant_id,
            'receipt_no' => $this->nextReceiptNo(),
            'payment_date' => $paymentDate,
            'amount' => $approvedAmount,
            'payment_method' => trim((string) ($data['payment_method'] ?? 'cash')) ?: 'cash',
            'reference_no' => $data['reference_no'] ?? null,
            'received_by' => (int) $actor->id,
            'notes' => $data['notes'] ?? null,
        ]);

        $this->syncRentalPaymentTotals($rental);

        return response()->json([
            'message' => 'Finance approved payment successfully.',
            'data' => [
                'rental' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
                'payment' => $payment->fresh(['approver']),
                'receipt' => $receipt->fresh(),
            ],
        ]);
    }

    public function handoverKey(Request $request, string $uuid): JsonResponse
    {
        $rental = ApartmentRental::query()->where('uuid', $uuid)->firstOrFail();
        if ((float) $rental->advance_remaining_amount > 0.0001) {
            return response()->json([
                'message' => 'Advance payment is not complete. Key handover is blocked.',
            ], 422);
        }
        if (in_array($rental->status, ['completed', 'terminated', 'defaulted', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Closed rental cannot hand over key.',
            ], 422);
        }

        $rental->key_handover_status = 'handed_over';
        $rental->key_handover_at = now();
        $rental->key_handover_by = (int) ($request->user()?->id ?? 0) ?: null;
        $rental->status = 'active';
        $rental->save();

        $this->setApartmentStatus((int) $rental->apartment_id, 'rented');

        return response()->json([
            'message' => 'Key handover completed.',
            'data' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
        ]);
    }

    public function close(Request $request, string $uuid): JsonResponse
    {
        $rental = ApartmentRental::query()->where('uuid', $uuid)->firstOrFail();
        $data = $request->validate([
            'status' => ['required', 'in:completed,terminated,defaulted,cancelled'],
            'termination_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $rental->status = (string) $data['status'];
        $rental->termination_reason = $data['termination_reason'] ?? null;
        $rental->terminated_at = now();
        if ($rental->key_handover_status === 'handed_over') {
            $rental->key_handover_status = 'returned';
            $rental->key_returned_at = now();
            $rental->key_returned_by = (int) ($request->user()?->id ?? 0) ?: null;
        }
        $rental->save();

        $this->updateApartmentStatusAfterClose((int) $rental->apartment_id);

        return response()->json([
            'message' => 'Rental closed.',
            'data' => $this->rentalPayload($rental->fresh(['apartment', 'tenant'])),
        ]);
    }

    private function setApartmentStatus(int $apartmentId, string $status): void
    {
        $apartment = Apartment::query()->find($apartmentId);
        if ($apartment) {
            $apartment->status = $status;
            $apartment->save();
        }
    }

    private function updateApartmentStatusAfterClose(int $apartmentId): void
    {
        $hasOpenRental = ApartmentRental::query()
            ->where('apartment_id', $apartmentId)
            ->whereIn('status', ['draft', 'advance_pending', 'active'])
            ->exists();
        if (!$hasOpenRental) {
            $this->setApartmentStatus($apartmentId, 'available');
        }
    }

    private function nextRentalId(): string
    {
        $next = ((int) ApartmentRental::query()->max('id')) + 1;
        return 'RNT-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    private function nextReceiptNo(): string
    {
        $next = ((int) RentalPaymentReceipt::query()->max('id')) + 1;
        return 'RRC-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    private function nextBillNo(): string
    {
        $next = ((int) RentalPayment::query()->max('id')) + 1;
        return 'RBL-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    private function computeNextDueDate(string $contractStart): ?string
    {
        try {
            return Carbon::parse($contractStart)->addMonthNoOverflow()->toDateString();
        } catch (Throwable) {
            return null;
        }
    }

    private function resolveNextDueDate(ApartmentRental $rental): ?string
    {
        if (in_array($rental->status, ['completed', 'terminated', 'defaulted', 'cancelled'], true)) {
            return null;
        }

        $monthlyPayments = RentalPayment::query()
            ->where('rental_id', (int) $rental->id)
            ->where('payment_type', 'monthly');

        $unsettled = (clone $monthlyPayments)
            ->where(function ($query): void {
                $query
                    ->where('status', '!=', 'paid')
                    ->orWhere('remaining_amount', '>', 0);
            })
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date')
            ->orderBy('id')
            ->first();

        if ($unsettled && $unsettled->due_date) {
            return Carbon::parse($unsettled->due_date)->toDateString();
        }

        $latestMonthly = (clone $monthlyPayments)
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('due_date', 'desc')
            ->orderBy('id', 'desc')
            ->first();

        if ($latestMonthly) {
            $anchor = $latestMonthly->due_date ?? $latestMonthly->paid_date;
            if ($anchor) {
                $next = Carbon::parse($anchor)->addMonthNoOverflow();
                return $next->toDateString();
            }
        }

        $monthlyRent = (float) ($rental->monthly_rent ?? 0);
        $advancePaid = (float) ($rental->advance_paid_amount ?? 0);
        $coveredMonths = $monthlyRent > 0 ? (int) floor($advancePaid / $monthlyRent) : 0;
        $dueAfterMonths = max(1, $coveredMonths);

        try {
            $next = Carbon::parse((string) $rental->contract_start)->addMonthsNoOverflow($dueAfterMonths);
            return $next->toDateString();
        } catch (Throwable) {
            return $this->computeNextDueDate((string) $rental->contract_start);
        }
    }

    private function toMoney(mixed $value): float
    {
        $n = (float) $value;
        if (!is_finite($n) || $n < 0) {
            return 0;
        }
        return round($n, 2);
    }

    private function syncRentalPaymentTotals(ApartmentRental $rental): void
    {
        $totals = RentalPayment::query()
            ->where('rental_id', (int) $rental->id)
            ->selectRaw('COALESCE(SUM(amount_paid), 0) as total_paid')
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_type = 'advance' THEN amount_paid ELSE 0 END), 0) as advance_paid")
            ->first();

        $totalPaid = $this->toMoney($totals?->total_paid ?? 0);
        $advancePaidRaw = $this->toMoney($totals?->advance_paid ?? 0);
        $advancePaid = min($advancePaidRaw, (float) $rental->advance_required_amount);
        $advanceRemaining = $this->toMoney(max(0, (float) $rental->advance_required_amount - $advancePaid));

        $rental->total_paid_amount = $totalPaid;
        $rental->advance_paid_amount = $advancePaid;
        $rental->advance_remaining_amount = $advanceRemaining;
        $rental->advance_status = $advanceRemaining <= 0 ? 'completed' : ($advancePaid > 0 ? 'partial' : 'pending');

        $isClosed = in_array($rental->status, ['completed', 'terminated', 'defaulted', 'cancelled'], true);
        if (!$isClosed) {
            if ($rental->advance_status !== 'completed') {
                $rental->status = 'advance_pending';
            } else {
                $rental->status = 'active';
            }
        }

        $rental->next_due_date = $this->resolveNextDueDate($rental);

        $rental->save();
    }

    private function rentalPayload(ApartmentRental $rental): array
    {
        $status = (string) $rental->status;
        if (
            !in_array($status, ['completed', 'terminated', 'defaulted', 'cancelled'], true) &&
            (float) ($rental->advance_remaining_amount ?? 0) <= 0.0001
        ) {
            $status = 'active';
        }

        return [
            'id' => (int) $rental->id,
            'uuid' => (string) $rental->uuid,
            'rental_id' => (string) $rental->rental_id,
            'apartment_id' => (int) $rental->apartment_id,
            'tenant_id' => (int) $rental->tenant_id,
            'created_by' => $rental->created_by ? (int) $rental->created_by : null,
            'contract_start' => $rental->contract_start?->toDateString(),
            'contract_end' => $rental->contract_end?->toDateString(),
            'monthly_rent' => (float) $rental->monthly_rent,
            'advance_months' => (int) $rental->advance_months,
            'advance_required_amount' => (float) $rental->advance_required_amount,
            'advance_paid_amount' => (float) $rental->advance_paid_amount,
            'advance_remaining_amount' => (float) $rental->advance_remaining_amount,
            'total_paid_amount' => (float) $rental->total_paid_amount,
            'advance_status' => (string) $rental->advance_status,
            'next_due_date' => $rental->next_due_date?->toDateString(),
            'status' => $status,
            'key_handover_status' => (string) $rental->key_handover_status,
            'key_handover_at' => $rental->key_handover_at?->toISOString(),
            'key_handover_by' => $rental->key_handover_by ? (int) $rental->key_handover_by : null,
            'key_returned_at' => $rental->key_returned_at?->toISOString(),
            'key_returned_by' => $rental->key_returned_by ? (int) $rental->key_returned_by : null,
            'termination_reason' => $rental->termination_reason,
            'terminated_at' => $rental->terminated_at?->toISOString(),
            'apartment' => $rental->relationLoaded('apartment') && $rental->apartment ? [
                'id' => (int) $rental->apartment->id,
                'uuid' => (string) $rental->apartment->uuid,
                'apartment_code' => (string) $rental->apartment->apartment_code,
                'unit_number' => (string) $rental->apartment->unit_number,
                'status' => (string) $rental->apartment->status,
            ] : null,
            'tenant' => $rental->relationLoaded('tenant') && $rental->tenant ? [
                'id' => (int) $rental->tenant->id,
                'name' => (string) $rental->tenant->name,
                'phone' => (string) ($rental->tenant->phone ?? ''),
                'email' => (string) ($rental->tenant->email ?? ''),
            ] : null,
            'updated_at' => $rental->updated_at?->toISOString(),
            'created_at' => $rental->created_at?->toISOString(),
        ];
    }

    private function paymentPayload(RentalPayment $payment): array
    {
        $rental = $payment->relationLoaded('rental') ? $payment->rental : null;
        $tenant = $rental && $rental->relationLoaded('tenant') ? $rental->tenant : null;
        $apartment = $rental && $rental->relationLoaded('apartment') ? $rental->apartment : null;

        return [
            'id' => (int) $payment->id,
            'uuid' => (string) $payment->uuid,
            'bill_no' => $payment->bill_no,
            'bill_generated_at' => $payment->bill_generated_at?->toISOString(),
            'rental_id' => (int) $payment->rental_id,
            'rental_uuid' => $rental?->uuid,
            'rental_code' => $rental?->rental_id,
            'tenant_id' => $rental?->tenant_id ? (int) $rental->tenant_id : null,
            'tenant_name' => $tenant?->name,
            'tenant_phone' => $tenant?->phone,
            'apartment_id' => $rental?->apartment_id ? (int) $rental->apartment_id : null,
            'apartment_code' => $apartment?->apartment_code,
            'period_month' => $payment->period_month,
            'due_date' => $payment->due_date?->toDateString(),
            'payment_type' => (string) $payment->payment_type,
            'amount_due' => (float) $payment->amount_due,
            'amount_paid' => (float) $payment->amount_paid,
            'remaining_amount' => (float) $payment->remaining_amount,
            'paid_date' => $payment->paid_date?->toISOString(),
            'status' => (string) $payment->status,
            'notes' => $payment->notes,
            'approved_by' => $payment->approved_by ? (int) $payment->approved_by : null,
            'approved_at' => $payment->approved_at?->toISOString(),
            'approved_by_name' => $payment->relationLoaded('approver') ? $payment->approver?->name : null,
            'updated_at' => $payment->updated_at?->toISOString(),
            'created_at' => $payment->created_at?->toISOString(),
        ];
    }
}






