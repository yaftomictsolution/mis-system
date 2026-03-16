<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreApartmentRequest;
use App\Models\Apartment;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ApartmentController extends Controller
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

        $query = Apartment::query()
            ->select([
                'id',
                'uuid',
                'apartment_code',
                'total_price',
                'usage_type',
                'block_number',
                'unit_number',
                'floor_number',
                'bedrooms',
                'halls',
                'bathrooms',
                'kitchens',
                'balcony',
                'area_sqm',
                'apartment_shape',
                'corridor',
                'status',
                'qr_code',
                'additional_info',
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
                    ->where('apartment_code', 'like', "%{$search}%")
                    ->orWhere('usage_type', 'like', "%{$search}%")
                    ->orWhere('block_number', 'like', "%{$search}%")
                    ->orWhere('unit_number', 'like', "%{$search}%")
                    ->orWhere('floor_number', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('apartment_shape', 'like', "%{$search}%")
                    ->orWhere('corridor', 'like', "%{$search}%")
                    ->orWhere('additional_info', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['since'])) {
            $query->where(function ($builder) use ($validated) {
                $builder
                    ->where('updated_at', '>', $validated['since'])
                    ->orWhere('deleted_at', '>', $validated['since']);
            });
        }

        if (!empty($validated['offline'])) {
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
            ->map(fn (Apartment $apartment) => $this->apartmentPayload($apartment))
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

    public function store(StoreApartmentRequest $request): JsonResponse
    {
        $data = $request->validated();

        $incomingUuid = (string) ($data['uuid'] ?? '');
        $apartmentCode = trim((string) ($data['apartment_code'] ?? ''));
        $matches = collect();

        if ($incomingUuid !== '') {
            $matchByUuid = Apartment::withTrashed()->where('uuid', $incomingUuid)->first();
            if ($matchByUuid) {
                $matches->push($matchByUuid);
            }
        }

        if ($apartmentCode !== '') {
            $matchByCode = Apartment::withTrashed()->where('apartment_code', $apartmentCode)->first();
            if ($matchByCode) {
                $matches->push($matchByCode);
            }
        }

        $uniqueMatches = $matches->unique('id')->values();
        if ($uniqueMatches->count() > 1) {
            return response()->json([
                'message' => 'Conflicting identifiers for apartment create request.',
            ], 409);
        }

        $apartment = $uniqueMatches->first();
        $created = false;
        $restored = false;

        if (!$apartment) {
            $apartment = new Apartment();
            $apartment->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($apartment->trashed()) {
            $apartment->restore();
            $restored = true;
        } elseif ($incomingUuid !== '' && $apartment->uuid === $incomingUuid) {
        } else {
            return response()->json([
                'message' => 'Apartment already exists.',
                'data' => $this->apartmentPayload($apartment),
            ], 409);
        }

        $updateData = $data;
        unset($updateData['uuid']);
        $apartment->fill($updateData);
        $apartment->save();

        return response()->json([
            'data' => $this->apartmentPayload($apartment->fresh(['documents'])),
            'restored' => $restored,
        ], $created ? 201 : 200);
    }

    public function update(StoreApartmentRequest $request, string $uuid): JsonResponse
    {
        $apartment = Apartment::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($apartment->trashed()) {
            $apartment->restore();
        }

        $data = $request->validated();
        unset($data['uuid']);
        $apartment->fill($data);
        $apartment->save();

        return response()->json([
            'data' => $this->apartmentPayload($apartment->fresh(['documents'])),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $apartment = Apartment::withTrashed()->where('uuid', $uuid)->first();
        if ($apartment && !$apartment->trashed()) {
            $apartment->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    private function apartmentPayload(Apartment $apartment): array
    {
        $base = $apartment->only([
            'id',
            'uuid',
            'apartment_code',
            'total_price',
            'usage_type',
            'block_number',
            'unit_number',
            'floor_number',
            'bedrooms',
            'halls',
            'bathrooms',
            'kitchens',
            'balcony',
            'area_sqm',
            'apartment_shape',
            'corridor',
            'status',
            'qr_code',
            'additional_info',
            'updated_at',
            'deleted_at',
        ]);

        $documents = $apartment->relationLoaded('documents')
            ? $apartment->documents->sortByDesc(fn (Document $document) => $document->created_at?->getTimestamp() ?? 0)->values()
            : collect();

        $base['documents'] = $documents
            ->map(function (Document $document): array {
                return [
                    'id' => $document->id,
                    'module' => $document->module,
                    'document_type' => $this->inferApartmentDocumentType(
                        (string) ($document->document_type ?? ''),
                        (string) $document->file_path,
                    ),
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

    private function inferApartmentDocumentType(string $documentType, string $filePath): string
    {
        $normalized = trim(strtolower($documentType));
        if ($normalized !== '') {
            return $normalized;
        }

        $extension = strtolower((string) pathinfo($filePath, PATHINFO_EXTENSION));
        $imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];

        return in_array($extension, $imageExtensions, true)
            ? 'apartment_image'
            : 'apartment_document';
    }
}
