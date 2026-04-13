<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAccountRequest;
use App\Models\Account;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AccountController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 12;

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

        $query = Account::query()->orderByDesc('updated_at');
        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('account_type', 'like', "%{$search}%")
                    ->orWhere('bank_name', 'like', "%{$search}%")
                    ->orWhere('account_number', 'like', "%{$search}%")
                    ->orWhere('currency', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%");
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
                ->map(fn (Account $account): array => $this->payload($account))
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

    public function store(StoreAccountRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');
        $created = false;

        $account = DB::transaction(function () use ($incomingUuid, $data, &$created) {
            $account = $incomingUuid !== ''
                ? Account::withTrashed()->where('uuid', $incomingUuid)->lockForUpdate()->first()
                : null;

            if (! $account) {
                $account = new Account();
                $account->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
                $created = true;
                $account->current_balance = round((float) ($data['opening_balance'] ?? 0), 2);
            } elseif ($account->trashed()) {
                $account->restore();
            }

            $previousOpening = round((float) ($account->opening_balance ?? 0), 2);
            $this->fillAccount($account, $data);
            if (! $created) {
                $delta = round((float) $account->opening_balance - $previousOpening, 2);
                $account->current_balance = round((float) $account->current_balance + $delta, 2);
            }

            $account->save();

            return $account->fresh();
        });

        return response()->json([
            'data' => $this->payload($account),
        ], $created ? 201 : 200);
    }

    public function update(StoreAccountRequest $request, string $uuid): JsonResponse
    {
        $account = Account::withTrashed()->where('uuid', $uuid)->firstOrFail();

        $account = DB::transaction(function () use ($account, $request) {
            $account = Account::withTrashed()->where('id', $account->id)->lockForUpdate()->firstOrFail();
            if ($account->trashed()) {
                $account->restore();
            }

            $previousOpening = round((float) ($account->opening_balance ?? 0), 2);
            $this->fillAccount($account, $request->validated());
            $delta = round((float) $account->opening_balance - $previousOpening, 2);
            $account->current_balance = round((float) $account->current_balance + $delta, 2);
            $account->save();

            return $account->fresh();
        });

        return response()->json([
            'data' => $this->payload($account),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $account = Account::withTrashed()->where('uuid', $uuid)->first();
        if ($account && ! $account->trashed()) {
            if ($message = $this->deleteBlockedMessage($account)) {
                return response()->json([
                    'message' => $message,
                ], 409);
            }

            $account->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $account = Account::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $account->trashed()) {
            return response()->json([
                'message' => 'Account must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $account->forceDelete();
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Account', $account),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function fillAccount(Account $account, array $data): void
    {
        $account->fill([
            'name' => trim((string) $data['name']),
            'account_type' => trim((string) ($data['account_type'] ?? 'office')),
            'bank_name' => !empty($data['bank_name']) ? trim((string) $data['bank_name']) : null,
            'account_number' => !empty($data['account_number']) ? trim((string) $data['account_number']) : null,
            'currency' => strtoupper(trim((string) ($data['currency'] ?? 'USD'))),
            'opening_balance' => round((float) ($data['opening_balance'] ?? 0), 2),
            'status' => trim((string) ($data['status'] ?? 'active')) ?: 'active',
            'notes' => !empty($data['notes']) ? trim((string) $data['notes']) : null,
        ]);
    }

    private function deleteBlockedMessage(Account $account): ?string
    {
        $hasTransactions = $account->transactions()->exists();
        $hasSalaryPayments = $account->salaryPayments()->whereNull('deleted_at')->exists();

        if ($hasTransactions && $hasSalaryPayments) {
            return 'Cannot delete account with transaction and salary payment history. Mark it inactive instead.';
        }

        if ($hasTransactions) {
            return 'Cannot delete account with transaction history. Mark it inactive instead.';
        }

        if ($hasSalaryPayments) {
            return 'Cannot delete account linked to salary payments. Mark it inactive instead.';
        }

        return null;
    }

    private function payload(Account $account): array
    {
        $deleteBlockedMessage = $this->deleteBlockedMessage($account);

        return [
            'id' => $account->id,
            'uuid' => $account->uuid,
            'name' => $account->name,
            'account_type' => $account->account_type,
            'bank_name' => $account->bank_name,
            'account_number' => $account->account_number,
            'currency' => $account->currency,
            'opening_balance' => (float) $account->opening_balance,
            'current_balance' => (float) $account->current_balance,
            'status' => $account->status,
            'notes' => $account->notes,
            'can_delete' => $deleteBlockedMessage === null,
            'delete_blocked_reason' => $deleteBlockedMessage,
            'created_at' => optional($account->created_at)->toISOString(),
            'updated_at' => optional($account->updated_at)->toISOString(),
            'deleted_at' => optional($account->deleted_at)->toISOString(),
        ];
    }
}
