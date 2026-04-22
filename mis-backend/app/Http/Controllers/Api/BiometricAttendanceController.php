<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BiometricAttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BiometricAttendanceController extends Controller
{
    public function __construct(
        private readonly BiometricAttendanceService $attendanceService
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        return response()->json([
            'data' => $this->attendanceService->adminConfig(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $validated = $this->validateConfigInput($request);
        $saved = $this->attendanceService->updateConfig($validated, (int) ($request->user()?->id ?? 0));

        return response()->json([
            'message' => 'Biometric attendance configuration saved successfully.',
            'data' => $saved,
        ]);
    }

    public function validateConnection(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $validated = $this->validateConfigInput($request);
        $result = $this->attendanceService->validateConfig($validated);

        return response()->json($result);
    }

    public function syncNow(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $validated = $this->validateConfigInput($request, true);
        $result = $this->attendanceService->syncNow($validated, (int) ($request->user()?->id ?? 0));

        return response()->json($result);
    }

    public function clearDemoPunches(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'date' => ['nullable', 'date'],
        ]);

        return response()->json(
            $this->attendanceService->clearDemoPunches($validated['date'] ?? null)
        );
    }

    public function ingestBridgePunches(Request $request): JsonResponse
    {
        $config = $this->attendanceService->adminConfig();
        $configuredKey = $this->attendanceService->configuredBridgeKey();

        if ($config['provider'] === 'not-configured') {
            throw ValidationException::withMessages([
                'provider' => ['Biometric attendance is not configured yet.'],
            ]);
        }

        if ($configuredKey === null) {
            throw ValidationException::withMessages([
                'device_key' => ['No biometric bridge key is configured on the server.'],
            ]);
        }

        $providedKey = trim((string) ($request->header('X-Biometric-Key') ?: $request->bearerToken() ?: ''));

        if ($providedKey === '' || ! hash_equals($configuredKey, $providedKey)) {
            throw ValidationException::withMessages([
                'authorization' => ['Invalid biometric bridge key.'],
            ]);
        }

        $validated = $request->validate([
            'device_label' => ['nullable', 'string', 'max:120'],
            'sync_batch_uuid' => ['nullable', 'string', 'max:100'],
            'punches' => ['required', 'array', 'min:1', 'max:1000'],
            'punches.*.uuid' => ['nullable', 'uuid'],
            'punches.*.biometric_user_id' => ['required', 'string', 'max:255'],
            'punches.*.employee_lookup_value' => ['nullable', 'string', 'max:255'],
            'punches.*.event_time' => ['required', 'date'],
            'punches.*.event_type' => ['required', Rule::in(['check_in', 'check_out'])],
            'punches.*.source' => ['nullable', Rule::in(['demo', 'biometric', 'import'])],
            'punches.*.raw_payload' => ['nullable', 'array'],
        ]);

        return response()->json(
            $this->attendanceService->ingestPunchBatch($validated)
        );
    }

    private function validateConfigInput(Request $request, bool $includeDate = false): array
    {
        $rules = [
            'provider' => ['nullable', Rule::in(['not-configured', 'demo', 'zkteco-pull', 'bridge-api', 'csv-import'])],
            'device_label' => ['nullable', 'string', 'max:120'],
            'ip_address' => ['nullable', 'string', 'max:120'],
            'port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'api_base_url' => ['nullable', 'url', 'max:255'],
            'device_key' => ['nullable', 'string', 'max:255'],
            'serial_number' => ['nullable', 'string', 'max:120'],
            'timezone' => ['nullable', 'string', 'max:120'],
            'sync_interval_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'employee_match_field' => ['nullable', Rule::in(['employee_uuid', 'email', 'phone', 'biometric_user_id'])],
            'auto_sync_enabled' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];

        if ($includeDate) {
            $rules['date'] = ['nullable', 'date'];
        }

        return $request->validate($rules);
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();

        if (! $user || ! $user->hasRole('Admin')) {
            throw ValidationException::withMessages([
                'permission' => ['Only admin can manage biometric attendance settings.'],
            ]);
        }
    }
}
