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
        $financial = $this->financials->recalculateForSale($sale);
        $letter = $this->workflow->ensurePaymentLetter($sale, $financial);

        return response()->json([
            'data' => $this->workflow->letterPayload($sale->fresh(['customer', 'apartment']), $financial->fresh(), $letter->fresh()),
        ]);
    }

    public function generateLetter(string $uuid): JsonResponse
    {
        $sale = $this->findSale($uuid);
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
            'notes' => ['nullable', 'string'],
        ]);

        $sale = $this->findSale($uuid);
        if (strtolower(trim((string) $sale->status)) === 'cancelled') {
            return response()->json([
                'message' => 'Cannot add municipality receipt for a cancelled sale.',
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
            'created_at',
            'updated_at',
        ]);
    }
}

