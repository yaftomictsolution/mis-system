<?php

use App\Http\Middleware\RestrictCustomerInternalApiAccess;
use Illuminate\Foundation\Application;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'internal.user.only' => RestrictCustomerInternalApiAccess::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        $days = max(1, (int) env('CRM_REMINDER_DAYS_BEFORE_DUE', 10));
        $time = (string) env('CRM_REMINDER_DAILY_AT', '09:00');

        $schedule
            ->command("crm:send-installment-reminders --days={$days}")
            ->dailyAt($time)
            ->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();