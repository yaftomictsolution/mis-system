<?php

namespace App\Support;

use App\Models\ApartmentSale;
use App\Models\Installment;

class ApartmentSaleCustomerAmounts
{
    public static function netPrice(ApartmentSale $sale): float
    {
        $netPrice = $sale->net_price ?? ((float) $sale->total_price - (float) $sale->discount);

        return self::toMoney($netPrice);
    }

    public static function companyShare(ApartmentSale $sale): float
    {
        return self::toMoney(self::netPrice($sale) * 0.85);
    }

    public static function municipalityShare(ApartmentSale $sale): float
    {
        return self::toMoney(self::netPrice($sale) * 0.15);
    }

    public static function paidTotal(iterable $installments): float
    {
        $total = 0.0;

        foreach ($installments as $installment) {
            $total += (float) ($installment->paid_amount ?? 0);
        }

        return self::toMoney($total);
    }

    /**
     * Returns adjusted installment amounts keyed by installment id/uuid/fallback.
     *
     * @param iterable<Installment> $installments
     * @return array<string,float>
     */
    public static function installmentAmounts(ApartmentSale $sale, iterable $installments): array
    {
        $rows = [];
        foreach ($installments as $index => $installment) {
            $rows[] = [
                'key' => self::installmentKey($installment, is_numeric($index) ? (int) $index : 0),
                'weight_cents' => max(0, (int) round((float) ($installment->amount ?? 0) * 100)),
            ];
        }

        if (empty($rows)) {
            return [];
        }

        $distributed = self::distributeCents(
            totalCents: (int) round(self::companyShare($sale) * 100),
            weights: array_column($rows, 'weight_cents'),
        );

        $result = [];
        foreach ($rows as $index => $row) {
            $result[$row['key']] = self::toMoney(($distributed[$index] ?? 0) / 100);
        }

        return $result;
    }

    /**
     * @param iterable<Installment> $installments
     */
    public static function hasUnpaidInstallments(ApartmentSale $sale, iterable $installments): bool
    {
        $amounts = self::installmentAmounts($sale, $installments);

        foreach ($installments as $index => $installment) {
            $key = self::installmentKey($installment, is_numeric($index) ? (int) $index : 0);
            $target = $amounts[$key] ?? self::toMoney($installment->amount ?? 0);
            $paid = self::toMoney($installment->paid_amount ?? 0);

            if ($paid + 0.0001 < $target) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int,int> $weights
     * @return array<int,int>
     */
    public static function distributeCents(int $totalCents, array $weights): array
    {
        $count = count($weights);
        if ($count === 0 || $totalCents <= 0) {
          return array_fill(0, $count, 0);
        }

        $safeWeights = array_map(static fn ($weight): int => max(0, (int) $weight), $weights);
        $weightSum = array_sum($safeWeights);

        if ($weightSum <= 0) {
            $base = intdiv($totalCents, $count);
            $remainder = $totalCents % $count;
            $result = array_fill(0, $count, $base);

            for ($i = 0; $i < $remainder; $i++) {
                $result[$i] += 1;
            }

            return $result;
        }

        $allocated = 0;
        $result = [];
        $fractions = [];

        foreach ($safeWeights as $index => $weight) {
            $exact = ($totalCents * $weight) / $weightSum;
            $floor = (int) floor($exact);
            $result[$index] = $floor;
            $allocated += $floor;
            $fractions[] = [
                'index' => $index,
                'fraction' => $exact - $floor,
            ];
        }

        usort($fractions, static function (array $a, array $b): int {
            $cmp = $b['fraction'] <=> $a['fraction'];
            if ($cmp !== 0) {
                return $cmp;
            }

            return $a['index'] <=> $b['index'];
        });

        $remaining = $totalCents - $allocated;
        for ($i = 0; $i < $remaining; $i++) {
            $targetIndex = $fractions[$i % $count]['index'];
            $result[$targetIndex] += 1;
        }

        ksort($result);

        return array_values($result);
    }

    private static function installmentKey(Installment $installment, int $index = 0): string
    {
        if ($installment->id) {
            return 'id:' . $installment->id;
        }

        if (!empty($installment->uuid)) {
            return 'uuid:' . $installment->uuid;
        }

        return 'row:' . $index . ':' . (int) ($installment->installment_no ?? 0);
    }

    private static function toMoney(mixed $value): float
    {
        $number = (float) $value;
        if (!is_finite($number) || $number < 0) {
            return 0.0;
        }

        return round($number, 2);
    }
}
