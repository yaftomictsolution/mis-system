<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RestrictCustomerInternalApiAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        $isCustomerLinked = (int) ($user->customer_id ?? 0) > 0;
        $isCustomerRole = method_exists($user, 'hasRole') ? $user->hasRole('Customer') : false;

        if ($isCustomerLinked || $isCustomerRole) {
            return new JsonResponse([
                'message' => 'Customer portal accounts cannot access internal APIs.',
            ], 403);
        }

        return $next($request);
    }
}