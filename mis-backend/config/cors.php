<?php

$frontendOrigin = env('APP_FRONTEND_URL', 'http://localhost:3000');

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique(array_filter([
        $frontendOrigin,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]))),
    'allowed_headers' => ['*'],
    'supports_credentials' => true, // Bearer token
];
