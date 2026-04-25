<?php

$frontendOrigins = array_values(array_unique(array_filter(array_map(
    static fn (string $origin): string => trim($origin),
    array_merge(
        [env('APP_FRONTEND_URL', 'http://localhost:3000')],
        explode(',', (string) env('APP_FRONTEND_URLS', '')),
        ['http://localhost:3000', 'http://127.0.0.1:3000']
    )
))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $frontendOrigins,
    'allowed_headers' => ['*'],
    'supports_credentials' => true, // Bearer token
];
