<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'unread_only' => ['nullable', 'boolean'],
        ]);

        $user = $request->user();
        $perPage = (int) ($validated['per_page'] ?? 20);
        $page = (int) ($validated['page'] ?? 1);
        $unreadOnly = (bool) ($validated['unread_only'] ?? false);

        $query = $unreadOnly ? $user->unreadNotifications() : $user->notifications();
        $paginator = $query->latest()->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginator->items())
            ->map(fn (DatabaseNotification $notification): array => $this->payload($notification))
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

    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();
        if (!$notification->read_at) {
            $notification->markAsRead();
        }

        return response()->json([
            'message' => 'Notification marked as read.',
            'data' => $this->payload($notification->fresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $unread = $user->unreadNotifications;
        $count = $unread->count();
        if ($count > 0) {
            $unread->markAsRead();
        }

        return response()->json([
            'message' => 'All notifications marked as read.',
            'count' => $count,
        ]);
    }

    public function destroyRead(Request $request): JsonResponse
    {
        $count = $request->user()->notifications()->whereNotNull('read_at')->delete();

        return response()->json([
            'message' => 'Read notifications deleted successfully.',
            'count' => $count,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();
        $notification->delete();

        return response()->json([
            'message' => 'Notification deleted successfully.',
            'id' => $id,
        ]);
    }

    private function payload(DatabaseNotification $notification): array
    {
        $data = is_array($notification->data) ? $notification->data : [];

        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'category' => $data['category'] ?? null,
            'title' => (string) ($data['title'] ?? 'Notification'),
            'message' => (string) ($data['message'] ?? 'You have a new notification.'),
            'sale_uuid' => $data['sale_uuid'] ?? null,
            'sale_id' => $data['sale_id'] ?? null,
            'read_at' => $notification->read_at?->toISOString(),
            'created_at' => $notification->created_at?->toISOString(),
            'data' => $data,
        ];
    }
}
