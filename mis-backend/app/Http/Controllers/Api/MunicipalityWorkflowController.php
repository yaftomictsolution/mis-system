<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApartmentSale;
use App\Models\MunicipalityReceipt;
use App\Services\ApartmentSaleFinancialService;
use App\Services\MunicipalityWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MunicipalityWorkflowController extends Controller
{
    public function __construct(
        private readonly ApartmentSaleFinancialService $financials,
        private readonly MunicipalityWorkflowService $workflow
    ) {
    }

    public function showLetter(string $uuid): JsonResponse
    {
        $sale = $this->findSale($uuid);
        if ($this->isApprovalPending($sale)) {
            return response()->json([
                'message' => 'Admin approval is required before municipality workflow can continue.',
            ], 409);
        }
        if ($this->isWorkflowClosed($sale)) {
            return response()->json([
                'message' => 'Cancelled/terminated/defaulted sales cannot continue municipality workflow.',
            ], 409);
        }
        $financial = $this->financials->recalculateForSale($sale);
        $letter = $this->workflow->ensurePaymentLetter($sale, $financial);

        return response()->json([
            'data' => $this->workflow->letterPayload($sale->fresh(['customer', 'apartment']), $financial->fresh(), $letter->fresh()),
        ]);
    }

    public function generateLetter(string $uuid): JsonResponse
    {
        $sale = $this->findSale($uuid);
        if ($this->isApprovalPending($sale)) {
            return response()->json([
                'message' => 'Admin approval is required before municipality workflow can continue.',
            ], 409);
        }
        if ($this->isWorkflowClosed($sale)) {
            return response()->json([
                'message' => 'Cancelled/terminated/defaulted sales cannot continue municipality workflow.',
            ], 409);
        }
        $financial = $this->financials->recalculateForSale($sale);
        $letter = $this->workflow->ensurePaymentLetter($sale, $financial);

        return response()->json([
            'message' => 'Municipality payment letter generated.',
            'data' => $this->workflow->letterPayload($sale->fresh(['customer', 'apartment']), $financial->fresh(), $letter->fresh()),
        ]);
    }

    public function receiptList(Request $request, string $uuid): JsonResponse
    {
        $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $sale = $this->findSale($uuid);
        $perPage = (int) ($request->input('per_page') ?? 20);
        $page = (int) ($request->input('page') ?? 1);

        $query = MunicipalityReceipt::query()
            ->where('apartment_sale_id', $sale->id)
            ->orderByDesc('payment_date')
            ->orderByDesc('id');

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(fn (MunicipalityReceipt $row) => $this->receiptPayload($row))
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

    public function storeReceipt(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'in:cash,bank,transfer,cheque'],
            'receipt_no' => ['nullable', 'string', 'max:50'],
            'account_id' => ['required', 'integer', 'min:1', 'exists:accounts,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $sale = $this->findSale($uuid);
        if ($this->isApprovalPending($sale)) {
            return response()->json([
                'message' => 'Admin approval is required before municipality workflow can continue.',
            ], 409);
        }
        if ($this->isWorkflowClosed($sale)) {
            return response()->json([
                'message' => 'Cancelled/terminated/defaulted sales cannot continue municipality workflow.',
            ], 409);
        }

        $result = $this->workflow->recordReceipt($sale, $validated, optional($request->user())->id);

        /** @var MunicipalityReceipt $receipt */
        $receipt = $result['receipt'];
        $financial = $result['financial']->fresh();
        $letter = $result['letter']->fresh();
        $freshSale = $sale->fresh(['customer', 'apartment']);

        return response()->json([
            'message' => 'Municipality receipt recorded successfully.',
            'data' => [
                'receipt' => $this->receiptPayload($receipt),
                'financial' => $financial?->only([
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
                ]),
                'letter' => $this->workflow->letterPayload($freshSale, $financial, $letter),
                'apartment_status' => $freshSale->apartment?->status,
            ],
        ], 201);
    }

    private function findSale(string $uuid): ApartmentSale
    {
        return ApartmentSale::query()
            ->with(['customer:id,name,phone', 'apartment:id,apartment_code,unit_number,status'])
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    private function receiptPayload(MunicipalityReceipt $receipt): array
    {
        return $receipt->only([
            'id',
            'uuid',
            'apartment_sale_id',
            'receipt_no',
            'payment_date',
            'amount',
            'payment_method',
            'notes',
            'received_by',
            'account_id',
            'account_transaction_id',
            'payment_currency_code',
            'exchange_rate_snapshot',
            'account_amount',
            'created_at',
            'updated_at',
        ]);
    }

    private function isApprovalPending(ApartmentSale $sale): bool
    {
        return strtolower(trim((string) ($sale->status ?? ''))) === 'pending';
    }

    private function isWorkflowClosed(ApartmentSale $sale): bool
    {
        return in_array(strtolower(trim((string) ($sale->status ?? ''))), ['cancelled', 'terminated', 'defaulted'], true);
    }
}
