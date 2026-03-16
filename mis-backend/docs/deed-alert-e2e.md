# Deed Alert E2E Quick Check

## Purpose
Verify that when a sale is deed-eligible, the system:
- creates admin notification
- sends admin email
- shows alert in frontend bell menu

## 1) Run dry check
```bash
php artisan deed-alert:verify
```

If no eligible sale is found, pass a specific sale UUID:
```bash
php artisan deed-alert:verify 11111111-2222-3333-4444-555555555555
```

## 2) Send real alert (email + DB notification)
```bash
php artisan deed-alert:verify 11111111-2222-3333-4444-555555555555 --send
```

## 3) Confirm backend notifications API
Routes:
- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `POST /api/notifications/{id}/read`

## 4) Confirm frontend
1. Login as admin user with `sales.approve`.
2. Open bell menu in top nav.
3. You should see deed-approval notification.
4. Click item to open sale financial page.
5. Mark it read from menu (single/all).

## 5) Email configuration
Set backend `.env`:
```env
APP_FRONTEND_URL=http://localhost:3000
MAIL_MAILER=smtp
MAIL_HOST=...
MAIL_PORT=...
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=...
MAIL_FROM_NAME="${APP_NAME}"
```

For local testing without SMTP:
```env
MAIL_MAILER=log
```
Then check `storage/logs/laravel.log`.

