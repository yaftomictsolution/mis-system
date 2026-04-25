<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OfflinePolicyController extends Controller
{
    private const SETTING_KEY = 'offline_policy';

    private const DEFAULT_POLICY = [
        'system_offline_until' => null,
        'unsynced_delete_at' => null,
        'unsynced_retention_days' => 365,
        'module_retention_days' => [
            'customers' => 365,
            'apartments' => 365,
            'employees' => 365,
            'apartment_sales' => 365,
            'apartment_sale_financials' => 365,
            'installments' => 365,
            'vendors' => 365,
            'warehouses' => 365,
            'materials' => 365,
            'company_assets' => 365,
            'material_requests' => 365,
            'purchase_requests' => 365,
            'asset_requests' => 365,
            'projects' => 365,
            'stock_movements' => 365,
            'warehouse_material_stocks' => 365,
            'project_material_stocks' => 365,
            'roles' => 365,
            'users' => 365,
            'rentals' => 365,
            'rental_payments' => 365,
            'salary_advances' => 365,
            'salary_payments' => 365,
            'accounts' => 365,
            'account_transactions' => 365,
            'exchange_rates' => 365,
            'employee_salary_histories' => 365,
        ],
    ];

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->currentPolicy($request),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'system_offline_until' => ['nullable', 'date'],
            'unsynced_delete_at' => ['nullable', 'date'],
            'unsynced_retention_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days' => ['required', 'array'],
            'module_retention_days.customers' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.apartments' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.employees' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.apartment_sales' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.apartment_sale_financials' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.installments' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.vendors' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.warehouses' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.materials' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.company_assets' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.material_requests' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.purchase_requests' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.asset_requests' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.projects' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.stock_movements' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.warehouse_material_stocks' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.project_material_stocks' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.roles' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.users' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.rentals' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.rental_payments' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.salary_advances' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.salary_payments' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.accounts' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.account_transactions' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.exchange_rates' => ['required', 'integer', 'min:0', 'max:3650'],
            'module_retention_days.employee_salary_histories' => ['required', 'integer', 'min:0', 'max:3650'],
        ]);

        $policy = $this->normalizePolicy($validated);

        SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTING_KEY],
            ['value' => $policy, 'updated_by' => $request->user()?->id]
        );

        return response()->json([
            'message' => 'Offline policy updated successfully.',
            'data' => $policy,
        ]);
    }

    private function currentPolicy(?Request $request = null): array
    {
        $stored = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        $policy = $this->normalizePolicy(is_array($stored) ? $stored : []);
        $changed = false;

        if ($this->isExpired($policy['system_offline_until'])) {
            $policy['system_offline_until'] = null;
            $changed = true;
        }

        if ($this->isExpired($policy['unsynced_delete_at'])) {
            $policy['unsynced_delete_at'] = null;
            $changed = true;
        }

        if ($changed) {
            SystemSetting::query()->updateOrCreate(
                ['key' => self::SETTING_KEY],
                ['value' => $policy, 'updated_by' => $request?->user()?->id]
            );
        }

        return $policy;
    }

    private function normalizePolicy(array $input): array
    {
        $moduleRetention = array_merge(
            self::DEFAULT_POLICY['module_retention_days'],
            is_array($input['module_retention_days'] ?? null) ? $input['module_retention_days'] : []
        );

        return [
            'system_offline_until' => $this->normalizeDate($input['system_offline_until'] ?? null),
            'unsynced_delete_at' => $this->normalizeDate($input['unsynced_delete_at'] ?? null),
            'unsynced_retention_days' => $this->normalizeDays($input['unsynced_retention_days'] ?? self::DEFAULT_POLICY['unsynced_retention_days']),
            'module_retention_days' => [
                'customers' => $this->normalizeDays($moduleRetention['customers'] ?? 365),
                'apartments' => $this->normalizeDays($moduleRetention['apartments'] ?? 365),
                'employees' => $this->normalizeDays($moduleRetention['employees'] ?? 365),
                'apartment_sales' => $this->normalizeDays($moduleRetention['apartment_sales'] ?? 365),
                'apartment_sale_financials' => $this->normalizeDays($moduleRetention['apartment_sale_financials'] ?? 365),
                'installments' => $this->normalizeDays($moduleRetention['installments'] ?? 365),
                'vendors' => $this->normalizeDays($moduleRetention['vendors'] ?? 365),
                'warehouses' => $this->normalizeDays($moduleRetention['warehouses'] ?? 365),
                'materials' => $this->normalizeDays($moduleRetention['materials'] ?? 365),
                'company_assets' => $this->normalizeDays($moduleRetention['company_assets'] ?? 365),
                'material_requests' => $this->normalizeDays($moduleRetention['material_requests'] ?? 365),
                'purchase_requests' => $this->normalizeDays($moduleRetention['purchase_requests'] ?? 365),
                'asset_requests' => $this->normalizeDays($moduleRetention['asset_requests'] ?? 365),
                'projects' => $this->normalizeDays($moduleRetention['projects'] ?? 365),
                'stock_movements' => $this->normalizeDays($moduleRetention['stock_movements'] ?? 365),
                'warehouse_material_stocks' => $this->normalizeDays($moduleRetention['warehouse_material_stocks'] ?? 365),
                'project_material_stocks' => $this->normalizeDays($moduleRetention['project_material_stocks'] ?? 365),
                'roles' => $this->normalizeDays($moduleRetention['roles'] ?? 365),
                'users' => $this->normalizeDays($moduleRetention['users'] ?? 365),
                'rentals' => $this->normalizeDays($moduleRetention['rentals'] ?? 365),
                'rental_payments' => $this->normalizeDays($moduleRetention['rental_payments'] ?? 365),
                'salary_advances' => $this->normalizeDays($moduleRetention['salary_advances'] ?? 365),
                'salary_payments' => $this->normalizeDays($moduleRetention['salary_payments'] ?? 365),
                'accounts' => $this->normalizeDays($moduleRetention['accounts'] ?? 365),
                'account_transactions' => $this->normalizeDays($moduleRetention['account_transactions'] ?? 365),
                'exchange_rates' => $this->normalizeDays($moduleRetention['exchange_rates'] ?? 365),
                'employee_salary_histories' => $this->normalizeDays($moduleRetention['employee_salary_histories'] ?? 365),
            ],
        ];
    }

    private function normalizeDate(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return null;
        }

        $timestamp = strtotime($trimmed);
        return $timestamp === false ? null : gmdate('c', $timestamp);
    }

    private function normalizeDays(mixed $value): int
    {
        $days = (int) $value;
        return max(0, min(3650, $days));
    }

    private function isExpired(?string $value): bool
    {
        if ($value === null || trim($value) === '') {
            return false;
        }

        $timestamp = strtotime($value);
        return $timestamp !== false && $timestamp <= time();
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if (! $user || ! $user->hasRole('Admin')) {
            throw ValidationException::withMessages([
                'permission' => ['Only admin can manage offline policy.'],
            ]);
        }
    }
}
