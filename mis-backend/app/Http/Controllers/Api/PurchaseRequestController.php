<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReceivePurchaseRequestRequest;
use App\Http\Requests\StorePurchaseRequestRequest;
use App\Models\CompanyAsset;
use App\Models\Material;
use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestItem;
use App\Models\StockMovement;
use App\Services\MaterialStockService;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseRequestController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 6;

    public function __construct(
        private readonly MaterialStockService $materialStocks
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $offline = $request->boolean('offline');
        $since = $validated['since'] ?? null;
        $includeDeleted = $offline || ! is_null($since);

        $query = PurchaseRequest::query()
            ->with([
                'sourceMaterialRequest:id,uuid,request_no',
                'project:id,uuid,name',
                'warehouse:id,uuid,name',
                'vendor:id,uuid,name',
                'requestedByEmployee:id,uuid,first_name,last_name,email',
                'approvedByUser:id,name',
                'receivedByUser:id,name',
                'items.material:id,uuid,name,unit,quantity,updated_at',
                'items.companyAsset:id,uuid,asset_code,asset_name,asset_type,current_warehouse_id',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('request_no', 'like', "%{$search}%")
                    ->orWhere('request_type', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('sourceMaterialRequest', fn ($related) => $related->where('request_no', 'like', "%{$search}%"))
                    ->orWhereHas('warehouse', fn ($warehouseQuery) => $warehouseQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('vendor', fn ($vendorQuery) => $vendorQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('requestedByEmployee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('items.companyAsset', function ($assetQuery) use ($search): void {
                        $assetQuery
                            ->where('asset_code', 'like', "%{$search}%")
                            ->orWhere('asset_name', 'like', "%{$search}%")
                            ->orWhere('asset_type', 'like', "%{$search}%");
                    })
                    ->orWhereHas('items.material', fn ($materialQuery) => $materialQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('items', function ($itemQuery) use ($search): void {
                        $itemQuery
                            ->where('asset_name', 'like', "%{$search}%")
                            ->orWhere('asset_type', 'like', "%{$search}%")
                            ->orWhere('asset_code_prefix', 'like', "%{$search}%");
                    });
            });
        }

        $status = trim((string) ($validated['status'] ?? ''));
        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($since) {
            $query->where(function ($builder) use ($since): void {
                $builder
                    ->where('updated_at', '>', $since)
                    ->orWhere('deleted_at', '>', $since);
            });
        }

        if ($offline) {
            $windowStart = now()->subMonths(self::OFFLINE_WINDOW_MONTHS);
            $query->where(function ($builder) use ($windowStart): void {
                $builder
                    ->where('updated_at', '>=', $windowStart)
                    ->orWhere(function ($deleted) use ($windowStart): void {
                        $deleted->whereNotNull('deleted_at')->where('deleted_at', '>=', $windowStart);
                    });
            });
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginator->items())
            ->map(fn (PurchaseRequest $purchaseRequest): array => $this->payload($purchaseRequest))
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

    public function store(StorePurchaseRequestRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');

        $purchaseRequest = $incomingUuid !== ''
            ? PurchaseRequest::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $created = false;
        if (! $purchaseRequest) {
            $purchaseRequest = new PurchaseRequest();
            $purchaseRequest->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $purchaseRequest->request_no = $this->nextRequestNo();
            $purchaseRequest->requested_at = now();
            $created = true;
        } elseif ($purchaseRequest->trashed()) {
            $purchaseRequest->restore();
        }

        if (! $this->isEditable($purchaseRequest->status)) {
            return response()->json(['message' => 'Only pending purchase requests can be edited.'], 409);
        }

        $purchaseRequest->fill([
            'request_type' => $this->normalizeRequestType((string) ($data['request_type'] ?? 'material')),
            'source_material_request_id' => isset($data['source_material_request_id']) ? (int) $data['source_material_request_id'] : null,
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'warehouse_id' => (int) $data['warehouse_id'],
            'vendor_id' => isset($data['vendor_id']) ? (int) $data['vendor_id'] : null,
            'requested_by_employee_id' => (int) $data['requested_by_employee_id'],
            'status' => 'pending',
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $purchaseRequest->save();

        $this->syncItems($purchaseRequest, $data['items']);

        return response()->json([
            'data' => $this->payload($purchaseRequest->fresh([
                'sourceMaterialRequest',
                'project',
                'warehouse',
                'vendor',
                'requestedByEmployee',
                'approvedByUser',
                'receivedByUser',
                'items.material',
                'items.companyAsset',
            ])),
        ], $created ? 201 : 200);
    }

    public function update(StorePurchaseRequestRequest $request, string $uuid): JsonResponse
    {
        $purchaseRequest = PurchaseRequest::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($purchaseRequest->trashed()) {
            $purchaseRequest->restore();
        }

        if (! $this->isEditable($purchaseRequest->status)) {
            return response()->json(['message' => 'Only pending purchase requests can be edited.'], 409);
        }

        $data = $request->validated();
        $purchaseRequest->fill([
            'request_type' => $this->normalizeRequestType((string) ($data['request_type'] ?? $purchaseRequest->request_type)),
            'source_material_request_id' => isset($data['source_material_request_id']) ? (int) $data['source_material_request_id'] : null,
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'warehouse_id' => (int) $data['warehouse_id'],
            'vendor_id' => isset($data['vendor_id']) ? (int) $data['vendor_id'] : null,
            'requested_by_employee_id' => (int) $data['requested_by_employee_id'],
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $purchaseRequest->save();

        $this->syncItems($purchaseRequest, $data['items']);

        return response()->json([
            'data' => $this->payload($purchaseRequest->fresh([
                'sourceMaterialRequest',
                'project',
                'warehouse',
                'vendor',
                'requestedByEmployee',
                'approvedByUser',
                'receivedByUser',
                'items.material',
                'items.companyAsset',
            ])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $purchaseRequest = PurchaseRequest::withTrashed()->where('uuid', $uuid)->first();
        if ($purchaseRequest && ! $purchaseRequest->trashed()) {
            if (! $this->isEditable($purchaseRequest->status)) {
                return response()->json(['message' => 'Only pending purchase requests can be deleted.'], 409);
            }
            $purchaseRequest->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $purchaseRequest = PurchaseRequest::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $purchaseRequest->trashed()) {
            return response()->json([
                'message' => 'Purchase request must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $purchaseRequest->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Purchase Request', $purchaseRequest),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    public function approve(Request $request, string $uuid): JsonResponse
    {
        $purchaseRequest = PurchaseRequest::query()->with('items')->where('uuid', $uuid)->firstOrFail();
        if ($purchaseRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending purchase requests can be approved.'], 409);
        }

        foreach ($purchaseRequest->items as $item) {
            if ((float) $item->quantity_approved <= 0) {
                $item->quantity_approved = $item->quantity_requested;
                $item->save();
            }
        }

        $purchaseRequest->status = 'approved';
        $purchaseRequest->approved_by_user_id = $request->user()?->id;
        $purchaseRequest->approved_at = now();
        $purchaseRequest->save();

        return response()->json([
            'data' => $this->payload($purchaseRequest->fresh([
                'sourceMaterialRequest',
                'project',
                'warehouse',
                'vendor',
                'requestedByEmployee',
                'approvedByUser',
                'receivedByUser',
                'items.material',
                'items.companyAsset',
            ])),
        ]);
    }

    public function reject(Request $request, string $uuid): JsonResponse
    {
        $purchaseRequest = PurchaseRequest::query()->where('uuid', $uuid)->firstOrFail();
        if ($purchaseRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending purchase requests can be rejected.'], 409);
        }

        $purchaseRequest->status = 'rejected';
        $purchaseRequest->approved_by_user_id = $request->user()?->id;
        $purchaseRequest->approved_at = now();
        $purchaseRequest->save();

        return response()->json([
            'data' => $this->payload($purchaseRequest->fresh([
                'sourceMaterialRequest',
                'project',
                'warehouse',
                'vendor',
                'requestedByEmployee',
                'approvedByUser',
                'receivedByUser',
                'items.material',
                'items.companyAsset',
            ])),
        ]);
    }

    public function receive(ReceivePurchaseRequestRequest $request, string $uuid): JsonResponse
    {
        $purchaseRequest = PurchaseRequest::query()->with(['items.material', 'items.companyAsset'])->where('uuid', $uuid)->firstOrFail();
        if (! in_array($purchaseRequest->status, ['approved', 'partial_received'], true)) {
            return response()->json(['message' => 'Only approved purchase requests can be received.'], 409);
        }

        $validated = $request->validated();
        $requestedItems = collect($validated['items'] ?? []);
        $receiveDate = $request->filled('receive_date') ? $request->date('receive_date') : now();
        $receivedByUserId = $request->user()?->id;

        foreach ($requestedItems as $input) {
            $item = $purchaseRequest->items->firstWhere('uuid', (string) ($input['uuid'] ?? ''));
            if (! $item) {
                return response()->json(['message' => 'Requested purchase item was not found.'], 422);
            }

            $remainingApproved = $this->normalizeItemQuantity(
                $item->item_kind,
                max(0, round((float) $item->quantity_approved - (float) $item->quantity_received, 2))
            );
            $quantityReceived = $this->normalizeItemQuantity($item->item_kind, $input['quantity_received'] ?? 0);
            if ($quantityReceived <= 0 || $quantityReceived > $remainingApproved) {
                return response()->json(['message' => 'Received quantity exceeds approved remaining quantity.'], 422);
            }

            if ($item->item_kind === 'asset') {
                if ($item->company_asset_id) {
                    $assetStock = CompanyAsset::query()->whereKey((int) $item->company_asset_id)->first();
                    if (! $assetStock) {
                        return response()->json(['message' => 'Selected company asset stock line was not found.'], 422);
                    }

                    if ((int) $assetStock->current_warehouse_id !== (int) $purchaseRequest->warehouse_id) {
                        return response()->json(['message' => 'Selected company asset stock line belongs to a different warehouse.'], 422);
                    }
                } elseif (! $item->asset_name || ! $item->asset_type) {
                    return response()->json(['message' => 'Requested asset definition is incomplete.'], 422);
                }

                continue;
            }

            $material = $item->material;
            if (! $material instanceof Material) {
                return response()->json(['message' => 'Requested material was not found.'], 422);
            }
        }

        DB::transaction(function () use ($purchaseRequest, $requestedItems, $receiveDate, $receivedByUserId, $validated): void {
            foreach ($requestedItems as $input) {
                /** @var PurchaseRequestItem|null $item */
                $item = $purchaseRequest->items->firstWhere('uuid', (string) ($input['uuid'] ?? ''));
                if (! $item) {
                    continue;
                }

                $quantityReceived = $this->normalizeItemQuantity($item->item_kind, $input['quantity_received'] ?? 0);
                $notes = isset($validated['notes']) ? trim((string) $validated['notes']) ?: null : null;
                $actualUnitPrice = array_key_exists('actual_unit_price', $input) && $input['actual_unit_price'] !== null
                    ? round(max(0, (float) $input['actual_unit_price']), 2)
                    : ($item->actual_unit_price !== null
                        ? round(max(0, (float) $item->actual_unit_price), 2)
                        : ($item->estimated_unit_price !== null ? round(max(0, (float) $item->estimated_unit_price), 2) : null));

                if ($item->item_kind === 'asset') {
                    if ($item->company_asset_id) {
                        $assetStock = CompanyAsset::query()
                            ->lockForUpdate()
                            ->whereKey((int) $item->company_asset_id)
                            ->first();

                        if (! $assetStock) {
                            throw ValidationException::withMessages([
                                'items' => ['Selected company asset stock line was not found.'],
                            ]);
                        }

                        if ((int) $assetStock->current_warehouse_id !== (int) $purchaseRequest->warehouse_id) {
                            throw ValidationException::withMessages([
                                'items' => ['Selected company asset stock line belongs to a different warehouse.'],
                            ]);
                        }
                    } else {
                        $assetStock = new CompanyAsset([
                            'uuid' => (string) Str::uuid(),
                            'asset_code' => $this->nextPurchasedAssetCode($item->asset_code_prefix, $item->asset_name, $item->asset_type),
                            'asset_name' => $item->asset_name,
                            'asset_type' => $item->asset_type,
                            'supplier_id' => $purchaseRequest->vendor_id,
                            'serial_no' => null,
                            'status' => 'available',
                            'quantity' => 0,
                            'allocated_quantity' => 0,
                            'maintenance_quantity' => 0,
                            'damaged_quantity' => 0,
                            'retired_quantity' => 0,
                            'current_employee_id' => null,
                            'current_project_id' => null,
                            'current_warehouse_id' => $purchaseRequest->warehouse_id,
                            'notes' => $notes,
                        ]);
                    }

                    $assetStock->quantity = round((float) ($assetStock->quantity ?? 0) + $quantityReceived, 2);
                    $assetStock->status = 'available';
                    $assetStock->notes = $notes ?: $assetStock->notes;
                    $assetStock->save();

                    $item->quantity_received = $this->normalizeItemQuantity(
                        $item->item_kind,
                        (float) $item->quantity_received + $quantityReceived
                    );
                    $item->actual_unit_price = $actualUnitPrice;
                    $item->actual_line_total = $actualUnitPrice !== null
                        ? round((float) $item->quantity_received * $actualUnitPrice, 2)
                        : null;
                    $item->save();
                    continue;
                }

                /** @var Material $material */
                $material = $item->material;

                $this->materialStocks->receiveIntoWarehouse(
                    (int) $material->id,
                    (int) $purchaseRequest->warehouse_id,
                    $quantityReceived
                );

                $item->quantity_received = round((float) $item->quantity_received + $quantityReceived, 2);
                $item->actual_unit_price = $actualUnitPrice;
                $item->actual_line_total = $actualUnitPrice !== null
                    ? round((float) $item->quantity_received * $actualUnitPrice, 2)
                    : null;
                $item->save();

                StockMovement::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'material_id' => $material->id,
                    'warehouse_id' => $purchaseRequest->warehouse_id,
                    'project_id' => $purchaseRequest->project_id,
                    'employee_id' => $purchaseRequest->requested_by_employee_id,
                    'material_request_item_id' => null,
                    'quantity' => $quantityReceived,
                    'movement_type' => 'IN',
                    'reference_type' => 'purchase_receipt',
                    'reference_no' => $purchaseRequest->purchase_receipt_no ?: $purchaseRequest->request_no,
                    'approved_by_user_id' => $purchaseRequest->approved_by_user_id,
                    'issued_by_user_id' => $receivedByUserId,
                    'movement_date' => $receiveDate,
                    'notes' => $notes,
                ]);
            }

            $allReceived = $purchaseRequest->items->every(fn (PurchaseRequestItem $item): bool => (float) $item->quantity_received >= (float) $item->quantity_approved);
            $purchaseRequest->status = $allReceived ? 'received' : 'partial_received';
            $purchaseRequest->received_by_user_id = $receivedByUserId;
            $purchaseRequest->received_at = $receiveDate;
            $purchaseRequest->purchase_receipt_no = $purchaseRequest->purchase_receipt_no ?: $this->nextPurchaseReceiptNo();
            if (! empty($validated['notes'])) {
                $purchaseRequest->notes = trim((string) $validated['notes']) ?: $purchaseRequest->notes;
            }
            $purchaseRequest->save();

            StockMovement::query()
                ->where('reference_type', 'purchase_receipt')
                ->where('reference_no', $purchaseRequest->request_no)
                ->update(['reference_no' => $purchaseRequest->purchase_receipt_no]);
        });

        return response()->json([
            'data' => $this->payload($purchaseRequest->fresh([
                'sourceMaterialRequest',
                'project',
                'warehouse',
                'vendor',
                'requestedByEmployee',
                'approvedByUser',
                'receivedByUser',
                'items.material',
                'items.companyAsset',
            ])),
        ]);
    }

    private function syncItems(PurchaseRequest $purchaseRequest, array $rows): void
    {
        $purchaseRequest->items()->delete();

        foreach ($rows as $row) {
            $itemKind = $this->normalizeItemKind($row, $purchaseRequest->request_type);
            $companyAssetId = $itemKind === 'asset' ? (int) ($row['company_asset_id'] ?? 0) : 0;
            $companyAsset = null;

            if ($companyAssetId > 0) {
                $companyAsset = CompanyAsset::query()->whereKey($companyAssetId)->first();
                if (! $companyAsset) {
                    throw ValidationException::withMessages([
                        'items' => ['Selected company asset stock line was not found.'],
                    ]);
                }

                if ((int) $companyAsset->current_warehouse_id !== (int) $purchaseRequest->warehouse_id) {
                    throw ValidationException::withMessages([
                        'items' => ['Selected company asset stock line belongs to a different warehouse.'],
                    ]);
                }
            }

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
                    ? ($companyAsset ? $this->normalizeAssetType((string) $companyAsset->asset_type) : $this->normalizeAssetType((string) ($row['asset_type'] ?? '')))
                    : null,
                'asset_code_prefix' => $itemKind === 'asset'
                    ? ($companyAsset ? null : (trim((string) ($row['asset_code_prefix'] ?? '')) !== '' ? strtoupper(trim((string) $row['asset_code_prefix'])) : null))
                    : null,
                'quantity_requested' => $this->normalizeItemQuantity($itemKind, $row['quantity_requested'] ?? 0),
                'quantity_approved' => 0,
                'quantity_received' => 0,
                'estimated_unit_price' => array_key_exists('estimated_unit_price', $row) && $row['estimated_unit_price'] !== null
                    ? round(max(0, (float) $row['estimated_unit_price']), 2)
                    : null,
                'estimated_line_total' => array_key_exists('estimated_unit_price', $row) && $row['estimated_unit_price'] !== null
                    ? round($this->normalizeItemQuantity($itemKind, $row['quantity_requested'] ?? 0) * max(0, (float) $row['estimated_unit_price']), 2)
                    : null,
                'actual_unit_price' => null,
                'actual_line_total' => null,
                'unit' => trim((string) $row['unit']),
                'notes' => isset($row['notes']) ? trim((string) $row['notes']) ?: null : null,
            ]);
        }
    }

    private function payload(PurchaseRequest $purchaseRequest): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $purchaseRequest->requestedByEmployee?->first_name,
            $purchaseRequest->requestedByEmployee?->last_name,
        ])));

        return [
            'id' => $purchaseRequest->id,
            'uuid' => $purchaseRequest->uuid,
            'request_no' => $purchaseRequest->request_no,
            'request_type' => $this->normalizeRequestType((string) ($purchaseRequest->request_type ?? 'material')),
            'source_material_request_id' => $purchaseRequest->source_material_request_id,
            'source_material_request_uuid' => $purchaseRequest->sourceMaterialRequest?->uuid,
            'source_material_request_no' => $purchaseRequest->sourceMaterialRequest?->request_no,
            'project_id' => $purchaseRequest->project_id,
            'project_uuid' => $purchaseRequest->project?->uuid,
            'project_name' => $purchaseRequest->project?->name,
            'warehouse_id' => $purchaseRequest->warehouse_id,
            'warehouse_uuid' => $purchaseRequest->warehouse?->uuid,
            'warehouse_name' => $purchaseRequest->warehouse?->name,
            'vendor_id' => $purchaseRequest->vendor_id,
            'vendor_uuid' => $purchaseRequest->vendor?->uuid,
            'vendor_name' => $purchaseRequest->vendor?->name,
            'requested_by_employee_id' => $purchaseRequest->requested_by_employee_id,
            'requested_by_employee_uuid' => $purchaseRequest->requestedByEmployee?->uuid,
            'requested_by_employee_name' => $employeeName !== '' ? $employeeName : null,
            'status' => $purchaseRequest->status,
            'approved_by_user_id' => $purchaseRequest->approved_by_user_id,
            'approved_by_user_name' => $purchaseRequest->approvedByUser?->name,
            'approved_at' => optional($purchaseRequest->approved_at)->toISOString(),
            'received_by_user_id' => $purchaseRequest->received_by_user_id,
            'received_by_user_name' => $purchaseRequest->receivedByUser?->name,
            'received_at' => optional($purchaseRequest->received_at)->toISOString(),
            'purchase_receipt_no' => $purchaseRequest->purchase_receipt_no,
            'requested_at' => optional($purchaseRequest->requested_at)->toISOString(),
            'notes' => $purchaseRequest->notes,
            'items' => $purchaseRequest->items->map(function (PurchaseRequestItem $item): array {
                return [
                    'id' => $item->id,
                    'uuid' => $item->uuid,
                    'item_kind' => $item->item_kind ?: 'material',
                    'material_id' => $item->material_id,
                    'material_uuid' => $item->material?->uuid,
                    'material_name' => $item->material?->name,
                    'company_asset_id' => $item->company_asset_id,
                    'company_asset_uuid' => $item->companyAsset?->uuid,
                    'company_asset_code' => $item->companyAsset?->asset_code,
                    'asset_name' => $item->asset_name,
                    'asset_type' => $item->asset_type,
                    'asset_code_prefix' => $item->asset_code_prefix,
                    'unit' => $item->unit,
                    'quantity_requested' => (float) $item->quantity_requested,
                    'quantity_approved' => (float) $item->quantity_approved,
                    'quantity_received' => (float) $item->quantity_received,
                    'estimated_unit_price' => $item->estimated_unit_price !== null ? (float) $item->estimated_unit_price : null,
                    'estimated_line_total' => $item->estimated_line_total !== null ? (float) $item->estimated_line_total : null,
                    'actual_unit_price' => $item->actual_unit_price !== null ? (float) $item->actual_unit_price : null,
                    'actual_line_total' => $item->actual_line_total !== null ? (float) $item->actual_line_total : null,
                    'notes' => $item->notes,
                ];
            })->values()->all(),
            'created_at' => optional($purchaseRequest->created_at)->toISOString(),
            'updated_at' => optional($purchaseRequest->updated_at)->toISOString(),
            'deleted_at' => optional($purchaseRequest->deleted_at)->toISOString(),
        ];
    }

    private function isEditable(?string $status): bool
    {
        return in_array((string) $status, ['', 'pending'], true);
    }

    private function normalizeRequestType(string $value): string
    {
        return strtolower(trim($value)) === 'asset' ? 'asset' : 'material';
    }

    private function normalizeItemKind(array $row, ?string $requestType): string
    {
        $kind = strtolower(trim((string) ($row['item_kind'] ?? $requestType ?? 'material')));
        return $kind === 'asset' ? 'asset' : 'material';
    }

    private function normalizeAssetType(string $value): ?string
    {
        $type = trim($value);
        if ($type === 'IT') {
            return 'IT';
        }

        $normalized = strtolower($type);
        return in_array($normalized, ['vehicle', 'machine', 'tool'], true) ? $normalized : null;
    }

    private function normalizeItemQuantity(string $itemKind, mixed $value): float
    {
        if ($itemKind === 'asset') {
            return (float) max(0, (int) round((float) $value));
        }

        return round((float) $value, 2);
    }

    private function nextPurchasedAssetCode(?string $prefix, ?string $assetName, ?string $assetType): string
    {
        $base = strtoupper(trim((string) $prefix));
        if ($base === '') {
            $candidate = preg_replace('/[^A-Za-z0-9]+/', '', (string) ($assetName ?: $assetType ?: 'AST'));
            $base = strtoupper(substr((string) $candidate, 0, 6));
        }
        if ($base === '') {
            $base = 'AST';
        }

        $counter = (int) CompanyAsset::withTrashed()
            ->where('asset_code', 'like', $base . '-%')
            ->count() + 1;

        do {
            $code = $base . '-' . str_pad((string) $counter, 4, '0', STR_PAD_LEFT);
            $counter += 1;
        } while (CompanyAsset::withTrashed()->where('asset_code', $code)->exists());

        return $code;
    }

    private function nextRequestNo(): string
    {
        return 'PR-' . str_pad((string) ((int) PurchaseRequest::withTrashed()->max('id') + 1), 6, '0', STR_PAD_LEFT);
    }

    private function nextPurchaseReceiptNo(): string
    {
        return 'PIR-' . str_pad((string) ((int) PurchaseRequest::withTrashed()->whereNotNull('purchase_receipt_no')->count() + 1), 6, '0', STR_PAD_LEFT);
    }
}
