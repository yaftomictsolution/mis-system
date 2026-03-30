<?php

namespace App\Services;

use App\Models\Apartment;
use App\Models\ApartmentRental;
use App\Models\ApartmentSale;
use App\Models\ApartmentSaleFinancial;
use App\Models\Customer;
use App\Models\Installment;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DashboardSummaryService
{
    public function buildForUser(Authenticatable $user): array
    {
        $now = CarbonImmutable::now();
        $today = $now->startOfDay();
        $weekAhead = $today->addDays(7);
        $currentMonthStart = $now->startOfMonth();
        $nextMonthStart = $currentMonthStart->addMonth();
        $previousMonthStart = $currentMonthStart->subMonth();
        $lastSixMonthStart = $currentMonthStart->subMonths(5);

        $apartmentStats = $this->apartmentStats();
        $totalCustomers = Customer::query()->count();

        $totalRevenue = $this->salesRevenueSum();
        $currentMonthRevenue = $this->salesRevenueSum($currentMonthStart, $nextMonthStart);
        $previousMonthRevenue = $this->salesRevenueSum($previousMonthStart, $currentMonthStart);

        [$overdueInstallments, $overdueAmount] = $this->overdueInstallmentSummary($today);
        [$municipalityPending, $municipalityPendingCount] = $this->municipalityPendingSummary();
        [$activeRentals, $rentalsDueSoon, $rentalStatusCounts] = $this->rentalSummary($today, $weekAhead);

        $latestNotifications = $user->notifications()->latest()->limit(5)->get();
        $unreadNotifications = $user->unreadNotifications()->count();
        $totalNotifications = $user->notifications()->count();

        $recentSales = $this->recentSales();
        [$pendingApprovalCount, $approvalSales, $approvalNotificationMap] = $this->pendingApprovals($user);

        $activities = $this->activities(
            $latestNotifications,
            $recentSales,
            $overdueInstallments,
            $rentalsDueSoon
        );

        return [
            'generated_at' => $now->toISOString(),
            'summary' => [
                'totalApartments' => $apartmentStats['total'],
                'availableApartments' => $apartmentStats['available'],
                'soldApartments' => $apartmentStats['sold'],
                'totalCustomers' => $totalCustomers,
                'totalRevenue' => $totalRevenue,
                'currentMonthRevenue' => $currentMonthRevenue,
                'previousMonthRevenue' => $previousMonthRevenue,
                'pendingApprovals' => $pendingApprovalCount,
                'overdueInstallments' => $overdueInstallments,
                'overdueAmount' => $overdueAmount,
                'municipalityPending' => $municipalityPending,
                'municipalityPendingCount' => $municipalityPendingCount,
                'activeRentals' => $activeRentals,
                'rentalsDueSoon' => $rentalsDueSoon,
            ],
            'salesChartData' => $this->salesChartData($lastSixMonthStart),
            'apartmentStatusData' => $this->apartmentStatusData($apartmentStats),
            'recentSales' => $recentSales,
            'approvals' => $this->approvalRows($approvalSales, $approvalNotificationMap),
            'progressItems' => $this->progressItems($rentalStatusCounts),
            'activities' => $activities,
            'metrics' => $this->metrics(
                $apartmentStats,
                $overdueInstallments,
                $unreadNotifications,
                $totalNotifications
            ),
        ];
    }

    private function apartmentStats(): array
    {
        $row = Apartment::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('sold', 'handed_over') THEN 1 ELSE 0 END) as sold")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'rented' THEN 1 ELSE 0 END) as rented")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'reserved' THEN 1 ELSE 0 END) as reserved")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'company_use' THEN 1 ELSE 0 END) as company_use")
            ->first();

        $total = (int) ($row?->total ?? 0);
        $sold = (int) ($row?->sold ?? 0);
        $rented = (int) ($row?->rented ?? 0);
        $reserved = (int) ($row?->reserved ?? 0);
        $companyUse = (int) ($row?->company_use ?? 0);
        $available = max(0, $total - $sold - $rented - $reserved - $companyUse);

        return [
            'total' => $total,
            'available' => $available,
            'sold' => $sold,
            'rented' => $rented,
            'reserved' => $reserved,
            'companyUse' => $companyUse,
        ];
    }

    private function salesRevenueSum(
        ?CarbonImmutable $start = null,
        ?CarbonImmutable $endExclusive = null
    ): float {
        $query = ApartmentSale::query();

        if ($start) {
            $query->whereDate('sale_date', '>=', $start->toDateString());
        }
        if ($endExclusive) {
            $query->whereDate('sale_date', '<', $endExclusive->toDateString());
        }

        return round((float) $query->sum(DB::raw($this->revenueExpression())), 2);
    }

    private function overdueInstallmentSummary(CarbonImmutable $today): array
    {
        $query = Installment::query()->where(function (Builder $builder) use ($today): void {
            $builder
                ->whereRaw("LOWER(COALESCE(status, '')) = 'overdue'")
                ->orWhere(function (Builder $nested) use ($today): void {
                    $nested
                        ->whereDate('due_date', '<', $today->toDateString())
                        ->whereRaw('COALESCE(paid_amount, 0) < COALESCE(amount, 0)');
                });
        });

        $count = (clone $query)->count();
        $amount = round((float) (clone $query)->sum(DB::raw(
            'GREATEST(COALESCE(amount, 0) - COALESCE(paid_amount, 0), 0)'
        )), 2);

        return [$count, $amount];
    }

    private function municipalityPendingSummary(): array
    {
        $total = round((float) ApartmentSaleFinancial::query()->sum('remaining_municipality'), 2);
        $count = ApartmentSaleFinancial::query()
            ->where('remaining_municipality', '>', 0)
            ->count();

        return [$total, $count];
    }

    private function rentalSummary(CarbonImmutable $today, CarbonImmutable $weekAhead): array
    {
        $closedStatuses = ['completed', 'terminated', 'defaulted', 'cancelled'];
        $row = ApartmentRental::query()
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('active', 'advance_pending') THEN 1 ELSE 0 END) as active_total")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'active' THEN 1 ELSE 0 END) as active_only")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'advance_pending' THEN 1 ELSE 0 END) as advance_pending")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'completed' THEN 1 ELSE 0 END) as completed")
            ->selectRaw('COUNT(*) as total')
            ->first();

        $rentalsDueSoon = ApartmentRental::query()
            ->whereNotIn(DB::raw("LOWER(COALESCE(status, ''))"), $closedStatuses)
            ->whereDate('next_due_date', '>=', $today->toDateString())
            ->whereDate('next_due_date', '<=', $weekAhead->toDateString())
            ->count();

        return [
            (int) ($row?->active_total ?? 0),
            $rentalsDueSoon,
            [
                'total' => (int) ($row?->total ?? 0),
                'active' => (int) ($row?->active_only ?? 0),
                'advancePending' => (int) ($row?->advance_pending ?? 0),
                'completed' => (int) ($row?->completed ?? 0),
            ],
        ];
    }

    private function recentSales(): array
    {
        return ApartmentSale::query()
            ->with([
                'customer:id,name',
                'apartment:id,apartment_code',
            ])
            ->orderByDesc('sale_date')
            ->limit(5)
            ->get([
                'id',
                'uuid',
                'sale_id',
                'sale_date',
                'total_price',
                'discount',
                'net_price',
                'actual_net_revenue',
                'customer_id',
                'apartment_id',
                'status',
            ])
            ->map(function (ApartmentSale $sale): array {
                $status = strtolower(trim((string) ($sale->status ?? '')));

                return [
                    'id' => (string) $sale->uuid,
                    'customer' => trim((string) ($sale->customer?->name ?? 'Customer')) ?: 'Customer',
                    'apartment' => trim((string) ($sale->apartment?->apartment_code ?? 'Apartment')) ?: 'Apartment',
                    'amount' => $this->formatCurrencyFull($this->saleRevenue($sale)),
                    'date' => $sale->sale_date?->toDateString() ?? '-',
                    'status' => $status !== '' ? ucfirst($status) : 'Active',
                    'href' => $sale->uuid ? "/apartment-sales/{$sale->uuid}/financial" : '/apartment-sales',
                ];
            })
            ->values()
            ->all();
    }

    private function pendingApprovals(Authenticatable $user): array
    {
        $base = $this->pendingApprovalQuery();
        $count = (clone $base)->count('apartment_sales.id');

        $sales = (clone $base)
            ->with([
                'customer:id,name',
                'apartment:id,apartment_code',
            ])
            ->select('apartment_sales.*')
            ->orderByDesc('apartment_sales.updated_at')
            ->limit(20)
            ->get();

        $saleUuids = $sales
            ->pluck('uuid')
            ->filter(fn ($uuid): bool => is_string($uuid) && $uuid !== '')
            ->values()
            ->all();

        $notificationMap = $this->latestDeedNotificationBySaleUuid($user, $saleUuids);

        $sortedSales = $sales
            ->sortByDesc(function (ApartmentSale $sale) use ($notificationMap): int {
                $notification = $notificationMap->get((string) $sale->uuid);
                if ($notification instanceof DatabaseNotification && $notification->created_at) {
                    return $notification->created_at->getTimestamp();
                }
                if ($sale->updated_at) {
                    return $sale->updated_at->getTimestamp();
                }
                return $sale->sale_date?->getTimestamp() ?? 0;
            })
            ->values()
            ->take(6)
            ->values();

        return [$count, $sortedSales, $notificationMap];
    }

    private function pendingApprovalQuery(): Builder
    {
        return ApartmentSale::query()
            ->join(
                'apartment_sale_financials as financials',
                'financials.apartment_sale_id',
                '=',
                'apartment_sales.id'
            )
            ->whereRaw("LOWER(COALESCE(apartment_sales.status, '')) = 'completed'")
            ->where(function (Builder $builder): void {
                $builder
                    ->whereNull('apartment_sales.deed_status')
                    ->orWhereRaw("LOWER(COALESCE(apartment_sales.deed_status, '')) <> 'issued'");
            })
            ->where('financials.customer_debt', '<=', 0)
            ->where('financials.remaining_municipality', '<=', 0);
    }

    private function latestDeedNotificationBySaleUuid(
        Authenticatable $user,
        array $saleUuids
    ): Collection {
        if ($saleUuids === []) {
            return collect();
        }

        return $user->notifications()
            ->latest()
            ->limit(100)
            ->get()
            ->filter(function (DatabaseNotification $notification) use ($saleUuids): bool {
                $data = is_array($notification->data) ? $notification->data : [];
                $category = strtolower(trim((string) ($data['category'] ?? '')));
                $saleUuid = trim((string) ($data['sale_uuid'] ?? ''));

                return $category === 'sale_deed_eligible' && in_array($saleUuid, $saleUuids, true);
            })
            ->groupBy(function (DatabaseNotification $notification): string {
                $data = is_array($notification->data) ? $notification->data : [];
                return trim((string) ($data['sale_uuid'] ?? ''));
            })
            ->map(fn (Collection $group) => $group->sortByDesc('created_at')->first());
    }

    private function approvalRows(Collection $sales, Collection $notificationMap): array
    {
        return $sales
            ->map(function (ApartmentSale $sale) use ($notificationMap): array {
                /** @var DatabaseNotification|null $notification */
                $notification = $notificationMap->get((string) $sale->uuid);
                $data = is_array($notification?->data) ? $notification->data : [];
                $saleId = trim((string) ($sale->sale_id ?? '')) ?: strtoupper(substr((string) $sale->uuid, 0, 8));
                $customerName = trim((string) ($sale->customer?->name ?? 'Customer')) ?: 'Customer';
                $apartmentName = trim((string) ($sale->apartment?->apartment_code ?? 'Apartment')) ?: 'Apartment';

                return [
                    'id' => (string) $sale->uuid,
                    'desc' => trim((string) ($data['title'] ?? '')) ?: "Deed approval required for {$apartmentName}",
                    'requester' => "{$customerName} - Sale {$saleId}",
                    'time' => $this->relativeTime(
                        $notification?->created_at?->toISOString()
                            ?? $sale->updated_at?->toISOString()
                            ?? $sale->sale_date?->toISOString()
                    ),
                    'href' => "/apartment-sales/{$sale->uuid}/financial",
                ];
            })
            ->values()
            ->all();
    }

    private function salesChartData(CarbonImmutable $startMonth): array
    {
        $rows = ApartmentSale::query()
            ->selectRaw("DATE_FORMAT(sale_date, '%Y-%m') as month_key")
            ->selectRaw("SUM({$this->revenueExpression()}) as revenue")
            ->whereDate('sale_date', '>=', $startMonth->toDateString())
            ->groupBy(DB::raw("DATE_FORMAT(sale_date, '%Y-%m')"))
            ->pluck('revenue', 'month_key');

        $points = [];
        for ($offset = 0; $offset < 6; $offset += 1) {
            $point = $startMonth->addMonths($offset);
            $key = $point->format('Y-m');
            $points[] = [
                'name' => $point->format('M'),
                'sales' => round((float) ($rows[$key] ?? 0), 2),
            ];
        }

        return $points;
    }

    private function apartmentStatusData(array $stats): array
    {
        return collect([
            ['name' => 'Available', 'value' => $stats['available'], 'color' => '#3b82f6'],
            ['name' => 'Sold', 'value' => $stats['sold'], 'color' => '#10b981'],
            ['name' => 'Rented', 'value' => $stats['rented'], 'color' => '#f59e0b'],
            ['name' => 'Reserved', 'value' => $stats['reserved'], 'color' => '#a855f7'],
            ['name' => 'Company Use', 'value' => $stats['companyUse'], 'color' => '#64748b'],
        ])
            ->filter(fn (array $item): bool => (int) $item['value'] > 0)
            ->values()
            ->all();
    }

    private function progressItems(array $rentalStatusCounts): array
    {
        $total = (int) ($rentalStatusCounts['total'] ?? 0);
        if ($total <= 0) {
            return [];
        }

        return [
            [
                'id' => 'active-rentals',
                'name' => 'Active Rentals',
                'location' => ($rentalStatusCounts['active'] ?? 0) . ' active contracts',
                'progress' => $this->percentage((int) ($rentalStatusCounts['active'] ?? 0), $total),
                'status' => 'Tracking occupied units',
                'href' => '/rentals',
            ],
            [
                'id' => 'advance-pending',
                'name' => 'Advance Pending',
                'location' => ($rentalStatusCounts['advancePending'] ?? 0) . ' contracts waiting for full advance',
                'progress' => $this->percentage((int) ($rentalStatusCounts['advancePending'] ?? 0), $total),
                'status' => 'Needs collection follow-up',
                'href' => '/rentals',
            ],
            [
                'id' => 'completed-rentals',
                'name' => 'Completed Rentals',
                'location' => ($rentalStatusCounts['completed'] ?? 0) . ' closed successfully',
                'progress' => $this->percentage((int) ($rentalStatusCounts['completed'] ?? 0), $total),
                'status' => 'Closed rental agreements',
                'href' => '/rentals',
            ],
        ];
    }

    private function activities(
        Collection $notifications,
        array $recentSales,
        int $overdueInstallments,
        int $rentalsDueSoon
    ): array {
        $notificationActivities = $notifications
            ->map(function (DatabaseNotification $notification): array {
                $data = is_array($notification->data) ? $notification->data : [];
                $type = trim((string) $notification->type);
                $typeParts = $type === '' ? [] : explode('\\', $type);

                return [
                    'id' => (string) $notification->id,
                    'text' => trim((string) ($data['title'] ?? $data['message'] ?? 'Notification update')) ?: 'Notification update',
                    'time' => $this->relativeTime($notification->created_at?->toISOString()),
                    'user' => trim((string) ($data['sale_id'] ?? '')) ?: (end($typeParts) ?: 'System'),
                    'type' => $this->activityTypeFromNotification(trim((string) ($data['category'] ?? ''))),
                ];
            })
            ->values()
            ->all();

        if ($notificationActivities !== []) {
            return $notificationActivities;
        }

        $fallback = [];
        foreach (array_slice($recentSales, 0, 3) as $sale) {
            $fallback[] = [
                'id' => 'sale-' . ($sale['id'] ?? uniqid('', true)),
                'text' => 'Sale recorded for ' . ($sale['apartment'] ?? 'Apartment'),
                'time' => $sale['date'] ?? '-',
                'user' => $sale['customer'] ?? 'Customer',
                'type' => 'sale',
            ];
        }

        if ($overdueInstallments > 0) {
            $fallback[] = [
                'id' => 'overdue-installments',
                'text' => "{$overdueInstallments} installments are currently overdue",
                'time' => 'live',
                'user' => 'Collections',
                'type' => 'alert',
            ];
        }

        if ($rentalsDueSoon > 0) {
            $fallback[] = [
                'id' => 'rentals-due-soon',
                'text' => "{$rentalsDueSoon} rentals have payments due within 7 days",
                'time' => 'live',
                'user' => 'Rentals',
                'type' => 'payment',
            ];
        }

        return array_slice($fallback, 0, 5);
    }

    private function metrics(
        array $apartmentStats,
        int $overdueInstallments,
        int $unreadNotifications,
        int $totalNotifications
    ): array {
        $totalApartments = max(0, (int) ($apartmentStats['total'] ?? 0));
        $installmentCount = Installment::query()->count();

        return [
            [
                'label' => 'Available Units',
                'value' => (string) ($apartmentStats['available'] ?? 0),
                'color' => 'text-blue-600 dark:text-blue-400',
                'bar' => 'bg-blue-500',
                'width' => $this->percentWidth((int) ($apartmentStats['available'] ?? 0), $totalApartments),
            ],
            [
                'label' => 'Sold Units',
                'value' => (string) ($apartmentStats['sold'] ?? 0),
                'color' => 'text-emerald-600 dark:text-emerald-400',
                'bar' => 'bg-emerald-500',
                'width' => $this->percentWidth((int) ($apartmentStats['sold'] ?? 0), $totalApartments),
            ],
            [
                'label' => 'Overdue Rate',
                'value' => $this->percentage($overdueInstallments, $installmentCount) . '%',
                'color' => 'text-amber-600 dark:text-amber-400',
                'bar' => 'bg-amber-500',
                'width' => $this->percentWidth($overdueInstallments, $installmentCount),
            ],
            [
                'label' => 'Unread Alerts',
                'value' => (string) $unreadNotifications,
                'color' => 'text-slate-600 dark:text-slate-400',
                'bar' => 'bg-slate-500',
                'width' => $this->percentWidth($unreadNotifications, $totalNotifications),
            ],
        ];
    }

    private function revenueExpression(): string
    {
        return "CASE
            WHEN COALESCE(actual_net_revenue, 0) > 0 THEN COALESCE(actual_net_revenue, 0)
            WHEN COALESCE(net_price, 0) > 0 THEN COALESCE(net_price, 0)
            ELSE GREATEST(COALESCE(total_price, 0) - COALESCE(discount, 0), 0)
        END";
    }

    private function saleRevenue(ApartmentSale $sale): float
    {
        $actual = (float) ($sale->actual_net_revenue ?? 0);
        if ($actual > 0) {
            return round($actual, 2);
        }

        $net = (float) ($sale->net_price ?? 0);
        if ($net > 0) {
            return round($net, 2);
        }

        return round(max(0, (float) ($sale->total_price ?? 0) - (float) ($sale->discount ?? 0)), 2);
    }

    private function formatCurrencyFull(float $amount): string
    {
        return '$' . number_format($amount, 2);
    }

    private function relativeTime(?string $value): string
    {
        if (!$value) {
            return '-';
        }

        try {
            $timestamp = CarbonImmutable::parse($value);
        } catch (\Throwable) {
            return '-';
        }

        $diffSeconds = max(0, CarbonImmutable::now()->diffInSeconds($timestamp));
        if ($diffSeconds < 60) {
            return 'just now';
        }
        if ($diffSeconds < 3600) {
            return floor($diffSeconds / 60) . ' min ago';
        }
        if ($diffSeconds < 86400) {
            return floor($diffSeconds / 3600) . ' hr ago';
        }

        return floor($diffSeconds / 86400) . ' day ago';
    }

    private function activityTypeFromNotification(string $category): string
    {
        $normalized = strtolower(trim($category));
        if (str_contains($normalized, 'sale')) {
            return 'sale';
        }
        if (str_contains($normalized, 'payment') || str_contains($normalized, 'bill')) {
            return 'payment';
        }
        if (str_contains($normalized, 'document')) {
            return 'document';
        }
        if (str_contains($normalized, 'eligible') || str_contains($normalized, 'alert')) {
            return 'alert';
        }

        return 'milestone';
    }

    private function percentage(int $part, int $total): int
    {
        if ($total <= 0) {
            return 0;
        }

        return max(0, min(100, (int) round(($part / $total) * 100)));
    }

    private function percentWidth(int $part, int $total): string
    {
        return $this->percentage($part, $total) . '%';
    }
}
