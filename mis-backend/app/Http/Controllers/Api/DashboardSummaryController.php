<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardSummaryController extends Controller
{
    public function __construct(
        private readonly DashboardSummaryService $summaryService
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->summaryService->buildForUser($request->user()),
            'meta' => [
                'server_time' => now()->toISOString(),
            ],
        ]);
    }
}
