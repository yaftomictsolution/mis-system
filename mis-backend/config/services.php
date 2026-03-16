<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'crm_sms' => [
        'provider' => env('CRM_SMS_PROVIDER', 'textbelt'),
        'gateway_url' => env('CRM_SMS_GATEWAY_URL'),
        'api_key' => env('CRM_SMS_API_KEY'),
        'sender' => env('CRM_SMS_SENDER', 'MIS'),
        'textbelt_key' => env('CRM_SMS_TEXTBELT_KEY', 'textbelt'),
        'twilio' => [
            'account_sid' => env('CRM_SMS_TWILIO_ACCOUNT_SID'),
            'auth_token' => env('CRM_SMS_TWILIO_AUTH_TOKEN'),
            'from' => env('CRM_SMS_TWILIO_FROM'),
            'messaging_service_sid' => env('CRM_SMS_TWILIO_MESSAGING_SERVICE_SID'),
        ],
        'infobip' => [
            'base_url' => env('CRM_SMS_INFOBIP_BASE_URL'),
            'api_key' => env('CRM_SMS_INFOBIP_API_KEY'),
            'sender' => env('CRM_SMS_INFOBIP_SENDER', 'ServiceSMS'),
        ],
    ],

];
