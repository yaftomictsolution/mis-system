<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use App\Support\PermanentDeleteDependencyInspector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProjectController extends Controller
{
    private const OFFLINE_WINDOW_MONTHS = 12;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'since' => ['nullable', 'date'],
            'offline' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $offline = $request->boolean('offline');
        $since = $validated['since'] ?? null;
        $includeDeleted = $offline || ! is_null($since);

        $query = Project::query()->orderByDesc('updated_at');

        if ($includeDeleted) {
            $query->withTrashed();
        }

        $search = trim((string) ($validated['q'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%");
            });
        }

        if ($since) {
            $query->where(function ($builder) use ($since): void {
                $builder
                    ->where('updated_at', '>', $since)
                    ->orWhere('deleted_at', '>', $since);
            });
        }

        if ($offline) {
            $windowStart = now()->subMonths(self::OFFLINE_WINDOW_MONTHS);
            $query->where(function ($builder) use ($windowStart): void {
                $builder
                    ->where('updated_at', '>=', $windowStart)
                    ->orWhere(function ($deleted) use ($windowStart): void {
                        $deleted
                            ->whereNotNull('deleted_at')
                            ->where('deleted_at', '>=', $windowStart);
                    });
            });
        }

        $perPage = (int) ($validated['per_page'] ?? 100);
        $page = (int) ($validated['page'] ?? 1);
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginator->items())
            ->map(fn (Project $project): array => $this->payload($project))
            ->values()
            ->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'has_more' => $paginator->hasMorePages(),
                'server_time' => now()->toISOString(),
            ],
        ]);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $data = $request->validated();
        $incomingUuid = (string) ($data['uuid'] ?? '');

        $project = $incomingUuid !== ''
            ? Project::withTrashed()->where('uuid', $incomingUuid)->first()
            : null;

        $created = false;
        if (! $project) {
            $project = new Project();
            $project->uuid = $incomingUuid !== '' ? $incomingUuid : (string) Str::uuid();
            $created = true;
        } elseif ($project->trashed()) {
            $project->restore();
        }

        $project->fill([
            'name' => trim((string) $data['name']),
            'location' => isset($data['location']) ? trim((string) $data['location']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? 'planned')),
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
        ]);
        $project->save();

        return response()->json([
            'data' => $this->payload($project->fresh()),
        ], $created ? 201 : 200);
    }

    public function update(StoreProjectRequest $request, string $uuid): JsonResponse
    {
        $project = Project::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if ($project->trashed()) {
            $project->restore();
        }

        $data = $request->validated();
        $project->fill([
            'name' => trim((string) $data['name']),
            'location' => isset($data['location']) ? trim((string) $data['location']) ?: null : null,
            'status' => $this->normalizeStatus((string) ($data['status'] ?? $project->status)),
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
        ]);
        $project->save();

        return response()->json([
            'data' => $this->payload($project->fresh()),
        ]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $project = Project::withTrashed()->where('uuid', $uuid)->first();
        if ($project && ! $project->trashed()) {
            $project->delete();
        }

        return response()->json([
            'message' => 'Deleted',
        ]);
    }

    public function forceDestroy(string $uuid): JsonResponse
    {
        $project = Project::withTrashed()->where('uuid', $uuid)->firstOrFail();
        if (! $project->trashed()) {
            return response()->json([
                'message' => 'Project must be soft-deleted before permanent delete.',
            ], 409);
        }

        try {
            $project->forceDelete();
        } catch (\Throwable $e) {
            report($e);

            return response()->json(
                PermanentDeleteDependencyInspector::buildBlockedDeletePayload('Project', $project),
                409
            );
        }

        return response()->json([
            'message' => 'Permanently deleted',
        ]);
    }

    private function payload(Project $project): array
    {
        return [
            'id' => $project->id,
            'uuid' => $project->uuid,
            'name' => $project->name,
            'location' => $project->location,
            'status' => $project->status,
            'start_date' => optional($project->start_date)->toDateString(),
            'end_date' => optional($project->end_date)->toDateString(),
            'created_at' => optional($project->created_at)->toISOString(),
            'updated_at' => optional($project->updated_at)->toISOString(),
            'deleted_at' => optional($project->deleted_at)->toISOString(),
        ];
    }

    private function normalizeStatus(string $value): string
    {
        $status = strtolower(trim($value));
        return in_array($status, ['active', 'completed'], true) ? $status : 'planned';
    }
}
