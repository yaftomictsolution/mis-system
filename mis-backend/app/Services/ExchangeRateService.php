<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Illuminate\Validation\ValidationException;

class ExchangeRateService
{
    public const BASE_CURRENCY = 'USD';
    public const QUOTE_CURRENCY = 'AFN';

    public function normalizeCurrency(?string $currency, string $fallback = self::BASE_CURRENCY): string
    {
        $normalized = strtoupper(trim((string) $currency));
        if (in_array($normalized, [self::BASE_CURRENCY, self::QUOTE_CURRENCY], true)) {
            return $normalized;
        }

        return $fallback;
    }

    public function getActiveUsdToAfnRate(): ?ExchangeRate
    {
        return ExchangeRate::query()
            ->where('base_currency', self::BASE_CURRENCY)
            ->where('quote_currency', self::QUOTE_CURRENCY)
            ->where('is_active', true)
            ->latest('effective_date')
            ->latest('id')
            ->first();
    }

    public function getRequiredUsdToAfnRate(): ExchangeRate
    {
        $rate = $this->getActiveUsdToAfnRate();
        if (! $rate) {
            throw ValidationException::withMessages([
                'account_id' => 'No active USD to AFN exchange rate is available. Create and activate today\'s official rate first.',
            ]);
        }

        return $rate;
    }

    public function syncActivation(ExchangeRate $rate): void
    {
        if (! $rate->is_active) {
            return;
        }

        ExchangeRate::query()
            ->where('base_currency', $rate->base_currency)
            ->where('quote_currency', $rate->quote_currency)
            ->where('id', '!=', $rate->id)
            ->where('is_active', true)
            ->update(['is_active' => false]);
    }

    public function ensureCanDelete(ExchangeRate $rate): void
    {
        if (! $rate->is_active) {
            return;
        }

        $hasAlternativeActiveRate = ExchangeRate::query()
            ->where('base_currency', $rate->base_currency)
            ->where('quote_currency', $rate->quote_currency)
            ->where('id', '!=', $rate->id)
            ->where('is_active', true)
            ->exists();

        if (! $hasAlternativeActiveRate) {
            throw ValidationException::withMessages([
                'message' => 'You cannot delete the only active official exchange rate. Activate another rate first.',
            ]);
        }
    }

    public function convertUsdToCurrencyAmount(float $amountUsd, string $targetCurrency, ?float $rateSnapshot = null): float
    {
        $normalizedCurrency = $this->normalizeCurrency($targetCurrency);
        if ($normalizedCurrency === self::BASE_CURRENCY) {
            return round($amountUsd, 2);
        }

        if ($normalizedCurrency !== self::QUOTE_CURRENCY) {
            throw ValidationException::withMessages([
                'account_id' => 'Only USD and AFN accounts are supported in the current currency phase.',
            ]);
        }

        $rate = $rateSnapshot ?: (float) $this->getRequiredUsdToAfnRate()->rate;
        return round($amountUsd * $rate, 2);
    }

    public function convertCurrencyAmountToUsd(float $amount, string $sourceCurrency, ?float $rateSnapshot = null): float
    {
        $normalizedCurrency = $this->normalizeCurrency($sourceCurrency);
        if ($normalizedCurrency === self::BASE_CURRENCY) {
            return round($amount, 2);
        }

        if ($normalizedCurrency !== self::QUOTE_CURRENCY) {
            throw ValidationException::withMessages([
                'account_id' => 'Only USD and AFN accounts are supported in the current currency phase.',
            ]);
        }

        $rate = $rateSnapshot ?: (float) $this->getRequiredUsdToAfnRate()->rate;
        return round($amount / $rate, 2);
    }

    public function convertAmountBetweenCurrencies(float $amount, string $sourceCurrency, string $targetCurrency, ?float $rateSnapshot = null): float
    {
        $normalizedSource = $this->normalizeCurrency($sourceCurrency);
        $normalizedTarget = $this->normalizeCurrency($targetCurrency);

        if ($normalizedSource === $normalizedTarget) {
            return round($amount, 2);
        }

        $amountUsd = $this->convertCurrencyAmountToUsd($amount, $normalizedSource, $rateSnapshot);
        return $this->convertUsdToCurrencyAmount($amountUsd, $normalizedTarget, $rateSnapshot);
    }

    public function rateSnapshotForCurrency(string $targetCurrency): float
    {
        $normalizedCurrency = $this->normalizeCurrency($targetCurrency);
        if ($normalizedCurrency === self::BASE_CURRENCY) {
            return 1.0;
        }

        if ($normalizedCurrency !== self::QUOTE_CURRENCY) {
            throw ValidationException::withMessages([
                'account_id' => 'Only USD and AFN accounts are supported in the current currency phase.',
            ]);
        }

        return round((float) $this->getRequiredUsdToAfnRate()->rate, 6);
    }
}
