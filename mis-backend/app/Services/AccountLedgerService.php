<?php

namespace App\Services;

use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\SalaryPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountLedgerService
{
    public function __construct(
        private readonly ExchangeRateService $exchangeRateService,
    ) {
    }

    public function postModuleTransaction(
        int $accountId,
        float $sourceAmount,
        string $sourceCurrency,
        string $direction,
        string $module,
        string $referenceType,
        string $referenceUuid,
        string $description,
        ?string $paymentMethod = null,
        mixed $transactionDate = null,
        ?int $actorId = null,
        array $metadata = [],
        string $errorKey = 'account_id'
    ): array {
        $normalizedDirection = strtolower(trim($direction));
        if (! in_array($normalizedDirection, ['in', 'out'], true)) {
            throw ValidationException::withMessages([
                $errorKey => 'Account transaction direction is invalid.',
            ]);
        }

        $account = Account::query()->lockForUpdate()->findOrFail($accountId);
        $accountCurrency = $this->exchangeRateService->normalizeCurrency($account->currency);
        $normalizedSourceCurrency = $this->exchangeRateService->normalizeCurrency($sourceCurrency);
        $roundedSourceAmount = round(max(0, $sourceAmount), 2);

        if ($roundedSourceAmount <= 0) {
            throw ValidationException::withMessages([
                $errorKey => 'Account transaction amount must be greater than 0.',
            ]);
        }

        $needsRate = $normalizedSourceCurrency !== ExchangeRateService::BASE_CURRENCY
            || $accountCurrency !== ExchangeRateService::BASE_CURRENCY;
        $rateSnapshot = $needsRate
            ? round((float) $this->exchangeRateService->getRequiredUsdToAfnRate()->rate, 6)
            : 1.0;

        $amount = $this->exchangeRateService->convertAmountBetweenCurrencies(
            $roundedSourceAmount,
            $normalizedSourceCurrency,
            $accountCurrency,
            $rateSnapshot
        );
        $amountUsd = $this->exchangeRateService->convertCurrencyAmountToUsd(
            $roundedSourceAmount,
            $normalizedSourceCurrency,
            $rateSnapshot
        );

        if ($normalizedDirection === 'out' && round((float) $account->current_balance, 2) < $amount) {
            throw ValidationException::withMessages([
                $errorKey => 'Selected account balance is smaller than the required transaction amount.',
            ]);
        }

        $transaction = AccountTransaction::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'direction' => $normalizedDirection,
            'amount' => $amount,
            'currency_code' => $accountCurrency,
            'exchange_rate_snapshot' => $rateSnapshot,
            'amount_usd' => $amountUsd,
            'module' => $module,
            'reference_type' => $referenceType,
            'reference_uuid' => $referenceUuid,
            'description' => $description,
            'payment_method' => $paymentMethod,
            'transaction_date' => $transactionDate ?: now(),
            'created_by_user_id' => $actorId,
            'status' => 'posted',
            'metadata' => $metadata ?: null,
        ]);

        $account->current_balance = $normalizedDirection === 'in'
            ? round((float) $account->current_balance + $amount, 2)
            : round((float) $account->current_balance - $amount, 2);
        $account->saveQuietly();

        return [
            'account' => $account,
            'transaction' => $transaction,
            'account_currency' => $accountCurrency,
            'exchange_rate_snapshot' => $rateSnapshot,
            'account_amount' => $amount,
            'amount_usd' => $amountUsd,
        ];
    }

    public function syncSalaryPaymentPosting(SalaryPayment $payment, ?int $actorId = null): void
    {
        DB::transaction(function () use ($payment, $actorId): void {
            $payment = SalaryPayment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($payment->account_transaction_id) {
                $this->reverseLinkedSalaryPaymentPosting(
                    $payment,
                    $actorId,
                    'Salary payment entry updated or cancelled'
                );
                $payment->refresh();
            }

            $shouldPost = $payment->status === 'paid'
                && !empty($payment->account_id)
                && round((float) ($payment->net_salary ?? 0), 2) > 0;

            if (! $shouldPost) {
                $payment->account_transaction_id = null;
                $payment->payment_currency_code = null;
                $payment->exchange_rate_snapshot = null;
                $payment->net_salary_account_amount = null;
                $payment->saveQuietly();
                return;
            }

            $salaryCurrency = $this->exchangeRateService->normalizeCurrency($payment->salary_currency_code);
            $transactionDate = $payment->paid_at ?: now();
            $posting = $this->postModuleTransaction(
                accountId: (int) $payment->account_id,
                sourceAmount: round((float) $payment->net_salary, 2),
                sourceCurrency: $salaryCurrency,
                direction: 'out',
                module: 'payroll',
                referenceType: 'salary_payment',
                referenceUuid: $payment->uuid,
                description: sprintf('Salary payment for %s', $payment->period ?: 'payroll record'),
                paymentMethod: 'salary_payment',
                transactionDate: $transactionDate,
                actorId: $actorId,
                metadata: [
                    'employee_id' => $payment->employee_id,
                    'salary_payment_id' => $payment->id,
                    'salary_payment_uuid' => $payment->uuid,
                ],
                errorKey: 'account_id'
            );

            $payment->account_transaction_id = $posting['transaction']->id;
            $payment->payment_currency_code = $posting['account_currency'];
            $payment->exchange_rate_snapshot = $posting['exchange_rate_snapshot'];
            $payment->net_salary_account_amount = $posting['account_amount'];
            $payment->saveQuietly();
        });
    }

    public function getRateSnapshotForSalaryCurrency(string $salaryCurrency): float
    {
        return $this->exchangeRateService->rateSnapshotForCurrency($salaryCurrency);
    }

    public function convertSalaryAmountToUsd(float $amount, string $salaryCurrency, ?float $rateSnapshot = null): float
    {
        return $this->exchangeRateService->convertCurrencyAmountToUsd($amount, $salaryCurrency, $rateSnapshot);
    }

    public function reverseLinkedSalaryPaymentPosting(
        SalaryPayment $payment,
        ?int $actorId = null,
        string $reason = 'Salary payment entry deleted'
    ): void {
        if (! $payment->account_transaction_id) {
            return;
        }

        DB::transaction(function () use ($payment, $actorId, $reason): void {
            $payment = SalaryPayment::query()->lockForUpdate()->findOrFail($payment->id);
            if (! $payment->account_transaction_id) {
                return;
            }

            $original = AccountTransaction::query()->find($payment->account_transaction_id);
            if (! $original) {
                $payment->account_transaction_id = null;
                $payment->saveQuietly();
                return;
            }

            if ($original->status === 'reversed') {
                $payment->account_transaction_id = null;
                $payment->saveQuietly();
                return;
            }

            $account = Account::query()->lockForUpdate()->findOrFail($original->account_id);
            $amount = round((float) $original->amount, 2);
            $reverseDirection = $original->direction === 'out' ? 'in' : 'out';

            AccountTransaction::query()->create([
                'uuid' => (string) Str::uuid(),
                'account_id' => $original->account_id,
                'direction' => $reverseDirection,
                'amount' => $amount,
                'currency_code' => $original->currency_code,
                'exchange_rate_snapshot' => $original->exchange_rate_snapshot,
                'amount_usd' => $original->amount_usd,
                'module' => $original->module,
                'reference_type' => 'salary_payment_reversal',
                'reference_uuid' => $payment->uuid,
                'description' => $reason,
                'payment_method' => $original->payment_method,
                'transaction_date' => now(),
                'created_by_user_id' => $actorId,
                'status' => 'posted',
                'reversal_of_id' => $original->id,
                'metadata' => [
                    'salary_payment_id' => $payment->id,
                    'salary_payment_uuid' => $payment->uuid,
                    'reversed_transaction_uuid' => $original->uuid,
                ],
            ]);

            $original->status = 'reversed';
            $original->saveQuietly();

            $account->current_balance = $reverseDirection === 'in'
                ? round((float) $account->current_balance + $amount, 2)
                : round((float) $account->current_balance - $amount, 2);
            $account->saveQuietly();

            $payment->account_transaction_id = null;
            $payment->payment_currency_code = null;
            $payment->exchange_rate_snapshot = null;
            $payment->net_salary_account_amount = null;
            $payment->saveQuietly();
        });
    }
}
