<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Apartment;
use App\Models\ApartmentRental;
use App\Models\ApartmentSale;
use App\Models\Customer;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    private const MODULES = [
        'customer' => 'Customer',
        'apartment' => 'Apartment',
        'apartment_sale' => 'Apartment Sale',
        'rental' => 'Rental',
    ];

    private const DOCUMENT_TYPES = [
        'customer' => [
            'customer_image' => 'Customer Image',
            'customer_deed_document' => 'Customer Deed Document',
            'customer_attachment' => 'Customer Attachment',
        ],
        'apartment' => [
            'apartment_image' => 'Apartment Image',
            'apartment_document' => 'Apartment Document',
        ],
        'apartment_sale' => [
            'deed_document' => 'Deed Document',
            'sale_contract' => 'Sale Contract',
            'sale_receipt' => 'Sale Receipt',
        ],
        'rental' => [
            'rental_contract' => 'Rental Contract',
            'rental_receipt' => 'Rental Receipt',
            'tenant_document' => 'Tenant Document',
        ],
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['nullable', 'string', Rule::in(array_keys(self::MODULES))],
            'q' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Document::query()->orderByDesc('created_at');

        if (!empty($validated['module'])) {
            $query->where('module', (string) $validated['module']);
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('file_path', 'like', '%' . $search . '%')
                    ->orWhere('document_type', 'like', '%' . $search . '%');
            });
        }

        $perPage = (int) ($validated['per_page'] ?? 20);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items());
        $referenceLabels = $this->resolveReferenceLabels($items);

        return response()->json([
            'data' => $items->map(fn (Document $document) => $this->documentPayload($document, $referenceLabels))->values()->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
            ],
        ]);
    }

    public function referenceOptions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['required', 'string', Rule::in(array_keys(self::MODULES))],
        ]);

        $module = (string) $validated['module'];

        return response()->json([
            'module' => $module,
            'label' => self::MODULES[$module],
            'document_types' => collect(self::DOCUMENT_TYPES[$module] ?? [])->map(fn (string $label, string $value): array => [
                'value' => $value,
                'label' => $label,
            ])->values()->all(),
            'data' => $this->loadReferenceOptions($module),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['required', 'string', Rule::in(array_keys(self::MODULES))],
            'reference_id' => ['required', 'integer', 'min:1'],
            'document' => ['required', 'file', 'max:20480', 'mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx'],
        ]);

        $module = (string) $validated['module'];
        $typeValidated = $request->validate([
            'document_type' => ['required', 'string', Rule::in($this->documentTypesForModule($module))],
        ]);

        $referenceId = (int) $validated['reference_id'];
        $documentType = (string) $typeValidated['document_type'];

        $this->assertReferenceExists($module, $referenceId);

        /** @var UploadedFile $file */
        $file = $request->file('document');
        $storedPath = $file->storeAs(
            'documents/' . $module,
            $this->buildStoredName($file),
            'public'
        );

        $document = Document::query()->create([
            'module' => $module,
            'document_type' => $documentType,
            'reference_id' => $referenceId,
            'file_path' => $storedPath,
            'expiry_date' => null,
            'created_at' => now(),
        ]);

        $labels = $this->resolveReferenceLabels(collect([$document]));

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'data' => $this->documentPayload($document, $labels),
        ], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        $document = Document::query()->findOrFail($id);

        DB::transaction(function () use ($document): void {
            if (trim((string) $document->file_path) !== '') {
                Storage::disk('public')->delete($document->file_path);
            }
            $document->delete();
        });

        return response()->json([
            'message' => 'Document deleted successfully.',
        ]);
    }

    private function buildStoredName(UploadedFile $file): string
    {
        $original = pathinfo((string) $file->getClientOriginalName(), PATHINFO_FILENAME);
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $base = Str::of($original)->trim()->slug('_')->limit(80, '');
        $safeBase = $base !== '' ? (string) $base : 'document';
        $timestamp = now()->format('Ymd_His');

        return $safeBase . '_' . $timestamp . ($extension !== '' ? '.' . $extension : '');
    }

    /** @return array<string> */
    private function documentTypesForModule(string $module): array
    {
        return array_keys(self::DOCUMENT_TYPES[$module] ?? []);
    }

    /** @return array<int, array{id:int,label:string}> */
    private function loadReferenceOptions(string $module): array
    {
        return match ($module) {
            'customer' => Customer::query()
                ->orderBy('name')
                ->limit(200)
                ->get(['id', 'name', 'phone'])
                ->map(fn (Customer $customer): array => [
                    'id' => (int) $customer->id,
                    'label' => trim((string) $customer->name) . ' (' . trim((string) ($customer->phone ?? '-')) . ')',
                ])
                ->values()
                ->all(),
            'apartment' => Apartment::query()
                ->orderBy('apartment_code')
                ->limit(200)
                ->get(['id', 'apartment_code', 'unit_number'])
                ->map(fn (Apartment $apartment): array => [
                    'id' => (int) $apartment->id,
                    'label' => trim((string) $apartment->apartment_code) . ' - Unit ' . trim((string) ($apartment->unit_number ?? '')),
                ])
                ->values()
                ->all(),
            'apartment_sale' => ApartmentSale::query()
                ->with(['customer:id,name', 'apartment:id,apartment_code,unit_number'])
                ->orderByDesc('updated_at')
                ->limit(200)
                ->get(['id', 'sale_id', 'customer_id', 'apartment_id'])
                ->map(function (ApartmentSale $sale): array {
                    $saleLabel = trim((string) ($sale->sale_id ?? ('Sale #' . $sale->id)));
                    $customerName = trim((string) ($sale->customer?->name ?? 'Customer'));
                    $apartmentLabel = trim((string) ($sale->apartment?->apartment_code ?? 'Apartment'));

                    return [
                        'id' => (int) $sale->id,
                        'label' => $saleLabel . ' - ' . $customerName . ' - ' . $apartmentLabel,
                    ];
                })
                ->values()
                ->all(),
            'rental' => ApartmentRental::query()
                ->with(['tenant:id,name', 'apartment:id,apartment_code,unit_number'])
                ->orderByDesc('updated_at')
                ->limit(200)
                ->get(['id', 'rental_id', 'tenant_id', 'apartment_id'])
                ->map(function (ApartmentRental $rental): array {
                    $rentalLabel = trim((string) ($rental->rental_id ?? ('Rental #' . $rental->id)));
                    $tenantName = trim((string) ($rental->tenant?->name ?? 'Tenant'));
                    $apartmentLabel = trim((string) ($rental->apartment?->apartment_code ?? 'Apartment'));

                    return [
                        'id' => (int) $rental->id,
                        'label' => $rentalLabel . ' - ' . $tenantName . ' - ' . $apartmentLabel,
                    ];
                })
                ->values()
                ->all(),
            default => [],
        };
    }

    private function assertReferenceExists(string $module, int $referenceId): void
    {
        $exists = match ($module) {
            'customer' => Customer::query()->where('id', $referenceId)->exists(),
            'apartment' => Apartment::query()->where('id', $referenceId)->exists(),
            'apartment_sale' => ApartmentSale::query()->where('id', $referenceId)->exists(),
            'rental' => ApartmentRental::query()->where('id', $referenceId)->exists(),
            default => false,
        };

        abort_if(! $exists, 422, 'Selected reference record does not exist.');
    }

    /**
     * @param Collection<int, Document> $documents
     * @return array<string, string>
     */
    private function resolveReferenceLabels(Collection $documents): array
    {
        $labels = [];

        $customerIds = $documents->where('module', 'customer')->pluck('reference_id')->unique()->filter()->all();
        if (!empty($customerIds)) {
            Customer::query()->whereIn('id', $customerIds)->get(['id', 'name', 'phone'])->each(function (Customer $customer) use (&$labels): void {
                $labels['customer:' . (int) $customer->id] = trim((string) $customer->name) . ' (' . trim((string) ($customer->phone ?? '-')) . ')';
            });
        }

        $apartmentIds = $documents->where('module', 'apartment')->pluck('reference_id')->unique()->filter()->all();
        if (!empty($apartmentIds)) {
            Apartment::query()->whereIn('id', $apartmentIds)->get(['id', 'apartment_code', 'unit_number'])->each(function (Apartment $apartment) use (&$labels): void {
                $labels['apartment:' . (int) $apartment->id] = trim((string) $apartment->apartment_code) . ' - Unit ' . trim((string) ($apartment->unit_number ?? ''));
            });
        }

        $saleIds = $documents->where('module', 'apartment_sale')->pluck('reference_id')->unique()->filter()->all();
        if (!empty($saleIds)) {
            ApartmentSale::query()
                ->with(['customer:id,name', 'apartment:id,apartment_code'])
                ->whereIn('id', $saleIds)
                ->get(['id', 'sale_id', 'customer_id', 'apartment_id'])
                ->each(function (ApartmentSale $sale) use (&$labels): void {
                    $labels['apartment_sale:' . (int) $sale->id] = trim((string) ($sale->sale_id ?? ('Sale #' . $sale->id)))
                        . ' - ' . trim((string) ($sale->customer?->name ?? 'Customer'))
                        . ' - ' . trim((string) ($sale->apartment?->apartment_code ?? 'Apartment'));
                });
        }

        $rentalIds = $documents->where('module', 'rental')->pluck('reference_id')->unique()->filter()->all();
        if (!empty($rentalIds)) {
            ApartmentRental::query()
                ->with(['tenant:id,name', 'apartment:id,apartment_code'])
                ->whereIn('id', $rentalIds)
                ->get(['id', 'rental_id', 'tenant_id', 'apartment_id'])
                ->each(function (ApartmentRental $rental) use (&$labels): void {
                    $labels['rental:' . (int) $rental->id] = trim((string) ($rental->rental_id ?? ('Rental #' . $rental->id)))
                        . ' - ' . trim((string) ($rental->tenant?->name ?? 'Tenant'))
                        . ' - ' . trim((string) ($rental->apartment?->apartment_code ?? 'Apartment'));
                });
        }

        return $labels;
    }

    /** @param array<string,string> $referenceLabels */
    private function documentPayload(Document $document, array $referenceLabels): array
    {
        $key = $document->module . ':' . (int) $document->reference_id;
        $basename = trim((string) basename((string) $document->file_path));
        $documentType = $this->normalizeDocumentType($document);

        return [
            'id' => (int) $document->id,
            'module' => (string) $document->module,
            'module_label' => self::MODULES[(string) $document->module] ?? Str::title(str_replace('_', ' ', (string) $document->module)),
            'document_type' => $documentType,
            'document_type_label' => $this->documentTypeLabel((string) $document->module, $documentType),
            'reference_id' => (int) $document->reference_id,
            'reference_label' => $referenceLabels[$key] ?? ('Record #' . (int) $document->reference_id),
            'file_name' => $basename,
            'file_path' => (string) $document->file_path,
            'file_url' => Storage::disk('public')->url((string) $document->file_path),
            'download_url' => Storage::disk('public')->url((string) $document->file_path),
            'expiry_date' => $document->expiry_date?->toDateString(),
            'created_at' => $document->created_at?->toISOString(),
        ];
    }

    private function normalizeDocumentType(Document $document): string
    {
        $stored = trim((string) ($document->document_type ?? ''));
        if ($stored !== '') {
            return $stored;
        }

        $extension = strtolower((string) pathinfo((string) $document->file_path, PATHINFO_EXTENSION));
        $imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];

        return match ((string) $document->module) {
            'customer' => in_array($extension, $imageExtensions, true) ? 'customer_image' : 'customer_attachment',
            'apartment' => in_array($extension, $imageExtensions, true) ? 'apartment_image' : 'apartment_document',
            'apartment_sale' => 'deed_document',
            'rental' => 'rental_contract',
            default => 'document',
        };
    }

    private function documentTypeLabel(string $module, string $documentType): string
    {
        return self::DOCUMENT_TYPES[$module][$documentType]
            ?? Str::title(str_replace('_', ' ', $documentType));
    }
}