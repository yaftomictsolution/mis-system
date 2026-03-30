<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IssueMaterialWorkflowRequest;
use App\Http\Requests\StoreMaterialWorkflowRequest;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestItem;
use App\Models\StockMovement;
use App\Services\MaterialStockService;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaterialRequestController extends Controller
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

        $query = MaterialRequest::query()
            ->with([
                'warehouse:id,uuid,name',
                'requestedByEmployee:id,uuid,first_name,last_name,email',
                'approvedByUser:id,name',
                'issuedByUser:id,name',
                'items.material:id,uuid,name,unit,quantity,updated_at',
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
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('warehouse', fn ($warehouseQuery) => $warehouseQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('requestedByEmployee', function ($employeeQuery) use ($search): void {
                        $employeeQuery
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('items.material', fn ($materialQuery) => $materialQuery->where('name', 'like', "%{$search}%"));
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
            ->map(fn (MaterialRequest $materialRequest): array => $this->payload($materialRequest))
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

    public function store(StoreMaterialWorkflowRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');

        $materialRequest = $incomingUuid !== ''
            ? MaterialRequest::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $created = false;
        if (! $materialRequest) {
            $materialRequest = new MaterialRequest();
            $materialRequest->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $materialRequest->request_no = $this->nextRequestNo();
            $materialRequest->requested_at = now();
            $created = true;
        } elseif ($materialRequest->trashed()) {
            $materialRequest->restore();
        }

        if (! $this->isEditable($materialRequest->status)) {
            return response()->json(['message' => 'Only pending material requests can be edited.'], 409);
        }

        $materialRequest->fill([
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'warehouse_id' => (int) $data['warehouse_id'],
            'requested_by_employee_id' => (int) $data['requested_by_employee_id'],
            'status' => 'pending',
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $materialRequest->save();

        $this->syncItems($materialRequest, $data['items']);

        return response()->json([
            'data' => $this->payload($materialRequest->fresh([
                'warehouse',
                'requestedByEmployee',
                'approvedByUser',
                'issuedByUser',
                'items.material',
            ])),
        ], $created ? 201 : 200);
    }

    public function update(StoreMaterialWorkflowRequest $request, string $uuid): JsonResponse
    {
        $materialRequest = MaterialRequest::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($materialRequest->trashed()) {
            $materialRequest->restore();
        }

        if (! $this->isEditable($materialRequest->status)) {
            return response()->json(['message' => 'Only pending material requests can be edited.'], 409);
        }

        $data = $request->validated();
        $materialRequest->fill([
            'project_id' => isset($data['project_id']) ? (int) $data['project_id'] : null,
            'warehouse_id' => (int) $data['warehouse_id'],
            'requested_by_employee_id' => (int) $data['requested_by_employee_id'],
            'notes' => isset($data['notes']) ? trim((string) $data['notes']) ?: null : null,
        ]);
        $materialRequest->save();

        $this->syncItems($materialRequest, $data['items']);

        return response()->json([
            'data' => $this->payload($materialRequest->fresh([
                'warehouse',
                'requestedByEmployee',
                'approvedByUser',
                'issuedByUser',
                'items.material',
            ])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $materialRequest = MaterialRequest::withTrashed()->where('uuid', $uuid)->first();
        if ($materialRequest && ! $materialRequest->trashed()) {
            if (! $this->isEditable($materialRequest->status)) {
                return response()->json(['message' => 'Only pending material requests can be deleted.'], 409);
            }
            $materialRequest->delete();
        }

        return response()->json(['message' => 'Deleted']);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $materialRequest = MaterialRequest::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $materialRequest->trashed()) {
            return response()->json([
                'message' => 'Material request must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $materialRequest->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Material Request', $materialRequest),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    public function approve(Request $request, string $uuid): JsonResponse
    {
        $materialRequest = MaterialRequest::query()->with('items')->where('uuid', $uuid)->firstOrFail();
        if ($materialRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending material requests can be approved.'], 409);
        }

        DB::transaction(function () use ($materialRequest, $request): void {
            foreach ($materialRequest->items as $item) {
                if ((float) $item->quantity_approved <= 0) {
                    $item->quantity_approved = $item->quantity_requested;
                    $item->save();
                }

                $this->materialStocks->reserveForRequest(
                    (int) $item->material_id,
                    (int) $materialRequest->warehouse_id,
                    (float) $item->quantity_approved
                );
            }

            $materialRequest->status = 'approved';
            $materialRequest->approved_by_user_id = $request->user()?->id;
            $materialRequest->approved_at = now();
            $materialRequest->save();
        });

        return response()->json([
            'data' => $this->payload($materialRequest->fresh([
                'warehouse',
                'requestedByEmployee',
                'approvedByUser',
                'issuedByUser',
                'items.material',
            ])),
        ]);
    }

    public function reject(Request $request, string $uuid): JsonResponse
    {
        $materialRequest = MaterialRequest::query()->where('uuid', $uuid)->firstOrFail();
        if ($materialRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending material requests can be rejected.'], 409);
        }

        $materialRequest->status = 'rejected';
        $materialRequest->approved_by_user_id = $request->user()?->id;
        $materialRequest->approved_at = now();
        $materialRequest->save();

        return response()->json([
            'data' => $this->payload($materialRequest->fresh([
                'warehouse',
                'requestedByEmployee',
                'approvedByUser',
                'issuedByUser',
                'items.material',
            ])),
        ]);
    }

    public function issue(IssueMaterialWorkflowRequest $request, string $uuid): JsonResponse
    {
        $materialRequest = MaterialRequest::query()->with('items.material')->where('uuid', $uuid)->firstOrFail();
        if (! in_array($materialRequest->status, ['approved', 'partial_issued'], true)) {
            return response()->json(['message' => 'Only approved material requests can be issued.'], 409);
        }

        $validated = $request->validated();
        $requestedItems = collect($validated['items'] ?? []);
        $issueDate = $request->filled('issue_date') ? $request->date('issue_date') : now();
        $issuedByUserId = $request->user()?->id;

        foreach ($requestedItems as $input) {
            $item = $materialRequest->items->firstWhere('uuid', (string) ($input['uuid'] ?? ''));
            if (! $item) {
                return response()->json(['message' => 'Requested item was not found.'], 422);
            }

            $remainingApproved = max(0, round((float) $item->quantity_approved - (float) $item->quantity_issued, 2));
            $quantityIssued = round((float) ($input['quantity_issued'] ?? 0), 2);
            if ($quantityIssued <= 0 || $quantityIssued > $remainingApproved) {
                return response()->json(['message' => 'Issued quantity exceeds approved remaining quantity.'], 422);
            }

            $material = $item->material;
            if (! $material instanceof Material) {
                return response()->json(['message' => 'Requested material was not found.'], 422);
            }
        }

        DB::transaction(function () use ($materialRequest, $requestedItems, $issueDate, $issuedByUserId, $validated): void {
            foreach ($requestedItems as $input) {
                /** @var MaterialRequestItem|null $item */
                $item = $materialRequest->items->firstWhere('uuid', (string) ($input['uuid'] ?? ''));
                if (! $item) {
                    continue;
                }

                $quantityIssued = round((float) ($input['quantity_issued'] ?? 0), 2);
                /** @var Material $material */
                $material = $item->material;

                $this->materialStocks->issueToProject(
                    (int) $material->id,
                    (int) $materialRequest->warehouse_id,
                    $materialRequest->project_id ? (int) $materialRequest->project_id : null,
                    $quantityIssued
                );

                $item->quantity_issued = round((float) $item->quantity_issued + $quantityIssued, 2);
                $item->save();

                StockMovement::query()->create([
                    'uuid' => (string) Str::uuid(),
                    'material_id' => $material->id,
                    'warehouse_id' => $materialRequest->warehouse_id,
                    'project_id' => $materialRequest->project_id,
                    'employee_id' => $materialRequest->requested_by_employee_id,
                    'material_request_item_id' => $item->id,
                    'quantity' => $quantityIssued,
                    'movement_type' => 'OUT',
                    'reference_type' => 'request_issue',
                    'reference_no' => $materialRequest->issue_receipt_no ?: $materialRequest->request_no,
                    'approved_by_user_id' => $materialRequest->approved_by_user_id,
                    'issued_by_user_id' => $issuedByUserId,
                    'movement_date' => $issueDate,
                    'notes' => isset($validated['notes']) ? trim((string) $validated['notes']) ?: null : null,
                ]);
            }

            $allIssued = $materialRequest->items->every(fn (MaterialRequestItem $item): bool => (float) $item->quantity_issued >= (float) $item->quantity_approved);
            $materialRequest->status = $allIssued ? 'issued' : 'partial_issued';
            $materialRequest->issued_by_user_id = $issuedByUserId;
            $materialRequest->issued_at = $issueDate;
            $materialRequest->issue_receipt_no = $materialRequest->issue_receipt_no ?: $this->nextIssueReceiptNo();
            if (! empty($validated['notes'])) {
                $materialRequest->notes = trim((string) $validated['notes']) ?: $materialRequest->notes;
            }
            $materialRequest->save();

            StockMovement::query()
                ->where('reference_type', 'request_issue')
                ->where('reference_no', $materialRequest->request_no)
                ->update(['reference_no' => $materialRequest->issue_receipt_no]);
        });

        return response()->json([
            'data' => $this->payload($materialRequest->fresh([
                'warehouse',
                'requestedByEmployee',
                'approvedByUser',
                'issuedByUser',
                'items.material',
            ])),
        ]);
    }

    private function syncItems(MaterialRequest $materialRequest, array $rows): void
    {
        $materialRequest->items()->delete();

        foreach ($rows as $row) {
            MaterialRequestItem::query()->create([
                'uuid' => (string) ($row['uuid'] ?? Str::uuid()),
                'material_request_id' => $materialRequest->id,
                'material_id' => (int) $row['material_id'],
                'quantity_requested' => round((float) $row['quantity_requested'], 2),
                'quantity_approved' => 0,
                'quantity_issued' => 0,
                'unit' => trim((string) $row['unit']),
                'notes' => isset($row['notes']) ? trim((string) $row['notes']) ?: null : null,
            ]);
        }
    }

    private function payload(MaterialRequest $materialRequest): array
    {
        $employeeName = trim(implode(' ', array_filter([
            $materialRequest->requestedByEmployee?->first_name,
            $materialRequest->requestedByEmployee?->last_name,
        ])));

        return [
            'id' => $materialRequest->id,
            'uuid' => $materialRequest->uuid,
            'request_no' => $materialRequest->request_no,
            'project_id' => $materialRequest->project_id,
            'warehouse_id' => $materialRequest->warehouse_id,
            'warehouse_uuid' => $materialRequest->warehouse?->uuid,
            'warehouse_name' => $materialRequest->warehouse?->name,
            'requested_by_employee_id' => $materialRequest->requested_by_employee_id,
            'requested_by_employee_uuid' => $materialRequest->requestedByEmployee?->uuid,
            'requested_by_employee_name' => $employeeName !== '' ? $employeeName : null,
            'status' => $materialRequest->status,
            'approved_by_user_id' => $materialRequest->approved_by_user_id,
            'approved_by_user_name' => $materialRequest->approvedByUser?->name,
            'approved_at' => optional($materialRequest->approved_at)->toISOString(),
            'issued_by_user_id' => $materialRequest->issued_by_user_id,
            'issued_by_user_name' => $materialRequest->issuedByUser?->name,
            'issued_at' => optional($materialRequest->issued_at)->toISOString(),
            'issue_receipt_no' => $materialRequest->issue_receipt_no,
            'requested_at' => optional($materialRequest->requested_at)->toISOString(),
            'notes' => $materialRequest->notes,
            'items' => $materialRequest->items->map(function (MaterialRequestItem $item): array {
                return [
                    'id' => $item->id,
                    'uuid' => $item->uuid,
                    'material_id' => $item->material_id,
                    'material_uuid' => $item->material?->uuid,
                    'material_name' => $item->material?->name,
                    'unit' => $item->unit,
                    'quantity_requested' => (float) $item->quantity_requested,
                    'quantity_approved' => (float) $item->quantity_approved,
                    'quantity_issued' => (float) $item->quantity_issued,
                    'notes' => $item->notes,
                ];
            })->values()->all(),
            'created_at' => optional($materialRequest->created_at)->toISOString(),
            'updated_at' => optional($materialRequest->updated_at)->toISOString(),
            'deleted_at' => optional($materialRequest->deleted_at)->toISOString(),
        ];
    }

    private function isEditable(?string $status): bool
    {
        return in_array((string) $status, ['', 'pending'], true);
    }

    private function nextRequestNo(): string
    {
        return 'MR-' . str_pad((string) ((int) MaterialRequest::withTrashed()->max('id') + 1), 6, '0', STR_PAD_LEFT);
    }

    private function nextIssueReceiptNo(): string
    {
        return 'MIR-' . str_pad((string) ((int) MaterialRequest::withTrashed()->whereNotNull('issue_receipt_no')->count() + 1), 6, '0', STR_PAD_LEFT);
    }
}
