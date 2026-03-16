<?php

namespace App\Services;

use App\Models\Customer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

class CrmMessageSender
{
    /**
     * @return array{ok:bool,error:?string}
     */
    public function send(Customer $customer, string $channel, string $messageType): array
    {
        $message = $this->buildMessage($customer, $messageType);
        $subject = $this->buildSubject($messageType);
        return $this->sendCustom($customer, $channel, $subject, $message);
    }

    /**
     * @return array{ok:bool,error:?string}
     */
    public function sendCustom(Customer $customer, string $channel, string $subject, string $message): array
    {
        if ($channel === 'email') {
            return $this->sendEmail($customer, $subject, $message);
        }

        if ($channel === 'sms') {
            return $this->sendSms($customer, $message);
        }

        return ['ok' => false, 'error' => 'Unsupported channel.'];
    }

    private function sendEmail(Customer $customer, string $subject, string $message): array
    {
        $to = trim((string) ($customer->email ?? ''));
        if ($to === '') {
            return ['ok' => false, 'error' => 'Customer email is missing.'];
        }

        try {
            Mail::raw($message, function ($mail) use ($to, $subject): void {
                $mail->to($to)->subject($subject);
            });

            return ['ok' => true, 'error' => null];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function sendSms(Customer $customer, string $message): array
    {
        $rawPhone = trim((string) ($customer->phone ?? ''));
        if ($rawPhone === '') {
            $rawPhone = trim((string) ($customer->phone1 ?? ''));
        }
        if ($rawPhone === '') {
            return ['ok' => false, 'error' => 'Customer phone is missing.'];
        }

        $phone = $this->normalizePhone($rawPhone);
        if (!$this->isValidE164($phone)) {
            return ['ok' => false, 'error' => 'Invalid customer phone format. Use +93XXXXXXXXX or 0XXXXXXXXX.'];
        }

        $provider = strtolower(trim((string) config('services.crm_sms.provider', 'textbelt')));
        if ($provider === 'textbelt') {
            if (str_starts_with($phone, '+93')) {
                return [
                    'ok' => false,
                    'error' => 'Textbelt free trial is limited for +93 numbers. Set CRM_SMS_PROVIDER=twilio and use Twilio trial.',
                ];
            }
            return $this->sendSmsViaTextbelt($phone, $message);
        }

        if ($provider === 'twilio') {
            return $this->sendSmsViaTwilio($phone, $message);
        }

        if ($provider === 'infobip') {
            return $this->sendSmsViaInfobip($phone, $message);
        }

        return $this->sendSmsViaCustomGateway($phone, $message);
    }

    private function sendSmsViaTextbelt(string $phone, string $message): array
    {
        $key = trim((string) config('services.crm_sms.textbelt_key', 'textbelt'));
        $sender = trim((string) config('services.crm_sms.sender', 'MIS'));

        try {
            $response = Http::asForm()->post('https://textbelt.com/text', [
                'phone' => $phone,
                'message' => $message,
                'key' => $key !== '' ? $key : 'textbelt',
                'sender' => $sender,
            ]);

            if (!$response->successful()) {
                return ['ok' => false, 'error' => "Textbelt error: HTTP {$response->status()}"];
            }

            $data = $response->json();
            if (($data['success'] ?? false) === true) {
                return ['ok' => true, 'error' => null];
            }

            $error = trim((string) ($data['error'] ?? 'Textbelt rejected message.'));
            return ['ok' => false, 'error' => $error !== '' ? $error : 'Textbelt rejected message.'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function sendSmsViaTwilio(string $phone, string $message): array
    {
        $sid = trim((string) config('services.crm_sms.twilio.account_sid', ''));
        $token = trim((string) config('services.crm_sms.twilio.auth_token', ''));
        $from = trim((string) config('services.crm_sms.twilio.from', ''));
        $messagingServiceSid = trim((string) config('services.crm_sms.twilio.messaging_service_sid', ''));

        if ($sid === '' || $token === '') {
            return ['ok' => false, 'error' => 'Twilio account SID or auth token is missing.'];
        }
        if ($from === '' && $messagingServiceSid === '') {
            return ['ok' => false, 'error' => 'Twilio config is incomplete. Set CRM_SMS_TWILIO_FROM or CRM_SMS_TWILIO_MESSAGING_SERVICE_SID.'];
        }

        try {
            $payload = [
                'To' => $phone,
                'Body' => $message,
            ];
            if ($messagingServiceSid !== '') {
                $payload['MessagingServiceSid'] = $messagingServiceSid;
            } else {
                $payload['From'] = $from;
            }

            $response = Http::asForm()
                ->withBasicAuth($sid, $token)
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", $payload);

            if ($response->successful()) {
                return ['ok' => true, 'error' => null];
            }

            $errorCode = (int) ($response->json('code') ?? 0);
            $error = trim((string) ($response->json('message') ?? 'Twilio rejected message.'));

            if ($errorCode === 21608) {
                return ['ok' => false, 'error' => 'Twilio trial can send only to verified destination numbers. Verify this +93 number in Twilio console first.'];
            }

            if ($errorCode === 21408) {
                return ['ok' => false, 'error' => 'Twilio geo permissions are not enabled for Afghanistan (+93). Enable Afghanistan in Twilio Messaging Geo Permissions.'];
            }

            $fallback = $error !== '' ? $error : "Twilio error: HTTP {$response->status()}";
            return ['ok' => false, 'error' => $errorCode > 0 ? "Twilio {$errorCode}: {$fallback}" : $fallback];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function sendSmsViaCustomGateway(string $phone, string $message): array
    {
        $gatewayUrl = trim((string) config('services.crm_sms.gateway_url', ''));
        if ($gatewayUrl === '') {
            return ['ok' => false, 'error' => 'SMS gateway is not configured.'];
        }

        $apiKey = trim((string) config('services.crm_sms.api_key', ''));
        $sender = trim((string) config('services.crm_sms.sender', 'MIS'));

        try {
            $request = Http::asJson();
            if ($apiKey !== '') {
                $request = $request->withHeaders(['Authorization' => "Bearer {$apiKey}"]);
            }

            $response = $request->post($gatewayUrl, [
                'to' => $phone,
                'message' => $message,
                'sender' => $sender,
            ]);

            if ($response->successful()) {
                return ['ok' => true, 'error' => null];
            }

            return ['ok' => false, 'error' => "SMS gateway error: HTTP {$response->status()}"];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function sendSmsViaInfobip(string $phone, string $message): array
    {
        $baseUrl = rtrim(trim((string) config('services.crm_sms.infobip.base_url', '')), '/');
        $apiKey = trim((string) config('services.crm_sms.infobip.api_key', ''));
        $sender = trim((string) config('services.crm_sms.infobip.sender', 'ServiceSMS'));

        if ($baseUrl === '' || $apiKey === '') {
            return ['ok' => false, 'error' => 'Infobip config is incomplete. Set CRM_SMS_INFOBIP_BASE_URL and CRM_SMS_INFOBIP_API_KEY.'];
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => "App {$apiKey}",
                'Accept' => 'application/json',
            ])->post("{$baseUrl}/sms/3/messages", [
                'messages' => [[
                    'sender' => $sender !== '' ? $sender : 'ServiceSMS',
                    'destinations' => [
                        ['to' => $phone],
                    ],
                    'content' => [
                        'text' => $message,
                    ],
                ]],
            ]);

            if (!$response->successful()) {
                $details = trim((string) ($response->json('requestError.serviceException.text') ?? ''));
                $fallback = "Infobip error: HTTP {$response->status()}";
                return ['ok' => false, 'error' => $details !== '' ? $details : $fallback];
            }

            $groupName = strtoupper(trim((string) ($response->json('messages.0.status.groupName') ?? '')));
            if (in_array($groupName, ['PENDING', 'ACCEPTED', 'DELIVERED'], true)) {
                return ['ok' => true, 'error' => null];
            }

            $name = trim((string) ($response->json('messages.0.status.name') ?? ''));
            $description = trim((string) ($response->json('messages.0.status.description') ?? ''));
            $parts = array_filter([$name, $description], fn ($v): bool => $v !== '');
            $error = $parts ? ('Infobip: ' . implode(' - ', $parts)) : 'Infobip rejected message.';
            return ['ok' => false, 'error' => $error];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function buildSubject(string $messageType): string
    {
        return 'MIS CRM - ' . str_replace('_', ' ', ucfirst(trim($messageType)));
    }

    private function buildMessage(Customer $customer, string $messageType): string
    {
        $name = trim((string) ($customer->name ?? 'Customer'));

        return match (trim($messageType)) {
            'installment_due' => "Dear {$name}, your installment payment is due. Please contact finance office.",
            'overdue' => "Dear {$name}, your payment is overdue. Please clear your due amount as soon as possible.",
            'deed_ready' => "Dear {$name}, your record is clear. Please visit office for deed issuance process.",
            default => "Dear {$name}, this is a {$messageType} update from MIS system.",
        };
    }

    private function normalizePhone(string $phone): string
    {
        $clean = preg_replace('/\s+/', '', trim($phone)) ?? '';
        $clean = str_replace(['-', '(', ')'], '', $clean);

        if (str_starts_with($clean, '00')) {
            $clean = '+' . substr($clean, 2);
        }

        if (str_starts_with($clean, '+')) {
            $digits = preg_replace('/\D+/', '', substr($clean, 1)) ?? '';
            return $digits === '' ? '' : ('+' . $digits);
        }

        $digits = preg_replace('/\D+/', '', $clean) ?? '';
        if ($digits === '') {
            return '';
        }

        if (str_starts_with($digits, '93')) {
            return '+' . $digits;
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '0')) {
            return '+93' . substr($digits, 1);
        }

        if (strlen($digits) === 9 && str_starts_with($digits, '7')) {
            return '+93' . $digits;
        }

        return '+' . $digits;
    }

    private function isValidE164(string $phone): bool
    {
        return (bool) preg_match('/^\+[1-9]\d{7,14}$/', $phone);
    }
}
