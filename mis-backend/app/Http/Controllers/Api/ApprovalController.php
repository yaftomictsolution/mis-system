<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Approval;
use App\Models\ApprovalLog;
use Illuminate\Http\Request;

class ApprovalController extends Controller
{
    public function index(Request $request)
    {
        // optionally filter by module/status
        $q = Approval::query()->with('logs')->orderByDesc('id');

        if ($request->filled('status')) {
            $q->where('status', $request->status);
        }
        if ($request->filled('module')) {
            $q->where('module', $request->module);
        }

        return response()->json([
            'data' => $q->paginate(20),
        ]);
    }

    public function approve(Request $request, Approval $approval)
    {
        $request->validate(['remarks' => ['nullable', 'string']]);

        if ($approval->status !== 'pending') {
            return response()->json(['message' => 'Approval already resolved'], 409);
        }

        $approval->status = 'approved';
        $approval->resolved_at = now();
        $approval->save();

        ApprovalLog::create([
            'approval_id' => $approval->id,
            'approved_by' => $request->user()->id,
            'action' => 'approve',
            'remarks' => $request->remarks,
            'action_date' => now(),
        ]);

        return response()->json(['message' => 'Approved']);
    }

    public function reject(Request $request, Approval $approval)
    {
        $request->validate(['remarks' => ['nullable', 'string']]);

        if ($approval->status !== 'pending') {
            return response()->json(['message' => 'Approval already resolved'], 409);
        }

        $approval->status = 'rejected';
        $approval->resolved_at = now();
        $approval->save();

        ApprovalLog::create([
            'approval_id' => $approval->id,
            'approved_by' => $request->user()->id,
            'action' => 'reject',
            'remarks' => $request->remarks,
            'action_date' => now(),
        ]);

        return response()->json(['message' => 'Rejected']);
    }
}
