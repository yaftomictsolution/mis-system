<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AllocateAssetWorkflowRequest;
use App\Http\Requests\ReturnAssetWorkflowRequest;
use App\Http\Requests\StoreAssetWorkflowRequest;
use App\Models\AssetAssignment;
use App\Models\AssetRequest;
use App\Models\CompanyAsset;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AssetRequestController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 6;

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
        $includeDeleted = $offline || !is_null($since);

        $query = AssetRequest::query()
            ->with([
                'requestedByEmployee:id,uuid,first_name,last_name,email',
                'requestedAsset:id,uuid,asset_code,asset_name,asset_type,status,quantity,allocated_quantity,current_warehouse_id',
                'approvedByUser:id,name',
                'allocatedByUser:id,name',
                'assignments.asset:id,uuid,asset_code,asset_name,asset_type,status,quantity,allocated_quantity,current_warehouse_id',
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
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('reason', 'like', "%{$search}%")
                    ->orWhereHas('requestedByEmployee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('requestedAsset', function ($assetQuery) use ($search): void {
                        $assetQuery
                            ->where('asset_code', 'like', "%{$search}%")
                            ->orWhere('asset_name', 'like', "%{$search}%")
                            ->orWhere('asset_type', 'like', "%{$search}%");
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
            ->map(fn (AssetRequest $assetRequest): array => $this->payload($assetRequest))
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

    public function store(StoreAssetWorkflowRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');

        $assetRequest = $incomingUuid !== ''
            ? AssetRequest::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $created = false;
        if (! $assetRequest) {
            $assetRequest = new AssetRequest();
            $assetRequest->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $assetRequest->request_no = $this->nextRequestNo();
            $assetRequest->requested_at = now();
            $created = true;
        } elseif ($assetRequest->trashed()) {
            $assetRequest->restore();
        }

        if (! $this->isEditable($assetRequest->status)) {
            return response()->json(['message' => 'Only pending asset requests can be edited.'], 409);
        }

        $asset = isset($data['requested_asset_id']) ? CompanyAsset::withTrashed()->find((int) $data['requested_asset_id']) : null;
        $assetType = isset($data['asset_type']) ? (string) $data['asset_type'] : ($asset?->asset_type ?: null);

        $assetRequest->fill([
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'requested_by_employee_id' => (int) $data['requested_by_employee_id'],
            'requested_asset_id' => isset($data['requested_asset_id']) ? (int) $data['requested_asset_id'] : null,
            'asset_type' => $assetType,
            'quantity_requested' => max(0.01, round((float) ($data['quantity_requested'] ?? 1), 2)),
            'quantity_allocated' => 0,
            'status' => 'pending',
            'reason' => isset($data['reason']) ? trim((string) $data['reason']) ?: null : null,
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $assetRequest->save();

        return response()->json([
            'data' => $this->payload($assetRequest->fresh([
                'requestedByEmployee',
                'requestedAsset',
                'approvedByUser',
                'allocatedByUser',
                'assignments.asset',
            ])),
        ], $created ? 201 : 200);
    }

    public function update(StoreAssetWorkflowRequest $request, string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($assetRequest->trashed()) {
            $assetRequest->restore();
        }

        if (! $this->isEditable($assetRequest->status)) {
            return response()->json(['message' => 'Only pending asset requests can be edited.'], 409);
        }

        $data = $request->validated();
        $asset = isset($data['requested_asset_id']) ? CompanyAsset::withTrashed()->find((int) $data['requested_asset_id']) : null;
        $assetType = isset($data['asset_type']) ? (string) $data['asset_type'] : ($asset?->asset_type ?: null);

        $assetRequest->fill([
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'requested_by_employee_id' => (int) $data['requested_by_employee_id'],
            'requested_asset_id' => isset($data['requested_asset_id']) ? (int) $data['requested_asset_id'] : null,
            'asset_type' => $assetType,
            'quantity_requested' => max(0.01, round((float) ($data['quantity_requested'] ?? $assetRequest->quantity_requested ?? 1), 2)),
            'reason' => isset($data['reason']) ? trim((string) $data['reason']) ?: null : null,
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $assetRequest->save();

        return response()->json([
            'data' => $this->payload($assetRequest->fresh([
                'requestedByEmployee',
                'requestedAsset',
                'approvedByUser',
                'allocatedByUser',
                'assignments.asset',
            ])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::withTrashed()->where('uuid', $uuid)->first();
        if ($assetRequest && ! $assetRequest->trashed()) {
            if (! $this->isEditable($assetRequest->status)) {
                return response()->json(['message' => 'Only pending asset requests can be deleted.'], 409);
            }
            $assetRequest->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $assetRequest->trashed()) {
            return response()->json([
                'message' => 'Asset request must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $assetRequest->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Asset Request', $assetRequest),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    public function approve(Request $request, string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::query()->where('uuid', $uuid)->firstOrFail();
        if ($assetRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending asset requests can be approved.'], 409);
        }

        $assetRequest->status = 'approved';
        $assetRequest->approved_by_user_id = $request->user()?->id;
        $assetRequest->approved_at = now();
        $assetRequest->save();

        return response()->json([
            'data' => $this->payload($assetRequest->fresh([
                'requestedByEmployee',
                'requestedAsset',
                'approvedByUser',
                'allocatedByUser',
                'assignments.asset',
            ])),
        ]);
    }

    public function reject(Request $request, string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::query()->where('uuid', $uuid)->firstOrFail();
        if ($assetRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending asset requests can be rejected.'], 409);
        }

        $assetRequest->status = 'rejected';
        $assetRequest->approved_by_user_id = $request->user()?->id;
        $assetRequest->approved_at = now();
        $assetRequest->save();

        return response()->json([
            'data' => $this->payload($assetRequest->fresh([
                'requestedByEmployee',
                'requestedAsset',
                'approvedByUser',
                'allocatedByUser',
                'assignments.asset',
            ])),
        ]);
    }

    public function allocate(AllocateAssetWorkflowRequest $request, string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::query()->with(['assignments', 'requestedAsset'])->where('uuid', $uuid)->firstOrFail();
        if ($assetRequest->status !== 'approved') {
            return response()->json(['message' => 'Only approved asset requests can be allocated.'], 409);
        }

        $asset = CompanyAsset::query()->where('id', (int) $request->validated()['asset_id'])->firstOrFail();
        $quantityAllocated = max(0.01, round((float) $request->validated()['quantity_allocated'], 2));
        if ((float) $asset->quantity < $quantityAllocated) {
            return response()->json(['message' => 'Selected asset stock does not have enough available quantity.'], 409);
        }

        $assignment = AssetAssignment::query()->create([
            'uuid' => (string) Str::uuid(),
            'asset_id' => $asset->id,
            'asset_request_id' => $assetRequest->id,
            'project_id' => $assetRequest->project_id,
            'employee_id' => $assetRequest->requested_by_employee_id,
            'quantity_assigned' => $quantityAllocated,
            'assigned_date' => $request->validated()['assigned_date'],
            'status' => 'active',
            'condition_on_issue' => $request->validated()['condition_on_issue'] ?? null,
            'notes' => $request->validated()['notes'] ?? null,
        ]);

        $asset->quantity = round(max(0, (float) $asset->quantity - $quantityAllocated), 2);
        $asset->allocated_quantity = round((float) $asset->allocated_quantity + $quantityAllocated, 2);
        $asset->status = (float) $asset->quantity > 0 ? 'available' : 'allocated';
        $asset->save();

        $assetRequest->requested_asset_id = $asset->id;
        $assetRequest->status = 'allocated';
        $assetRequest->quantity_allocated = $quantityAllocated;
        $assetRequest->allocated_by_user_id = $request->user()?->id;
        $assetRequest->allocated_at = now();
        $assetRequest->allocation_receipt_no = $assetRequest->allocation_receipt_no ?: $this->nextAllocationReceiptNo();
        $assetRequest->save();

        return response()->json([
            'data' => $this->payload($assetRequest->fresh([
                'requestedByEmployee',
                'requestedAsset',
                'approvedByUser',
                'allocatedByUser',
                'assignments.asset',
            ])),
        ]);
    }

    public function returnAsset(ReturnAssetWorkflowRequest $request, string $uuid): JsonResponse
    {
        $assetRequest = AssetRequest::query()->with(['assignments.asset'])->where('uuid', $uuid)->firstOrFail();
        if ($assetRequest->status !== 'allocated') {
            return response()->json(['message' => 'Only allocated asset requests can be returned.'], 409);
        }

        /** @var AssetAssignment|null $assignment */
        $assignment = $assetRequest->assignments->first(fn (AssetAssignment $item): bool => $item->status === 'active');
        if (! $assignment) {
            return response()->json(['message' => 'No active assignment was found for this asset request.'], 409);
        }

        $returnStatus = (string) $request->validated()['return_status'];
        $quantityReturned = max(0.01, round((float) ($request->validated()['quantity_returned'] ?? $assignment->quantity_assigned ?? 0), 2));
        $returnWarehouseId = isset($request->validated()['warehouse_id']) ? (int) $request->validated()['warehouse_id'] : null;
        if ($returnStatus !== 'lost' && $returnWarehouseId === null) {
            return response()->json(['message' => 'Return warehouse is required unless the asset is lost.'], 422);
        }
        if ($quantityReturned > (float) $assignment->quantity_assigned) {
            return response()->json(['message' => 'Returned quantity cannot exceed the allocated quantity.'], 422);
        }

        $assignment->return_date = $request->validated()['return_date'];
        $assignment->status = $returnStatus;
        $assignment->condition_on_return = $request->validated()['condition_on_return'] ?? null;
        $assignment->notes = $request->validated()['notes'] ?? $assignment->notes;
        $assignment->save();

        $asset = $assignment->asset;
        if ($asset instanceof CompanyAsset) {
            $asset->allocated_quantity = round(max(0, (float) $asset->allocated_quantity - $quantityReturned), 2);
            if ($returnStatus === 'returned') {
                $asset->quantity = round((float) $asset->quantity + $quantityReturned, 2);
                if ($returnWarehouseId !== null) {
                    $asset->current_warehouse_id = $returnWarehouseId;
                }
            } elseif ($returnStatus === 'damaged') {
                $asset->damaged_quantity = round((float) $asset->damaged_quantity + $quantityReturned, 2);
            } else {
                $asset->retired_quantity = round((float) $asset->retired_quantity + $quantityReturned, 2);
            }
            $asset->status = $this->assetStatusFromQuantities($asset);
            $asset->save();
        }

        $assetRequest->status = 'returned';
        $assetRequest->quantity_allocated = round(max(0, (float) $assetRequest->quantity_allocated - $quantityReturned), 2);
        $assetRequest->save();

        return response()->json([
            'data' => $this->payload($assetRequest->fresh([
                'requestedByEmployee',
                'requestedAsset',
                'approvedByUser',
                'allocatedByUser',
                'assignments.asset',
            ])),
        ]);
    }

    private function payload(AssetRequest $assetRequest): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $assetRequest->requestedByEmployee?->first_name,
            $assetRequest->requestedByEmployee?->last_name,
        ])));
        $assignment = $assetRequest->assignments->first();
        $assignedAsset = $assignment?->asset ?? $assetRequest->requestedAsset;

        return [
            'id' => $assetRequest->id,
            'uuid' => $assetRequest->uuid,
            'request_no' => $assetRequest->request_no,
            'project_id' => $assetRequest->project_id,
            'requested_by_employee_id' => $assetRequest->requested_by_employee_id,
            'requested_by_employee_uuid' => $assetRequest->requestedByEmployee?->uuid,
            'requested_by_employee_name' => $employeeName !== '' ? $employeeName : null,
            'requested_asset_id' => $assetRequest->requested_asset_id,
            'requested_asset_uuid' => $assetRequest->requestedAsset?->uuid,
            'requested_asset_code' => $assetRequest->requestedAsset?->asset_code,
            'requested_asset_name' => $assetRequest->requestedAsset?->asset_name,
            'asset_type' => $assetRequest->asset_type,
            'quantity_requested' => (float) $assetRequest->quantity_requested,
            'quantity_allocated' => (float) $assetRequest->quantity_allocated,
            'status' => $assetRequest->status,
            'reason' => $assetRequest->reason,
            'approved_by_user_id' => $assetRequest->approved_by_user_id,
            'approved_by_user_name' => $assetRequest->approvedByUser?->name,
            'approved_at' => optional($assetRequest->approved_at)->toISOString(),
            'allocated_by_user_id' => $assetRequest->allocated_by_user_id,
            'allocated_by_user_name' => $assetRequest->allocatedByUser?->name,
            'allocated_at' => optional($assetRequest->allocated_at)->toISOString(),
            'allocation_receipt_no' => $assetRequest->allocation_receipt_no,
            'requested_at' => optional($assetRequest->requested_at)->toISOString(),
            'notes' => $assetRequest->notes,
            'assignment_uuid' => $assignment?->uuid,
            'assignment_status' => $assignment?->status,
            'assigned_date' => optional($assignment?->assigned_date)->toDateString(),
            'return_date' => optional($assignment?->return_date)->toDateString(),
            'assigned_quantity' => $assignment ? (float) $assignment->quantity_assigned : null,
            'assigned_asset_id' => $assignedAsset?->id,
            'assigned_asset_uuid' => $assignedAsset?->uuid,
            'assigned_asset_code' => $assignedAsset?->asset_code,
            'assigned_asset_name' => $assignedAsset?->asset_name,
            'created_at' => optional($assetRequest->created_at)->toISOString(),
            'updated_at' => optional($assetRequest->updated_at)->toISOString(),
            'deleted_at' => optional($assetRequest->deleted_at)->toISOString(),
        ];
    }

    private function isEditable(?string $status): bool
    {
        return in_array((string) $status, ['', 'pending'], true);
    }

    private function nextRequestNo(): string
    {
        return 'AR-' . str_pad((string) ((int) AssetRequest::withTrashed()->max('id') + 1), 6, '0', STR_PAD_LEFT);
    }

    private function nextAllocationReceiptNo(): string
    {
        return 'AIR-' . str_pad((string) ((int) AssetRequest::withTrashed()->whereNotNull('allocation_receipt_no')->count() + 1), 6, '0', STR_PAD_LEFT);
    }

    private function assetStatusFromQuantities(CompanyAsset $asset): string
    {
        if ((float) $asset->quantity > 0) {
            return 'available';
        }
        if ((float) $asset->allocated_quantity > 0) {
            return 'allocated';
        }
        if ((float) $asset->maintenance_quantity > 0) {
            return 'maintenance';
        }
        if ((float) $asset->damaged_quantity > 0) {
            return 'damaged';
        }

        return (float) $asset->retired_quantity > 0 ? 'retired' : 'available';
    }
}

