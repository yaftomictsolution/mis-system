<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CrmMessage;
use App\Models\Customer;
use App\Services\CrmMessageSender;
use App\Services\InstallmentReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CrmMessageController extends Controller
{

    
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'customer_id' => ['nullable', 'integer', 'min:1'],
            'channel' => ['nullable', 'in:email,sms'],
            'status' => ['nullable', 'in:queued,sent,failed'],
            'q' => ['nullable', 'string', 'max:255'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);
        $page = (int) ($validated['page'] ?? 1);

        $query = CrmMessage::query()
            ->with(['customer:id,name,phone,email', 'installment:id,uuid,installment_no,due_date'])
            ->latest('id');

        if (!empty($validated['customer_id'])) {
            $query->where('customer_id', (int) $validated['customer_id']);
        }
        if (!empty($validated['channel'])) {
            $query->where('channel', (string) $validated['channel']);
        }
        if (!empty($validated['status'])) {
            $query->where('status', (string) $validated['status']);
        }

        $q = trim((string) ($validated['q'] ?? ''));
        if ($q !== '') {
            $query->where(function ($builder) use ($q): void {
                $builder->where('message_type', 'like', "%{$q}%")
                    ->orWhere('status', 'like', "%{$q}%")
                    ->orWhereHas('customer', function ($customerQuery) use ($q): void {
                        $customerQuery->where('name', 'like', "%{$q}%")
                            ->orWhere('phone', 'like', "%{$q}%")
                            ->orWhere('email', 'like', "%{$q}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())
            ->map(fn (CrmMessage $message): array => $this->payload($message))
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

    public function store(Request $request, CrmMessageSender $sender): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'min:1', 'exists:customers,id'],
            'channel' => ['required', 'in:email,sms'],
            'message_type' => ['required', 'string', 'max:120'],
        ]);

        $customer = Customer::query()->findOrFail((int) $validated['customer_id']);
        $channel = (string) $validated['channel'];
        $messageType = trim((string) $validated['message_type']);
        $result = $sender->send($customer, $channel, $messageType);

        $row = CrmMessage::query()->create([
            'customer_id' => (int) $customer->id,
            'channel' => $channel,
            'message_type' => $messageType,
            'status' => $result['ok'] ? 'sent' : 'failed',
            'sent_at' => $result['ok'] ? now() : null,
            'error_message' => $result['ok'] ? null : ($result['error'] ?? 'Failed to send'),
        ]);

        $statusCode = $result['ok'] ? 201 : 422;
        return response()->json([
            'message' => $result['ok'] ? 'CRM message sent successfully.' : ($result['error'] ?: 'CRM message failed.'),
            'data' => $this->payload($row->fresh(['customer', 'installment'])),
        ], $statusCode);
    }

    public function retry(string $id, CrmMessageSender $sender): JsonResponse
    {
        $row = CrmMessage::query()->with('customer')->findOrFail((int) $id);
        $customer = $row->customer;
        if (!$customer) {
            return response()->json([
                'message' => 'Customer not found for this CRM message.',
            ], 422);
        }

        $result = $sender->send($customer, (string) $row->channel, (string) $row->message_type);
        $row->status = $result['ok'] ? 'sent' : 'failed';
        $row->sent_at = $result['ok'] ? now() : null;
        $row->error_message = $result['ok'] ? null : ($result['error'] ?? 'Failed to send');
        $row->save();

        return response()->json([
            'message' => $result['ok'] ? 'CRM message retried successfully.' : ($result['error'] ?: 'CRM retry failed.'),
            'data' => $this->payload($row->fresh(['customer', 'installment'])),
        ], $result['ok'] ? 200 : 422);
    }

    public function runInstallmentReminders(Request $request, InstallmentReminderService $service): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'min:1', 'max:30'],
        ]);

        $days = (int) ($validated['days'] ?? 10);
        $stats = $service->sendDueSoonReminders($days);

        return response()->json([
            'message' => 'Due reminder run completed.',
            'data' => $stats,
        ]);
    }

    private function payload(CrmMessage $row): array
    {
        $customer = $row->relationLoaded('customer') ? $row->customer : null;
        $installment = $row->relationLoaded('installment') ? $row->installment : null;

        return [
            'id' => (int) $row->id,
            'customer_id' => (int) $row->customer_id,
            'installment_id' => $row->installment_id ? (int) $row->installment_id : null,
            'installment_uuid' => $installment?->uuid,
            'installment_no' => $installment?->installment_no,
            'installment_due_date' => $installment?->due_date?->toDateString(),
            'customer_name' => $customer?->name,
            'customer_phone' => $customer?->phone,
            'customer_email' => $customer?->email,
            'channel' => (string) $row->channel,
            'message_type' => (string) $row->message_type,
            'status' => (string) $row->status,
            'error_message' => $row->error_message ? (string) $row->error_message : null,
            'metadata' => is_array($row->metadata) ? $row->metadata : null,
            'sent_at' => $row->sent_at?->toISOString(),
            'created_at' => $row->created_at?->toISOString(),
            'updated_at' => $row->updated_at?->toISOString(),
        ];
    }
}

