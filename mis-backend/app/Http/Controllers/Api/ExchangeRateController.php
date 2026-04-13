<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreExchangeRateRequest;
use App\Models\ExchangeRate;
use App\Services\ExchangeRateService;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ExchangeRateController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 12;

    public function __construct(
        private readonly ExchangeRateService $exchangeRateService,
    ) {
    }

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

        $query = ExchangeRate::query()
            ->with(['approvedBy:id,name'])
            ->orderByDesc('effective_date')
            ->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('base_currency', 'like', "%{$search}%")
                    ->orWhere('quote_currency', 'like', "%{$search}%")
                    ->orWhere('source', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhere('rate', 'like', "%{$search}%");
            });
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
                        $deleted
                            ->whereNotNull('deleted_at')
                            ->where('deleted_at', '>=', $windowStart);
                    });
            });
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (ExchangeRate $rate): array => $this->payload($rate))
                ->values()
                ->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    public function store(StoreExchangeRateRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $created = false;

        $rate = DB::transaction(function () use ($incomingUuid, $data, $request, &$created) {
            $rate = $incomingUuid !== ''
                ? ExchangeRate::withTrashed()->where('uuid', $incomingUuid)->lockForUpdate()->first()
                : null;

            if (! $rate) {
                $rate = new ExchangeRate();
                $rate->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
                $created = true;
            } elseif ($rate->trashed()) {
                $rate->restore();
            }

            $this->fillRate($rate, $data, (int) ($request->user()?->id ?? 0));
            $rate->save();
            $this->exchangeRateService->syncActivation($rate);

            return $rate->fresh(['approvedBy']);
        });

        return response()->json([
            'data' => $this->payload($rate),
        ], $created ? 201 : 200);
    }

    public function update(StoreExchangeRateRequest $request, string $uuid): JsonResponse
    {
        $rate = ExchangeRate::withTrashed()->where('uuid', $uuid)->firstOrFail();

        $rate = DB::transaction(function () use ($rate, $request) {
            $rate = ExchangeRate::withTrashed()->where('id', $rate->id)->lockForUpdate()->firstOrFail();
            if ($rate->trashed()) {
                $rate->restore();
            }

            $this->fillRate($rate, $request->validated(), (int) ($request->user()?->id ?? 0));
            $rate->save();
            $this->exchangeRateService->syncActivation($rate);

            return $rate->fresh(['approvedBy']);
        });

        return response()->json([
            'data' => $this->payload($rate),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $rate = ExchangeRate::withTrashed()->where('uuid', $uuid)->first();
        if ($rate && ! $rate->trashed()) {
            try {
                $this->exchangeRateService->ensureCanDelete($rate);
            } catch (ValidationException $exception) {
                return response()->json([
                    'message' => $exception->errors()['message'][0] ?? 'Exchange rate cannot be deleted.',
                ], 409);
            }

            $rate->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $rate = ExchangeRate::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $rate->trashed()) {
            return response()->json([
                'message' => 'Exchange rate must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $rate->forceDelete();
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Exchange Rate', $rate),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function fillRate(ExchangeRate $rate, array $data, int $actorId): void
    {
        $rate->fill([
            'base_currency' => 'USD',
            'quote_currency' => 'AFN',
            'rate' => round((float) ($data['rate'] ?? 0), 6),
            'source' => trim((string) ($data['source'] ?? 'manual')) ?: 'manual',
            'effective_date' => !empty($data['effective_date']) ? $data['effective_date'] : ($rate->effective_date ?: now()->toDateString()),
            'approved_by_user_id' => $actorId > 0 ? $actorId : $rate->approved_by_user_id,
            'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : ($rate->exists ? (bool) $rate->is_active : true),
            'notes' => !empty($data['notes']) ? trim((string) $data['notes']) : null,
        ]);
    }

    private function deleteBlockedMessage(ExchangeRate $rate): ?string
    {
        try {
            $this->exchangeRateService->ensureCanDelete($rate);
            return null;
        } catch (ValidationException $exception) {
            return $exception->errors()['message'][0] ?? 'Exchange rate cannot be deleted.';
        }
    }

    private function payload(ExchangeRate $rate): array
    {
        $deleteBlockedMessage = $this->deleteBlockedMessage($rate);

        return [
            'id' => $rate->id,
            'uuid' => $rate->uuid,
            'base_currency' => $rate->base_currency,
            'quote_currency' => $rate->quote_currency,
            'rate' => (float) $rate->rate,
            'source' => $rate->source,
            'effective_date' => optional($rate->effective_date)->toDateString(),
            'approved_by_user_id' => $rate->approved_by_user_id,
            'approved_by_user_name' => $rate->approvedBy?->name,
            'is_active' => (bool) $rate->is_active,
            'notes' => $rate->notes,
            'can_delete' => $deleteBlockedMessage === null,
            'delete_blocked_reason' => $deleteBlockedMessage,
            'created_at' => optional($rate->created_at)->toISOString(),
            'updated_at' => optional($rate->updated_at)->toISOString(),
            'deleted_at' => optional($rate->deleted_at)->toISOString(),
        ];
    }
}
