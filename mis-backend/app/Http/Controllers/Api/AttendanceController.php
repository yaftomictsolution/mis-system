<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BiometricAttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly BiometricAttendanceService $attendanceService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date'],
        ]);

        return response()->json([
            'data' => $this->attendanceService->dailyDashboard($validated['date'] ?? null),
        ]);
    }
}
