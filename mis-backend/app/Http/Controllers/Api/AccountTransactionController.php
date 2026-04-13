<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountTransactionController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 12;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'account_id' => ['nullable', 'integer', 'min:1'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = AccountTransaction::query()
            ->with([
                'account:id,uuid,name,currency',
                'createdBy:id,name',
            ])
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        if (!empty($validated['account_id'])) {
            $query->where('account_id', (int) $validated['account_id']);
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('direction', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhere('reference_type', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('account', function ($accountQuery) use ($search): void {
                        $accountQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if (!empty($validated['since'])) {
            $query->where('updated_at', '>', $validated['since']);
        }

        if ($request->boolean('offline')) {
            $windowStart = now()->subMonths(self::OFFLINE_WINDOW_MONTHS);
            $query->where('updated_at', '>=', $windowStart);
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => collect($paginator->items())
                ->map(fn (AccountTransaction $transaction): array => $this->payload($transaction))
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

    private function payload(AccountTransaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'uuid' => $transaction->uuid,
            'account_id' => $transaction->account_id,
            'account_uuid' => $transaction->account?->uuid,
            'account_name' => $transaction->account?->name,
            'account_currency' => $transaction->account?->currency,
            'direction' => $transaction->direction,
            'amount' => (float) $transaction->amount,
            'currency_code' => $transaction->currency_code,
            'exchange_rate_snapshot' => $transaction->exchange_rate_snapshot !== null ? (float) $transaction->exchange_rate_snapshot : null,
            'amount_usd' => $transaction->amount_usd !== null ? (float) $transaction->amount_usd : null,
            'module' => $transaction->module,
            'reference_type' => $transaction->reference_type,
            'reference_uuid' => $transaction->reference_uuid,
            'description' => $transaction->description,
            'payment_method' => $transaction->payment_method,
            'transaction_date' => optional($transaction->transaction_date)->toISOString(),
            'created_by_user_id' => $transaction->created_by_user_id,
            'created_by_user_name' => $transaction->createdBy?->name,
            'status' => $transaction->status,
            'reversal_of_id' => $transaction->reversal_of_id,
            'metadata' => $transaction->metadata,
            'created_at' => optional($transaction->created_at)->toISOString(),
            'updated_at' => optional($transaction->updated_at)->toISOString(),
        ];
    }
}
