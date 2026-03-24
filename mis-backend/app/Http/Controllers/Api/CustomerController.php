<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCustomerRequest;
use App\Models\Customer;
use App\Models\Document;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
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

        $query = Customer::query()
            ->select([
                'id',
                'uuid',
                'name',
                'fname',
                'gname',
                'phone',
                'phone1',
                'email',
                'status',
                'address',
                'updated_at',
                'deleted_at',
            ])
            ->with([
                'documents:id,module,document_type,reference_id,file_path,expiry_date,created_at',
            ])
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('fname', 'like', "%{$search}%")
                    ->orWhere('gname', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('phone1', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['since'])) {
            $query->where(function ($builder) use ($since) {
                $builder
                    ->where('updated_at', '>', $since)
                    ->orWhere('deleted_at', '>', $since);
            });
        }

        if ($offline) {
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
            ->map(fn (Customer $customer) => $this->customerPayload($customer))
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

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $email = trim((string) ($data['email'] ?? ''));

        $matches = collect();

        if ($email !== '') {
            $matchByEmail = Customer::withTrashed()->where('email', $email)->first();
            if ($matchByEmail) {
                $matches->push($matchByEmail);
            }
        }

        $uniqueMatches = $matches->unique('id')->values();
        if ($uniqueMatches->count() > 1) {
            return response()->json([
                'message' => 'Conflicting identifiers for customer create request.',
            ], 409);
        }

        $customer = $uniqueMatches->first();
        $created = false;
        $restored = false;

        if (!$customer) {
            $customer = new Customer();
            $customer->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($customer->trashed()) {
            $customer->restore();
            $restored = true;
        } elseif ($incomingUuid !== '' && $customer->uuid === $incomingUuid) {
        } else {
            return response()->json([
                'message' => 'Customer already exists.',
                'data' => $this->customerPayload($customer),
            ], 409);
        }

        DB::transaction(function () use ($customer, $data, $request): void {
            $updateData = $data;
            unset($updateData['uuid'], $updateData['attachment']);
            $customer->fill($updateData);
            $customer->save();
            $this->storeAttachment($customer, $request);
        });

        return response()->json([
            'data' => $this->customerPayload($customer->fresh(['documents'])),
            'restored' => $restored,
        ], $created ? 201 : 200);
    }

    public function update(StoreCustomerRequest $request, string $uuid): JsonResponse
    {
        $customer = Customer::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($customer->trashed()) {
            $customer->restore();
        }

        $data = $request->validated();

        DB::transaction(function () use ($customer, $data, $request): void {
            $updateData = $data;
            unset($updateData['attachment']);
            $customer->update($updateData);
            $this->storeAttachment($customer, $request);
        });

        return response()->json([
            'data' => $this->customerPayload($customer->fresh(['documents'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $customer = Customer::withTrashed()->where('uuid', $uuid)->first();
        if ($customer && !$customer->trashed()) {
            DB::transaction(function () use ($customer): void {
                $documents = Document::query()
                    ->where('module', 'customer')
                    ->where('reference_id', $customer->id)
                    ->get();

                foreach ($documents as $document) {
                    if (trim((string) $document->file_path) !== '') {
                        Storage::disk('public')->delete($document->file_path);
                    }
                }

                Document::query()
                    ->where('module', 'customer')
                    ->where('reference_id', $customer->id)
                    ->delete();

                $customer->delete();
            });
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $customer = Customer::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (!$customer->trashed()) {
            return response()->json([
                'message' => 'Customer must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            DB::transaction(function () use ($customer): void {
                $documents = Document::query()
                    ->where('module', 'customer')
                    ->where('reference_id', $customer->id)
                    ->get();

                foreach ($documents as $document) {
                    if (trim((string) $document->file_path) !== '') {
                        Storage::disk('public')->delete($document->file_path);
                    }
                }

                Document::query()
                    ->where('module', 'customer')
                    ->where('reference_id', $customer->id)
                    ->delete();

                $customer->forceDelete();
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Customer', $customer),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    public function storeAttachmentOnly(Request $request, string $uuid): JsonResponse
    {
        $request->validate([
            'attachment' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ]);

        $customer = Customer::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($customer->trashed()) {
            return response()->json([
                'message' => 'Cannot upload attachment for deleted customer.',
            ], 422);
        }

        DB::transaction(function () use ($customer, $request): void {
            $this->storeAttachment($customer, $request);
        });

        return response()->json([
            'message' => 'Attachment uploaded.',
            'data' => $this->customerPayload($customer->fresh(['documents'])),
        ], 201);
    }

    private function customerPayload(Customer $customer): array
    {
        $base = $customer->only([
            'id',
            'uuid',
            'name',
            'fname',
            'gname',
            'phone',
            'phone1',
            'email',
            'status',
            'address',
            'updated_at',
            'deleted_at',
        ]);

        $documents = $customer->relationLoaded('documents')
            ? $customer->documents->sortByDesc(fn (Document $document) => $document->created_at?->getTimestamp() ?? 0)->values()
            : collect();

        $base['documents'] = $documents
            ->map(function (Document $document): array {
                $documentType = $this->inferCustomerDocumentType(
                    (string) ($document->document_type ?? ''),
                    (string) $document->file_path,
                );

                return [
                    'id' => $document->id,
                    'module' => $document->module,
                    'document_type' => $documentType,
                    'reference_id' => $document->reference_id,
                    'file_path' => $document->file_path,
                    'file_url' => Storage::disk('public')->url($document->file_path),
                    'expiry_date' => $document->expiry_date?->toDateString(),
                    'created_at' => $document->created_at?->toISOString(),
                ];
            })
            ->values()
            ->all();

        return $base;
    }

    private function storeAttachment(Customer $customer, Request $request): void
    {
        if (!$request->hasFile('attachment')) {
            return;
        }

        $file = $request->file('attachment');
        if (!$file || !$file->isValid()) {
            return;
        }

        $documentType = $this->resolveCustomerDocumentType($file);

        if ($documentType === 'customer_image') {
            $this->removeExistingCustomerImages($customer);
        }

        $path = $file->store('documents/customers', 'public');

        Document::query()->create([
            'module' => 'customer',
            'document_type' => $documentType,
            'reference_id' => (int) $customer->id,
            'file_path' => $path,
            'expiry_date' => null,
            'created_at' => now(),
        ]);
    }

    private function removeExistingCustomerImages(Customer $customer): void
    {
        $documents = Document::query()
            ->where('module', 'customer')
            ->where('reference_id', (int) $customer->id)
            ->where('document_type', 'customer_image')
            ->get();

        foreach ($documents as $document) {
            if (trim((string) $document->file_path) !== '') {
                Storage::disk('public')->delete($document->file_path);
            }
            $document->delete();
        }
    }

    private function inferCustomerDocumentType(string $documentType, string $filePath): string
    {
        $normalized = trim(strtolower($documentType));
        if ($normalized !== '') {
            return $normalized;
        }

        $extension = strtolower((string) pathinfo($filePath, PATHINFO_EXTENSION));
        $imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];

        return in_array($extension, $imageExtensions, true)
            ? 'customer_image'
            : 'customer_attachment';
    }

    private function resolveCustomerDocumentType(UploadedFile $file): string
    {
        $mime = strtolower((string) $file->getMimeType());
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];

        if (str_starts_with($mime, 'image/') || in_array($extension, $imageExtensions, true)) {
            return 'customer_image';
        }

        return 'customer_attachment';
    }
}


