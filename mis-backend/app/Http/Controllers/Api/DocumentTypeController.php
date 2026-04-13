<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Document;
use App\Models\DocumentType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DocumentTypeController extends Controller
{
    private const MODULES = [
        'customer' => 'Customer',
        'apartment' => 'Apartment',
        'apartment_sale' => 'Apartment Sale',
        'rental' => 'Rental',
        'accounts' => 'Accounts',
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['nullable', 'string', Rule::in(array_keys(self::MODULES))],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = DocumentType::query()->orderBy('module')->orderBy('label');

        if (!empty($validated['module'])) {
            $query->where('module', (string) $validated['module']);
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (DocumentType $documentType): array => $this->payload($documentType))
                ->values()
                ->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'module' => ['required', 'string', Rule::in(array_keys(self::MODULES))],
            'label' => ['required', 'string', 'max:120'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $module = (string) $validated['module'];
        $label = trim((string) $validated['label']);
        $code = $this->makeCode($label);

        $duplicate = DocumentType::query()
            ->where('module', $module)
            ->where('code', $code)
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'label' => ['A document type with the same generated code already exists for this module.'],
            ]);
        }

        $documentType = DB::transaction(function () use ($module, $label, $code, $validated) {
            return DocumentType::query()->create([
                'uuid' => (string) Str::uuid(),
                'module' => $module,
                'code' => $code,
                'label' => $label,
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            ]);
        });

        return response()->json([
            'data' => $this->payload($documentType),
        ], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $documentType = DocumentType::query()->where('uuid', $uuid)->firstOrFail();

        $validated = $request->validate([
            'label' => ['required', 'string', 'max:120'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $documentType = DB::transaction(function () use ($documentType, $validated) {
            $documentType = DocumentType::query()->where('id', $documentType->id)->lockForUpdate()->firstOrFail();
            $documentType->fill([
                'label' => trim((string) $validated['label']),
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : (bool) $documentType->is_active,
            ]);
            $documentType->save();

            return $documentType;
        });

        return response()->json([
            'data' => $this->payload($documentType),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $documentType = DocumentType::query()->where('uuid', $uuid)->firstOrFail();
        $deleteBlockedMessage = $this->deleteBlockedMessage($documentType);

        if ($deleteBlockedMessage !== null) {
            return response()->json([
                'message' => $deleteBlockedMessage,
            ], 409);
        }

        $documentType->delete();

        return response()->json([
            'message' => 'Document type deleted successfully.',
        ]);
    }

    private function makeCode(string $label): string
    {
        $code = Str::of($label)->trim()->ascii()->snake()->trim('_')->value();

        return Str::limit($code !== '' ? $code : 'document_type', 80, '');
    }

    private function deleteBlockedMessage(DocumentType $documentType): ?string
    {
        if ($documentType->module === 'accounts') {
            $hasAccounts = Account::query()
                ->where('account_type', $documentType->code)
                ->exists();

            if ($hasAccounts) {
                return 'This account type is already used by one or more accounts. Move those accounts to a different type first or mark this type inactive instead.';
            }

            return null;
        }

        $hasDocuments = Document::query()
            ->where('module', $documentType->module)
            ->where('document_type', $documentType->code)
            ->exists();

        if ($hasDocuments) {
            return 'This document type is already used by uploaded documents. Remove those documents first or mark the type inactive instead.';
        }

        return null;
    }

    private function payload(DocumentType $documentType): array
    {
        $deleteBlockedMessage = $this->deleteBlockedMessage($documentType);

        return [
            'id' => $documentType->id,
            'uuid' => $documentType->uuid,
            'module' => $documentType->module,
            'code' => $documentType->code,
            'label' => $documentType->label,
            'is_active' => (bool) $documentType->is_active,
            'can_delete' => $deleteBlockedMessage === null,
            'delete_blocked_reason' => $deleteBlockedMessage,
            'created_at' => optional($documentType->created_at)->toISOString(),
            'updated_at' => optional($documentType->updated_at)->toISOString(),
        ];
    }
}
