<?php

namespace App\Services;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\SystemSetting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BiometricAttendanceService
{
    public const SETTING_KEY = 'biometric_attendance_config';

    private const DEFAULT_CONFIG = [
        'provider' => 'not-configured',
        'device_label' => '',
        'ip_address' => null,
        'port' => 4370,
        'api_base_url' => null,
        'device_key' => null,
        'serial_number' => null,
        'timezone' => 'Asia/Kabul',
        'sync_interval_minutes' => 15,
        'employee_match_field' => 'employee_uuid',
        'auto_sync_enabled' => false,
        'is_active' => false,
        'notes' => null,
        'last_validated_at' => null,
        'last_sync_at' => null,
    ];

    public function config(): array
    {
        $stored = SystemSetting::query()->where('key', self::SETTING_KEY)->value('value');
        return $this->sanitizeConfig(is_array($stored) ? $stored : []);
    }

    public function adminConfig(): array
    {
        return $this->config();
    }

    public function dashboardConfig(): array
    {
        $config = $this->config();

        return [
            'provider' => $config['provider'],
            'device_label' => $config['device_label'],
            'timezone' => $config['timezone'],
            'employee_match_field' => $config['employee_match_field'],
            'auto_sync_enabled' => $config['auto_sync_enabled'],
            'is_active' => $config['is_active'],
            'last_validated_at' => $config['last_validated_at'],
            'last_sync_at' => $config['last_sync_at'],
        ];
    }

    public function updateConfig(array $input, ?int $updatedBy = null): array
    {
        $current = $this->config();
        $next = $this->sanitizeConfig(array_merge($current, $input));

        SystemSetting::query()->updateOrCreate(
            ['key' => self::SETTING_KEY],
            ['value' => $next, 'updated_by' => $updatedBy]
        );

        return $next;
    }

    public function validateConfig(array $override = []): array
    {
        $config = $this->sanitizeConfig(array_merge($this->config(), $override));
        $issues = $this->configIssues($config);

        if (!empty($issues)) {
            throw ValidationException::withMessages([
                'config' => $issues,
            ]);
        }

        $message = 'Biometric configuration looks valid.';
        $details = [
            'provider' => $config['provider'],
        ];

        if ($config['provider'] === 'bridge-api') {
            $baseUrl = rtrim((string) ($config['api_base_url'] ?? ''), '/');
            $healthUrl = $baseUrl . '/health';

            try {
                $response = Http::timeout(5)
                    ->acceptJson()
                    ->withHeaders($this->bridgeHeaders($config))
                    ->get($healthUrl);
            } catch (\Throwable $exception) {
                throw ValidationException::withMessages([
                    'api_base_url' => ['Bridge API health check failed: ' . $exception->getMessage()],
                ]);
            }

            if (! $response->successful()) {
                throw ValidationException::withMessages([
                    'api_base_url' => ['Bridge API health check failed with status ' . $response->status() . '.'],
                ]);
            }

            $details['bridge_health'] = $response->json();
            $message = 'Bridge API is reachable.';
        } elseif ($config['provider'] === 'zkteco-pull') {
            $message = 'Configuration is complete. Direct device pull still needs a server-side bridge or SDK worker.';
        } elseif ($config['provider'] === 'csv-import') {
            $message = 'CSV import mode is configured. A bridge or import worker can now post normalized punches.';
        } elseif ($config['provider'] === 'demo') {
            $message = 'Demo mode is ready.';
        }

        $config['last_validated_at'] = now()->toISOString();

        return [
            'message' => $message,
            'data' => $config,
            'details' => $details,
        ];
    }

    public function syncNow(array $override = [], ?int $updatedBy = null): array
    {
        $config = $this->sanitizeConfig(array_merge($this->config(), $override));
        $issues = $this->configIssues($config);

        if (!empty($issues)) {
            throw ValidationException::withMessages([
                'config' => $issues,
            ]);
        }

        $date = $this->normalizeDateString($override['date'] ?? null, (string) $config['timezone']);

        if ($config['provider'] === 'demo') {
            return $this->seedDemoPunches($date, $config, $updatedBy);
        }

        if ($config['provider'] !== 'bridge-api') {
            throw ValidationException::withMessages([
                'provider' => ['Sync Now is currently supported for Demo Mode and Bridge API providers.'],
            ]);
        }

        $baseUrl = rtrim((string) ($config['api_base_url'] ?? ''), '/');
        $syncUrl = $baseUrl . '/sync';

        try {
            $response = Http::timeout(15)
                ->acceptJson()
                ->withHeaders($this->bridgeHeaders($config))
                ->post($syncUrl, [
                    'date' => $date,
                    'callback_url' => rtrim((string) config('app.url'), '/') . '/api/attendance/bridge/punches',
                ]);
        } catch (\Throwable $exception) {
            throw ValidationException::withMessages([
                'api_base_url' => ['Bridge sync request failed: ' . $exception->getMessage()],
            ]);
        }

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'api_base_url' => ['Bridge sync request failed with status ' . $response->status() . '.'],
            ]);
        }

        $config['last_sync_at'] = now()->toISOString();
        $saved = $this->updateConfig($config, $updatedBy);

        return [
            'message' => 'Bridge sync requested successfully.',
            'data' => $saved,
            'bridge_response' => $response->json(),
        ];
    }

    public function clearDemoPunches(?string $date = null): array
    {
        $config = $this->config();
        [$startUtc, $endUtc] = $this->dayBounds($date, (string) $config['timezone']);

        $removed = AttendanceLog::query()
            ->where('source', 'demo')
            ->whereBetween('event_time', [$startUtc, $endUtc])
            ->delete();

        return [
            'message' => $removed > 0 ? 'Demo punches cleared.' : 'There were no demo punches to clear.',
            'removed' => $removed,
        ];
    }

    public function ingestPunchBatch(array $payload): array
    {
        $config = $this->config();
        $matchField = (string) $config['employee_match_field'];
        $employees = $this->employeeLookupIndex($matchField);
        $syncBatchUuid = $this->normalizeSyncBatchUuid($payload['sync_batch_uuid'] ?? null);
        $deviceLabel = $this->trimText($payload['device_label'] ?? $config['device_label'] ?? '', 120);
        $now = now();

        $matched = 0;
        $unmatched = 0;

        foreach ((array) ($payload['punches'] ?? []) as $row) {
            $item = is_array($row) ? $row : [];
            $biometricUserId = $this->trimText($item['biometric_user_id'] ?? '', 255);
            $lookupValue = $this->normalizeLookupValue(
                $matchField,
                $item['employee_lookup_value'] ?? $biometricUserId
            );

            $employee = $lookupValue !== '' ? $employees->get($lookupValue) : null;
            $logUuid = $this->resolveLogUuid(
                isset($item['uuid']) ? (string) $item['uuid'] : '',
                $syncBatchUuid,
                $biometricUserId,
                (string) ($item['event_time'] ?? ''),
                (string) ($item['event_type'] ?? ''),
                $deviceLabel
            );

            $eventTime = CarbonImmutable::parse((string) ($item['event_time'] ?? 'now'), (string) $config['timezone'])->utc();
            $status = $employee ? 'matched' : 'unmatched';

            if ($employee) {
                $matched += 1;
            } else {
                $unmatched += 1;
            }

            AttendanceLog::query()->updateOrCreate(
                ['uuid' => $logUuid],
                [
                    'employee_id' => $employee?->id,
                    'employee_uuid' => $employee?->uuid,
                    'employee_name' => $employee ? $this->employeeName($employee) : 'Unmatched employee',
                    'employee_job_title' => $employee?->job_title,
                    'biometric_user_id' => $biometricUserId,
                    'event_time' => $eventTime,
                    'event_type' => $this->normalizeEventType((string) ($item['event_type'] ?? 'check_in')),
                    'source' => $this->normalizeSource((string) ($item['source'] ?? 'biometric')),
                    'device_label' => $deviceLabel !== '' ? $deviceLabel : null,
                    'sync_batch_uuid' => $syncBatchUuid,
                    'status' => $status,
                    'raw_payload' => is_array($item['raw_payload'] ?? null) ? $item['raw_payload'] : $item,
                    'updated_at' => $now,
                ]
            );
        }

        $saved = $this->updateConfig([
            ...$config,
            'last_sync_at' => now()->toISOString(),
        ]);

        return [
            'message' => 'Attendance punches ingested successfully.',
            'data' => [
                'sync_batch_uuid' => $syncBatchUuid,
                'ingested_count' => count((array) ($payload['punches'] ?? [])),
                'matched_count' => $matched,
                'unmatched_count' => $unmatched,
                'config' => $saved,
            ],
        ];
    }

    public function dailyDashboard(?string $date = null): array
    {
        $config = $this->config();
        $timezone = (string) $config['timezone'];
        $dashboardDate = $this->normalizeDateString($date, $timezone);
        [$startUtc, $endUtc] = $this->dayBounds($dashboardDate, $timezone);

        $employees = Employee::query()
            ->select(['id', 'uuid', 'first_name', 'last_name', 'job_title', 'email', 'phone', 'status'])
            ->where(function ($builder) {
                $builder
                    ->whereNull('status')
                    ->orWhere('status', '!=', 'resign');
            })
            ->orderBy('first_name')
            ->get();

        $logs = AttendanceLog::query()
            ->whereBetween('event_time', [$startUtc, $endUtc])
            ->orderBy('event_time')
            ->get();

        $logsByEmployeeUuid = $logs
            ->filter(fn (AttendanceLog $log) => ! empty($log->employee_uuid))
            ->groupBy('employee_uuid');

        $rows = $employees
            ->map(function (Employee $employee) use ($logsByEmployeeUuid, $config, $timezone): array {
                /** @var Collection<int, AttendanceLog> $employeeLogs */
                $employeeLogs = collect($logsByEmployeeUuid->get($employee->uuid, []))->sortBy('event_time')->values();
                $checkIns = $employeeLogs->where('event_type', 'check_in')->values();
                $checkOuts = $employeeLogs->where('event_type', 'check_out')->values();

                $firstCheckIn = $checkIns->first()?->event_time?->copy()?->timezone($timezone);
                $lastCheckOut = $checkOuts->last()?->event_time?->copy()?->timezone($timezone);
                $status = 'absent';

                if ($employeeLogs->count() > 0) {
                    $status = $firstCheckIn && $lastCheckOut ? 'present' : 'incomplete';
                }

                return [
                    'id' => $employee->uuid,
                    'employee_uuid' => $employee->uuid,
                    'employee_name' => $this->employeeName($employee),
                    'employee_job_title' => $employee->job_title,
                    'biometric_user_id' => $employeeLogs->first()?->biometric_user_id ?? $this->employeeMatchValue($employee, $config),
                    'first_check_in' => $firstCheckIn?->toIso8601String(),
                    'last_check_out' => $lastCheckOut?->toIso8601String(),
                    'total_events' => $employeeLogs->count(),
                    'status' => $status,
                    'source_label' => $this->sourceLabel($employeeLogs, $config),
                ];
            })
            ->sort(function (array $left, array $right): int {
                $rank = [
                    'incomplete' => 0,
                    'absent' => 1,
                    'present' => 2,
                ];

                $statusDiff = ($rank[$left['status']] ?? 99) <=> ($rank[$right['status']] ?? 99);
                if ($statusDiff !== 0) {
                    return $statusDiff;
                }

                return strcmp((string) $left['employee_name'], (string) $right['employee_name']);
            })
            ->values();

        return [
            'date' => $dashboardDate,
            'config' => $this->dashboardConfig(),
            'configured' => $config['is_active'] && $config['provider'] !== 'not-configured',
            'totalEmployees' => $rows->count(),
            'presentCount' => $rows->where('status', 'present')->count(),
            'absentCount' => $rows->where('status', 'absent')->count(),
            'incompleteCount' => $rows->where('status', 'incomplete')->count(),
            'unmatchedCount' => $logs->where('status', 'unmatched')->count(),
            'rows' => $rows->all(),
        ];
    }

    public function configuredBridgeKey(): ?string
    {
        $config = $this->config();
        $key = trim((string) ($config['device_key'] ?? ''));
        return $key !== '' ? $key : null;
    }

    public function configIssues(array $config): array
    {
        $issues = [];
        $provider = (string) ($config['provider'] ?? 'not-configured');

        if ($provider === 'not-configured') {
            $issues[] = 'Select an integration mode before enabling biometric attendance.';
        }

        if ($provider === 'zkteco-pull') {
            if ($this->trimText($config['ip_address'] ?? '', 120) === '') {
                $issues[] = 'IP address is required for direct device pull.';
            }
            if ((int) ($config['port'] ?? 0) <= 0) {
                $issues[] = 'Port is required for direct device pull.';
            }
        }

        if ($provider === 'bridge-api' && $this->trimText($config['api_base_url'] ?? '', 255) === '') {
            $issues[] = 'Bridge API base URL is required.';
        }

        if ($provider === 'csv-import' && $this->trimText($config['device_label'] ?? '', 120) === '') {
            $issues[] = 'Give the import source a label so users know where punches come from.';
        }

        return $issues;
    }

    private function seedDemoPunches(string $date, array $config, ?int $updatedBy = null): array
    {
        [$startUtc, $endUtc] = $this->dayBounds($date, (string) $config['timezone']);

        AttendanceLog::query()
            ->where('source', 'demo')
            ->whereBetween('event_time', [$startUtc, $endUtc])
            ->delete();

        $employees = Employee::query()
            ->select(['id', 'uuid', 'first_name', 'last_name', 'job_title', 'email', 'phone', 'status'])
            ->where(function ($builder) {
                $builder
                    ->whereNull('status')
                    ->orWhere('status', '!=', 'resign');
            })
            ->orderBy('first_name')
            ->get();

        $created = 0;
        $dateLocal = CarbonImmutable::parse($date, (string) $config['timezone'])->startOfDay();

        foreach ($employees as $employee) {
            $score = crc32($employee->uuid) % 100;
            if ($score > 89) {
                continue;
            }

            $checkInMinute = 8 * 60 + (crc32('in:' . $employee->uuid) % 75);
            $checkInTime = $dateLocal->addMinutes($checkInMinute)->utc();

            AttendanceLog::query()->updateOrCreate(
                ['uuid' => $this->resolveLogUuid('', $date, $employee->uuid, $checkInTime->toIso8601String(), 'check_in', (string) $config['device_label'])],
                [
                    'employee_id' => $employee->id,
                    'employee_uuid' => $employee->uuid,
                    'employee_name' => $this->employeeName($employee),
                    'employee_job_title' => $employee->job_title,
                    'biometric_user_id' => $this->employeeMatchValue($employee, $config),
                    'event_time' => $checkInTime,
                    'event_type' => 'check_in',
                    'source' => 'demo',
                    'device_label' => $config['device_label'] ?: 'Demo biometric source',
                    'sync_batch_uuid' => $this->normalizeSyncBatchUuid($date),
                    'status' => 'matched',
                    'raw_payload' => [
                        'generated' => true,
                        'date' => $date,
                    ],
                ]
            );
            $created += 1;

            if ($score <= 74) {
                $checkOutMinute = 16 * 60 + 30 + (crc32('out:' . $employee->uuid) % 90);
                $checkOutTime = $dateLocal->addMinutes($checkOutMinute)->utc();

                AttendanceLog::query()->updateOrCreate(
                    ['uuid' => $this->resolveLogUuid('', $date, $employee->uuid, $checkOutTime->toIso8601String(), 'check_out', (string) $config['device_label'])],
                    [
                        'employee_id' => $employee->id,
                        'employee_uuid' => $employee->uuid,
                        'employee_name' => $this->employeeName($employee),
                        'employee_job_title' => $employee->job_title,
                        'biometric_user_id' => $this->employeeMatchValue($employee, $config),
                        'event_time' => $checkOutTime,
                        'event_type' => 'check_out',
                        'source' => 'demo',
                        'device_label' => $config['device_label'] ?: 'Demo biometric source',
                        'sync_batch_uuid' => $this->normalizeSyncBatchUuid($date),
                        'status' => 'matched',
                        'raw_payload' => [
                            'generated' => true,
                            'date' => $date,
                        ],
                    ]
                );
                $created += 1;
            }
        }

        $saved = $this->updateConfig([
            ...$config,
            'provider' => $config['provider'] === 'not-configured' ? 'demo' : $config['provider'],
            'device_label' => $config['device_label'] ?: 'Demo biometric source',
            'is_active' => true,
            'last_validated_at' => now()->toISOString(),
            'last_sync_at' => now()->toISOString(),
        ], $updatedBy);

        return [
            'message' => 'Demo punches generated successfully.',
            'data' => [
                'created' => $created,
                'date' => $date,
                'config' => $saved,
            ],
        ];
    }

    private function sanitizeConfig(array $input): array
    {
        $provider = $this->normalizeProvider($input['provider'] ?? self::DEFAULT_CONFIG['provider']);

        return [
            'provider' => $provider,
            'device_label' => $this->trimText($input['device_label'] ?? self::DEFAULT_CONFIG['device_label'], 120),
            'ip_address' => $this->trimNullableText($input['ip_address'] ?? self::DEFAULT_CONFIG['ip_address'], 120),
            'port' => $this->normalizeInt($input['port'] ?? self::DEFAULT_CONFIG['port'], 1, 65535, 4370),
            'api_base_url' => $this->normalizeUrl($input['api_base_url'] ?? self::DEFAULT_CONFIG['api_base_url']),
            'device_key' => $this->trimNullableText($input['device_key'] ?? self::DEFAULT_CONFIG['device_key'], 255),
            'serial_number' => $this->trimNullableText($input['serial_number'] ?? self::DEFAULT_CONFIG['serial_number'], 120),
            'timezone' => $this->trimText($input['timezone'] ?? self::DEFAULT_CONFIG['timezone'], 120) ?: self::DEFAULT_CONFIG['timezone'],
            'sync_interval_minutes' => $this->normalizeInt($input['sync_interval_minutes'] ?? self::DEFAULT_CONFIG['sync_interval_minutes'], 1, 1440, 15),
            'employee_match_field' => $this->normalizeMatchField($input['employee_match_field'] ?? self::DEFAULT_CONFIG['employee_match_field']),
            'auto_sync_enabled' => (bool) ($input['auto_sync_enabled'] ?? self::DEFAULT_CONFIG['auto_sync_enabled']),
            'is_active' => (bool) ($input['is_active'] ?? self::DEFAULT_CONFIG['is_active']),
            'notes' => $this->trimNullableText($input['notes'] ?? self::DEFAULT_CONFIG['notes'], 2000),
            'last_validated_at' => $this->normalizeIsoDateTime($input['last_validated_at'] ?? self::DEFAULT_CONFIG['last_validated_at']),
            'last_sync_at' => $this->normalizeIsoDateTime($input['last_sync_at'] ?? self::DEFAULT_CONFIG['last_sync_at']),
        ];
    }

    private function employeeLookupIndex(string $matchField): Collection
    {
        return Employee::query()
            ->select(['id', 'uuid', 'first_name', 'last_name', 'job_title', 'email', 'phone', 'status'])
            ->where(function ($builder) {
                $builder
                    ->whereNull('status')
                    ->orWhere('status', '!=', 'resign');
            })
            ->get()
            ->mapWithKeys(function (Employee $employee) use ($matchField): array {
                $key = $this->normalizeLookupValue($matchField, $this->employeeMatchValue($employee, ['employee_match_field' => $matchField]));
                if ($key === '') {
                    return [];
                }

                return [$key => $employee];
            });
    }

    private function employeeMatchValue(Employee $employee, array $config): string
    {
        $matchField = (string) ($config['employee_match_field'] ?? 'employee_uuid');

        return match ($matchField) {
            'email' => trim((string) ($employee->email ?? '')),
            'phone' => trim((string) ($employee->phone ?? '')),
            default => (string) $employee->uuid,
        };
    }

    private function employeeName(Employee $employee): string
    {
        $full = trim(implode(' ', array_filter([
            $employee->first_name,
            $employee->last_name,
        ])));

        return $full !== '' ? $full : (string) $employee->first_name;
    }

    private function sourceLabel(Collection $logs, array $config): string
    {
        $first = $logs->first();
        $source = $first?->source;

        if ($source === 'demo') {
            return 'Demo biometric source';
        }

        if ($source === 'import') {
            return 'Imported biometric data';
        }

        if ($source === 'biometric') {
            return $first?->device_label ?: ($config['device_label'] ?: 'Biometric device');
        }

        return match ($config['provider']) {
            'bridge-api' => 'Bridge API',
            'zkteco-pull' => 'ZKTeco device',
            'csv-import' => 'CSV import',
            'demo' => 'Demo biometric source',
            default => 'Not configured',
        };
    }

    private function bridgeHeaders(array $config): array
    {
        $headers = [];
        $key = trim((string) ($config['device_key'] ?? ''));

        if ($key !== '') {
            $headers['X-Biometric-Key'] = $key;
        }

        return $headers;
    }

    private function normalizeProvider(mixed $value): string
    {
        $provider = strtolower(trim((string) $value));

        return in_array($provider, ['not-configured', 'demo', 'zkteco-pull', 'bridge-api', 'csv-import'], true)
            ? $provider
            : 'not-configured';
    }

    private function normalizeMatchField(mixed $value): string
    {
        $field = strtolower(trim((string) $value));

        return in_array($field, ['employee_uuid', 'email', 'phone'], true)
            ? $field
            : 'employee_uuid';
    }

    private function normalizeEventType(string $value): string
    {
        return strtolower(trim($value)) === 'check_out' ? 'check_out' : 'check_in';
    }

    private function normalizeSource(string $value): string
    {
        $source = strtolower(trim($value));

        return in_array($source, ['demo', 'biometric', 'import'], true)
            ? $source
            : 'biometric';
    }

    private function normalizeLookupValue(string $matchField, mixed $value): string
    {
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return '';
        }

        if ($matchField === 'email') {
            return strtolower($trimmed);
        }

        if ($matchField === 'phone') {
            return preg_replace('/\D+/', '', $trimmed) ?: $trimmed;
        }

        return strtolower($trimmed);
    }

    private function normalizeDateString(mixed $value, string $timezone): string
    {
        if ($value === null || trim((string) $value) === '') {
            return now($timezone)->toDateString();
        }

        return CarbonImmutable::parse((string) $value, $timezone)->toDateString();
    }

    private function dayBounds(?string $date, string $timezone): array
    {
        $day = CarbonImmutable::parse($this->normalizeDateString($date, $timezone), $timezone)->startOfDay();
        return [$day->utc(), $day->endOfDay()->utc()];
    }

    private function normalizeIsoDateTime(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return CarbonImmutable::parse((string) $value)->toIso8601String();
    }

    private function normalizeSyncBatchUuid(mixed $value): string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return (string) Str::uuid();
        }

        if (Str::isUuid($raw)) {
            return $raw;
        }

        return (string) Str::uuid();
    }

    private function resolveLogUuid(
        string $incomingUuid,
        string $syncBatchUuid,
        string $biometricUserId,
        string $eventTime,
        string $eventType,
        string $deviceLabel
    ): string {
        if (Str::isUuid($incomingUuid)) {
            return $incomingUuid;
        }

        $seed = implode('|', [
            $syncBatchUuid,
            strtolower(trim($biometricUserId)),
            trim($eventTime),
            strtolower(trim($eventType)),
            strtolower(trim($deviceLabel)),
        ]);

        return $this->uuidFromSeed($seed);
    }

    private function normalizeUrl(mixed $value): ?string
    {
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return null;
        }

        return rtrim($trimmed, '/');
    }

    private function trimText(mixed $value, int $max): string
    {
        return mb_substr(trim((string) $value), 0, $max);
    }

    private function trimNullableText(mixed $value, int $max): ?string
    {
        $trimmed = $this->trimText($value, $max);
        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeInt(mixed $value, int $min, int $max, int $fallback): int
    {
        $number = (int) $value;

        if ($number < $min || $number > $max) {
            return $fallback;
        }

        return $number;
    }

    private function uuidFromSeed(string $seed): string
    {
        $hash = md5($seed);
        $timeHigh = str_pad(dechex((hexdec(substr($hash, 12, 4)) & 0x0fff) | 0x4000), 4, '0', STR_PAD_LEFT);
        $clockSeq = str_pad(dechex((hexdec(substr($hash, 16, 4)) & 0x3fff) | 0x8000), 4, '0', STR_PAD_LEFT);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hash, 0, 8),
            substr($hash, 8, 4),
            $timeHigh,
            $clockSeq,
            substr($hash, 20, 12)
        );
    }
}
