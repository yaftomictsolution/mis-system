"use client";

export type SupportedCurrency = "USD" | "AFN";

export function normalizeCurrency(value: unknown, fallback: SupportedCurrency = "USD"): SupportedCurrency {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "AFN") return "AFN";
  if (normalized === "USD") return "USD";
  return fallback;
}

export function formatMoney(value: number, currency: SupportedCurrency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function roundMoney(value: number): number {
  return Number(Number(value || 0).toFixed(2));
}

export function roundRate(value: number): number {
  return Number(Number(value || 0).toFixed(6));
}

export function convertUsdToCurrency(amountUsd: number, currency: SupportedCurrency, usdToAfnRate: number | null): number | null {
  if (currency === "USD") return roundMoney(amountUsd);
  if (!usdToAfnRate || !Number.isFinite(usdToAfnRate) || usdToAfnRate <= 0) return null;
  return roundMoney(amountUsd * usdToAfnRate);
}

export function convertCurrencyToUsd(amount: number, currency: SupportedCurrency, usdToAfnRate: number | null): number | null {
  if (currency === "USD") return roundMoney(amount);
  if (!usdToAfnRate || !Number.isFinite(usdToAfnRate) || usdToAfnRate <= 0) return null;
  return roundMoney(amount / usdToAfnRate);
}

export function convertAmountBetweenCurrencies(
  amount: number,
  sourceCurrency: SupportedCurrency,
  targetCurrency: SupportedCurrency,
  usdToAfnRate: number | null
): number | null {
  if (sourceCurrency === targetCurrency) return roundMoney(amount);
  const amountUsd = convertCurrencyToUsd(amount, sourceCurrency, usdToAfnRate);
  if (amountUsd === null) return null;
  return convertUsdToCurrency(amountUsd, targetCurrency, usdToAfnRate);
}

export function formatExchangeRate(usdToAfnRate: number | null): string {
  if (!usdToAfnRate || !Number.isFinite(usdToAfnRate) || usdToAfnRate <= 0) {
    return "No active rate";
  }

  return `1 USD = ${usdToAfnRate.toFixed(4)} AFN`;
}
