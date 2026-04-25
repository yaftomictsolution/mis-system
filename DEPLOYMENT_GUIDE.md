# MIS Deployment Guide

This project is now closer to production-ready for both normal online use and offline-first/PWA use. The main hardening work completed in code is:

Important:
- The short bullet list below mixes broader repo hardening work with deployment-oriented changes.
- For the exact verified production fixes used on `app.yaftom.com` and `api.yaftom.com`, use the `Live Launch Postmortem For yaftom.com` section first.

- Frontend PWA caching now uses the configured API origin instead of only `localhost:8000`.
- Frontend cache revisions now rotate per build so new deployments replace stale offline pages.
- Backend storage assets can now be cached after first load for better offline preview behavior.
- Frontend auth now sends a stable per-device name so Sanctum tokens are isolated by browser/device.
- Backend login/logout now revoke only the current device token instead of all user tokens.
- Backend offline-policy persistence now includes `employees`, `warehouse_material_stocks`, `project_material_stocks`, and `exchange_rates`, matching the frontend.
- Frontend now ships the UI font through the Next.js build instead of depending on Google Fonts at runtime.

## Live Launch Postmortem For `yaftom.com`

This section documents the real production issues that blocked launch on the live server and the exact fixes used to get the app working. Use this as the reference for future apps so the same problems do not repeat.

### Live Production Topology

- cPanel account user: `yaftom`
- Server home: `/home/yaftom`
- Git checkout root: `/home/yaftom/mis-system`
- Frontend source: `/home/yaftom/mis-system/mis-front`
- Backend source: `/home/yaftom/mis-system/mis-backend`
- Frontend domain: `https://app.yaftom.com`
- Backend domain: `https://api.yaftom.com`
- Frontend Passenger app name: `mis-front`
- Frontend Passenger app path: `/home/yaftom/mis-system/mis-front`
- Frontend Passenger Node runtime: `/opt/cpanel/ea-nodejs22/bin/node`
- Frontend public docroot: `/home/yaftom/public_html/app.yaftom.com`
- Backend public docroot: `/home/yaftom/public_html/api.yaftom.com`
- Frontend Apache include, non-SSL: `/etc/apache2/conf.d/userdata/std/2_4/yaftom/app.yaftom.com/mis-front.conf`
- Frontend Apache include, SSL: `/etc/apache2/conf.d/userdata/ssl/2_4/yaftom/app.yaftom.com/mis-front.conf`

### What Blocked Go-Live

#### 1. No working SSH deployment access

Symptom:
- The server rejected the local key with `Permission denied (publickey,...)`.

Root cause:
- The local public key was not authorized for the `yaftom` account.

Fix:
- Created `/home/yaftom/.ssh`
- Created `/home/yaftom/.ssh/authorized_keys`
- Added the local public key to `authorized_keys`
- Corrected ownership and permissions:
  - directory `700`
  - file `600`
  - owner `yaftom:yaftom`

Server paths updated:
- `/home/yaftom/.ssh`
- `/home/yaftom/.ssh/authorized_keys`

Lesson:
- Before any deployment work, verify SSH access first. Do not start debugging the app until `ssh yaftom@server-ip` works cleanly.

#### 2. cPanel Passenger could not reliably boot the Next.js app

Symptom:
- The Node app needed a predictable entrypoint for Passenger.

Root cause:
- Next.js repo root needed a dedicated startup file for Passenger instead of assuming cPanel would infer the correct runtime behavior.

Fix:
- Added a custom `app.js` in the frontend root to start Next.js under Passenger and log startup failures.

Repo file updated:
- `mis-front/app.js`

Lesson:
- On cPanel Passenger, always provide an explicit Node entrypoint for Next.js apps instead of relying on implicit startup behavior.

#### 3. `app.yaftom.com` homepage worked but `/login` and `/offline` returned Apache 500

Symptom:
- `https://app.yaftom.com/` could work while `https://app.yaftom.com/login` and other extensionless routes showed Apache's `500 Internal Server Error`.

Root cause:
- Passenger was registered, but the SSL Apache include for the subdomain was missing or not aligned with the non-SSL Passenger include.
- This is a cPanel routing problem, not a Next.js code problem.

Fix:
- Confirmed the built app worked directly outside Apache by running:
  - `PORT=3307 HOST=127.0.0.1 NODE_ENV=production /opt/cpanel/ea-nodejs22/bin/node app.js`
- Confirmed local direct requests returned `200`
- Created or copied the Passenger include so both paths existed:
  - `/etc/apache2/conf.d/userdata/std/2_4/yaftom/app.yaftom.com/mis-front.conf`
  - `/etc/apache2/conf.d/userdata/ssl/2_4/yaftom/app.yaftom.com/mis-front.conf`
- Rebuilt Apache config and restarted Apache

Server sections updated:
- cPanel Application Manager registration for `mis-front`
- Apache userdata include for `std`
- Apache userdata include for `ssl`

Lesson:
- If `/` works but `/login` or `/offline` fails with Apache 500, test the Node app directly first. If direct local requests return `200`, the problem is Apache or Passenger routing, not frontend application code.

#### 4. Static assets were not being served from the frontend docroot

Symptom:
- App HTML could load while file-like requests such as `/_next/static/*`, `sw.js`, `manifest.json`, `favicon.ico`, or icons failed or were stale.

Root cause:
- On this cPanel setup, Passenger handled app routes, but Apache or NGINX still served many static file requests from the subdomain document root.
- The document root was separate from the actual Next.js source path.

Fix:
- Exposed built assets through the frontend document root using symlinks
- Linked `_next/static` to the build output
- Linked public assets and app icons into `/home/yaftom/public_html/app.yaftom.com`

Server paths updated:
- `/home/yaftom/public_html/app.yaftom.com/_next/static`
- `/home/yaftom/public_html/app.yaftom.com/sw.js`
- `/home/yaftom/public_html/app.yaftom.com/manifest.json`
- `/home/yaftom/public_html/app.yaftom.com/favicon.ico`
- `/home/yaftom/public_html/app.yaftom.com/icon.png`
- `/home/yaftom/public_html/app.yaftom.com/apple-icon.png`
- plus other public assets symlinked from `mis-front/public`

Lesson:
- On cPanel Passenger, never assume static assets come from the app root. Always test:
  - `/_next/static/...`
  - `/sw.js`
  - `/manifest.json`
  - `/favicon.ico`
  - `/icon.png`

#### 5. Backend needed a shared-host public entrypoint

Symptom:
- The Laravel backend source lived in the repo checkout, but the live API subdomain needed a public-facing docroot.

Root cause:
- cPanel subdomain docroot and Laravel app source path were different.

Fix:
- Used `/home/yaftom/public_html/api.yaftom.com` as the backend public root
- Replaced the public `index.php` there so it points back to the real Laravel app in `/home/yaftom/mis-system/mis-backend`
- Linked `/storage` from the backend public docroot to Laravel storage

Server paths updated:
- `/home/yaftom/public_html/api.yaftom.com/index.php`
- `/home/yaftom/public_html/api.yaftom.com/storage`

Lesson:
- For Laravel on shared hosting, the public subdomain folder often needs a bridge `index.php` that points to the real app directory.

#### 6. PWA deploys stayed stale because cache revisions did not rotate

Symptom:
- New deployments could still serve old cached shells, old offline pages, or old route bundles.

Root cause:
- The service worker precache revision for app routes was effectively fixed, so clients had no strong signal that the shell changed.

Fix:
- Changed frontend cache revisioning to use `APP_BUILD_ID` instead of a hardcoded revision
- Set live frontend env:
  - `NEXT_PUBLIC_API_BASE_URL=https://api.yaftom.com`
  - `NEXT_PUBLIC_ENABLE_SW=true`
  - `APP_BUILD_ID=release-2026-04-23-v5`
- Rebuilt the frontend so `sw.js` precache entries used the new version string

Repo file updated:
- `mis-front/next.config.ts`

Server file updated:
- `/home/yaftom/mis-system/mis-front/.env`

Generated output updated:
- `mis-front/public/sw.js`

Lesson:
- Never deploy a PWA with a permanent precache revision like `v1`. Use a per-release value such as `APP_BUILD_ID`.

#### 7. Browser clients crashed on stale chunk URLs after rebuilds

Symptom:
- Browsers with stale HTML or stale service-worker state requested old chunk files such as:
  - `/_next/static/chunks/app/layout-18d47e90e58da309.js`
- This caused client-side exceptions after deployment.

Root cause:
- Next.js chunk filenames changed on rebuild, but some clients still referenced the previous chunk paths.

Fix:
- After each build, copied the current chunk files to the older filenames still being requested by stale clients
- Kept compatibility chunk aliases in `.next/static/chunks/...`
- Cleared NGINX cache and restarted Passenger after build

Server-only compatibility paths updated after build:
- `/home/yaftom/mis-system/mis-front/.next/static/chunks/app/layout-18d47e90e58da309.js`
- `/home/yaftom/mis-system/mis-front/.next/static/chunks/app/(auth)/login/page-8bce6af12d4bf90d.js`

Operational commands used:
- `uapi PassengerApps disable_application name=mis-front`
- `uapi PassengerApps enable_application name=mis-front`
- `uapi NginxCaching clear_cache`

Lesson:
- For PWA deploys on cPanel, assume some clients will briefly request old chunks. Either force a hard invalidation strategy or keep temporary compatibility aliases for one release cycle.

#### 8. Offline pages were not truly warmed into the document cache

Symptom:
- Pages looked reachable online, but some routes were not available offline when the internet was later turned off.

Root cause:
- Route warming fetched pages, but did not always write the HTML responses into the `pages` cache in a reliable way.

Fix:
- Updated route warming to store HTML directly into the `pages` cache
- Cached both the normalized route and the absolute route

Repo file updated:
- `mis-front/src/pwa/cacheWarm.ts`

Lesson:
- For offline route support, do not only "visit" a page. Explicitly store the HTML response in Cache Storage.

#### 9. Cache schema cleanup was wiping the whole PWA cache

Symptom:
- Offline mode could break after updates because previously cached shells disappeared.

Root cause:
- Cache schema cleanup deleted all browser cache buckets, including Workbox precache buckets needed for offline app loading.

Fix:
- Restricted cache cleanup to only the API GET cache bucket instead of deleting all Cache Storage buckets

Repo file updated:
- `mis-front/src/sync/cacheSchema.ts`

Lesson:
- Never blanket-delete all Cache Storage buckets in a PWA unless you are intentionally rebuilding the entire offline app shell from scratch.

#### 10. Offline login could redirect to `/offline` instead of the dashboard

Symptom:
- After the app had been cached, a user could still get pushed to `https://app.yaftom.com/offline` when clicking Login offline.

Root cause:
- Redirect normalization allowed `/offline` to remain a valid redirect target in some login flows.

Fix:
- Rejected `/offline` and `/login` as redirect targets during login redirect normalization
- Prevented the generic login redirect helper from redirecting away when already on `/offline`

Repo files updated:
- `mis-front/app/(auth)/login/page.tsx`
- `mis-front/src/lib/api.ts`

Lesson:
- In offline-capable auth flows, `/offline` should be treated as a fallback shell, not as a normal post-login redirect target.

#### 11. Dashboard data needed to prefer local data while offline

Symptom:
- A cached shell could load, but the dashboard still behaved like it preferred online fetch logic and did not always show the best local snapshot offline.

Root cause:
- Dashboard refresh logic only preferred local data when explicitly told to do so, not automatically when the browser was offline.

Fix:
- Made dashboard refresh prefer local IndexedDB data when offline

Repo file updated:
- `mis-front/src/components/dashboard/useDashboardData.ts`

Lesson:
- For offline-first modules, offline mode should automatically switch to local-first reads without waiting for a special caller flag.

#### 12. Queue badge stayed at `1` even after the record reached the server

Symptom:
- A record synced to the server database, but the UI still showed `Queue 1`.

Root cause:
- The queue badge was a single combined count
- It did not clearly distinguish between record sync items and pending file attachments
- The UI refresh path was too dependent on timer and event timing

Fix:
- Emitted `sync:queue:changed` immediately when sync rows were deleted
- Added live Dexie subscriptions so queue counts refresh directly from IndexedDB
- Split queue display into `Records X` and `Files Y`

Repo files updated:
- `mis-front/src/sync/syncEngine.ts`
- `mis-front/src/sync/queueCount.ts`
- `mis-front/src/sync/useSyncWidget.ts`
- `mis-front/src/components/layout/SystemStatus.tsx`

Lesson:
- In offline sync UIs, never show a single anonymous queue number. Separate main record queue from file queue so users know what is still pending.

### Repo Files Confirmed As Part Of The Live Frontend Fixes

- `mis-front/app.js`
- `mis-front/next.config.ts`
- `mis-front/app/(auth)/login/page.tsx`
- `mis-front/src/lib/api.ts`
- `mis-front/src/components/dashboard/useDashboardData.ts`
- `mis-front/src/pwa/cacheWarm.ts`
- `mis-front/src/sync/cacheSchema.ts`
- `mis-front/src/sync/syncEngine.ts`
- `mis-front/src/sync/queueCount.ts`
- `mis-front/src/sync/useSyncWidget.ts`
- `mis-front/src/components/layout/SystemStatus.tsx`
- `mis-front/public/sw.js` generated after build

### Server-Only Changes That Were Required

- Authorized SSH key for `yaftom`
- Registered Passenger app `mis-front`
- Ensured Passenger used Node `22` at `/opt/cpanel/ea-nodejs22/bin/node`
- Exposed frontend static assets in `/home/yaftom/public_html/app.yaftom.com`
- Wired backend public subdomain folder to the Laravel repo
- Created backend storage symlink
- Added or corrected Apache Passenger include for both `std` and `ssl`
- Rebuilt frontend on the server
- Restarted Passenger and cleared NGINX cache after deployment
- Preserved temporary compatibility chunk filenames after build

### Repeatable Launch Checklist For The Next App

1. Confirm SSH access before touching the app.
2. Map the topology first:
   - repo root
   - frontend source path
   - backend source path
   - frontend docroot
   - backend docroot
   - Passenger app name
   - Node binary
3. Test the Node app directly outside Apache before debugging routes.
4. Verify both Apache include paths exist for Passenger:
   - `std`
   - `ssl`
5. Verify static asset delivery from the docroot, not just `/`.
6. Give the PWA a real per-release cache version.
7. After every build, clear front-facing caches and restart the app runtime.
8. Test online and offline using the real launch flow:
   - `/`
   - `/login`
   - `/offline`
   - dashboard
   - create offline record
   - reconnect and sync
   - queue badge clears
9. Make queue state human-readable:
   - records
   - files
10. Do not let maintenance cleanup delete all PWA caches.

## Architecture Notes

- Frontend: Next.js 16 with `next-pwa`, Dexie, Redux Toolkit, offline queue, and route warming.
- Backend: Laravel 12 with Sanctum personal access tokens, Spatie permissions, database queue, and scheduled CRM reminders.
- Auth mode: Sanctum is being used here as bearer-token authentication, not cookie-based SPA session auth.

## Required Environment Variables

### Frontend (`mis-front/.env`)

Use [mis-front/.env.example](/d:/mis-system/mis-front/.env.example:1) as the template.

- `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_ENABLE_SW=true`
- `APP_BUILD_ID=release-2026-04-22` optional but recommended for controlled cache busting

### Backend (`mis-backend/.env`)

Start from [mis-backend/.env.example](/d:/mis-system/mis-backend/.env.example:1) and set:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://api.your-domain.com`
- `APP_FRONTEND_URL=https://app.your-domain.com`
- `APP_FRONTEND_URLS=https://app.your-domain.com,https://www.app.your-domain.com` when you need more than one origin
- real database credentials
- real mail/CRM provider credentials if SMS/email reminders are required

## Backend Server Checklist

Run these on the server inside `mis-backend`:

1. `composer install --no-dev --optimize-autoloader`
2. `php artisan key:generate` if the app key is not already set
3. `php artisan migrate --force`
4. `php artisan storage:link`
5. `php artisan config:cache`
6. `php artisan route:cache`
7. `php artisan view:cache`

Keep these long-running services enabled:

- Queue worker: `php artisan queue:work --tries=3 --timeout=120`
- Scheduler cron: `* * * * * php /path/to/artisan schedule:run >> /dev/null 2>&1`

Server settings you should update:

- Enable HTTPS. PWA install and service workers should be served over HTTPS in production.
- Set web server upload size above the 20 MB document limit in the app. For Nginx, use at least `client_max_body_size 25M`.
- Point the public web root to `mis-backend/public`.
- Make sure `/storage` is reachable after `storage:link`.

## Frontend Deployment Checklist

Run these inside `mis-front`:

1. `npm install`
2. `npm run build`
3. `npm run start`

The frontend is configured with `output: "standalone"`, so you can deploy it to a Node server or container more easily.

PWA notes:

- The service worker is production-enabled by default.
- Offline route caches are versioned by build now, so deploys replace stale offline shells.
- API GET caching now follows your configured `NEXT_PUBLIC_API_BASE_URL`.
- Backend `/storage` assets are cached after first load, which helps document/image previews survive short outages.

## GitHub To Production Runbook

This is the safest deployment path based on your current environment:

- Backend: deploy to your cPanel hosting
- Frontend: deploy to a Node-friendly host unless your cPanel provider enables Passenger / Node app support

### Recommended Architecture

- `api.your-domain.com` -> Laravel backend on cPanel
- `your-domain.com` or `app.your-domain.com` -> Next.js frontend on a Node-capable platform

### Step 1: Prepare GitHub

Make sure your GitHub repository contains:

- the `mis-backend` folder
- the `mis-front` folder
- the latest deployment changes in this guide

Push your latest branch to GitHub before starting deployment.

### Step 2: Create Production Domains

In your hosting panel:

- create or confirm `api.your-domain.com` for Laravel
- if needed, create `app.your-domain.com` for the frontend
- make sure SSL is active for both domains

### Step 3: Create Production Database

In cPanel MySQL tools:

- create one production database
- create one production database user
- assign the user to the database with full privileges
- save the database name, username, password, and host

### Step 4: Connect The Server To GitHub

Choose one of these:

- cPanel `Git Version Control` clone from GitHub
- or SSH into the server and run `git clone`

Example over SSH:

```bash
cd /home/yaftom
git clone https://github.com/YOUR-USER/YOUR-REPO.git mis-system
cd mis-system
```

If the repo is private, use a GitHub personal access token or SSH deploy key.

### Step 5: Deploy The Laravel Backend

Go into the backend folder:

```bash
cd /home/yaftom/mis-system/mis-backend
```

Copy env file and fill production values:

```bash
cp .env.example .env
```

Set at least:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://api.your-domain.com`
- `APP_FRONTEND_URL=https://app.your-domain.com`
- `APP_FRONTEND_URLS=https://app.your-domain.com,https://your-domain.com`
- real DB credentials
- mail credentials if reminders are needed

Install dependencies and optimize:

```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Important for CORS / frontend-origin changes:

- If you change `APP_FRONTEND_URL` or `APP_FRONTEND_URLS`, rerun `php artisan optimize:clear` before `php artisan config:cache`.
- Otherwise Laravel can keep serving stale cached origin settings such as `localhost`, even when your `.env` file is correct.

Point the backend domain document root to:

- `/home/yaftom/mis-system/mis-backend/public`

If your host keeps subdomain document roots inside `public_html`, use this shared-host layout instead:

- keep the Laravel source in `/home/yaftom/mis-system/mis-backend`
- keep `api.your-domain.com` document root as `/home/yaftom/public_html/api.your-domain.com`
- copy the contents of `mis-backend/public` into `/home/yaftom/public_html/api.your-domain.com`
- replace the public `index.php` so it points back to the real Laravel app in `/home/yaftom/mis-system/mis-backend`

Example shared-host API public-folder setup:

```bash
mkdir -p /home/yaftom/public_html/api.yaftom.com
cp -a /home/yaftom/mis-system/mis-backend/public/. /home/yaftom/public_html/api.yaftom.com/
```

Then replace `/home/yaftom/public_html/api.yaftom.com/index.php` with:

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = '/home/yaftom/mis-system/mis-backend/storage/framework/maintenance.php')) {
    require $maintenance;
}

require '/home/yaftom/mis-system/mis-backend/vendor/autoload.php';

/** @var Application $app */
$app = require_once '/home/yaftom/mis-system/mis-backend/bootstrap/app.php';

$app->handleRequest(Request::capture());
```

In this shared-host layout, create the storage symlink inside the actual public API directory:

```bash
rm -f /home/yaftom/public_html/api.yaftom.com/storage
ln -s /home/yaftom/mis-system/mis-backend/storage/app/public /home/yaftom/public_html/api.yaftom.com/storage
```

### Step 6: Add Cron For Laravel Scheduler

In cPanel Cron Jobs, add:

```bash
* * * * * cd /home/yaftom/mis-system/mis-backend && php artisan schedule:run >> /dev/null 2>&1
```

### Step 7: Handle Laravel Queue Work

This project uses the database queue driver by default.

Best option:

- run a persistent worker if your host supports long-running processes

Command:

```bash
cd /home/yaftom/mis-system/mis-backend
php artisan queue:work --tries=3 --timeout=120
```

If your host does not allow a persistent worker, use a cron fallback for low-volume jobs:

```bash
* * * * * cd /home/yaftom/mis-system/mis-backend && php artisan queue:work --stop-when-empty --tries=3 --timeout=120 >> /dev/null 2>&1
```

This is less ideal than a real worker, but it is often the practical shared-hosting fallback.

### Step 8: Deploy The Frontend

#### Option A: Your Host Enables Node App Support

If the host gives you Passenger / Application Manager and Node support:

```bash
cd /home/yaftom/mis-system/mis-front
cp .env.example .env
```

Set:

- `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_ENABLE_SW=true`
- `APP_BUILD_ID=release-YYYY-MM-DD`

Install and build:

```bash
npm install
npm run build
```

This project now includes [mis-front/app.js](/d:/mis-system/mis-front/app.js:1) so Passenger can start the frontend from the repo root.

Register the frontend in cPanel `Application Manager` with values like:

- `Application Name`: `mis-front`
- `Deployment Domain`: `app.your-domain.com`
- `Application Path`: `mis-system/mis-front`
- `Deployment Environment`: `Production`

Important cPanel runtime check:

- After registration, verify which Node binary Passenger pinned for the app:

```bash
uapi --output=jsonpretty PassengerApps list_applications
```

- For Next.js 16, the frontend app should resolve to Node `20.9+` or newer. On EasyApache systems, a healthy result looks like:
  - `"nodejs": "/opt/cpanel/ea-nodejs22/bin/node"`
- If an older app registration still shows something like:
  - `"nodejs": "/usr/bin/node"`
  and that binary is an older server Node such as `v16`, Passenger can fail with startup errors like `ReferenceError: Request is not defined`.
- In that case, the cleanest fix is usually to unregister and re-register the Passenger app after the correct EasyApache Node version is installed, so cPanel regenerates the app with the newer Node runtime.

Important cPanel static-asset note:

- On some cPanel Passenger setups, the app route (`/`) is handled by Passenger, but file-like requests such as `/_next/static/*`, `favicon.ico`, `icon.png`, `sw.js`, and `manifest.json` are served from the subdomain document root instead.
- If the subdomain document root is empty, the page HTML may load while the CSS/JS/icon requests return `500`.
- In that case, expose the built frontend assets through the document root with symlinks like:

```bash
DOCROOT=/home/yaftom/public_html/app.yaftom.com
APP=/home/yaftom/mis-system/mis-front

mkdir -p "$DOCROOT/_next"
ln -sfn "$APP/.next/static" "$DOCROOT/_next/static"

for item in "$APP"/public/*; do
  ln -sfn "$item" "$DOCROOT/$(basename "$item")"
done

ln -sfn "$APP/app/favicon.ico" "$DOCROOT/favicon.ico"
ln -sfn "$APP/app/icon.png" "$DOCROOT/icon.png"
ln -sfn "$APP/app/apple-icon.png" "$DOCROOT/apple-icon.png"
```

- This keeps Passenger serving app routes while Apache / NGINX can serve the built static assets directly.

Important cPanel HTTPS route note:

- If `https://app.your-domain.com/` loads but extensionless routes such as `/login`, `/offline`, or `/customer-portal` return Apache's generic `500 Internal Server Error`, validate the app outside Passenger before changing frontend code.
- From SSH, run the built app directly:

```bash
cd /home/yaftom/mis-system/mis-front
PORT=3307 HOST=127.0.0.1 NODE_ENV=production /opt/cpanel/ea-nodejs22/bin/node app.js
```

- Then, from another terminal:

```bash
curl -i http://127.0.0.1:3307/login
curl -i http://127.0.0.1:3307/offline
```

- If those direct local requests return `200 OK` while the public HTTPS URLs still return Apache's generic 500 page, the Next.js app itself is healthy and the remaining problem is cPanel / Apache / Passenger HTTPS routing.
- cPanel documents a known addon-domain / subdomain case where the Passenger app is registered, but the SSL include file is not created correctly when the application path differs from the domain document root.
- This project uses that exact pattern:
  - app source path: `/home/yaftom/mis-system/mis-front`
  - subdomain document root: `/home/yaftom/public_html/app.yaftom.com`
- In that case, ask the server administrator or hosting provider to copy the generated Passenger Apache include from the `std` path to the `ssl` path for the subdomain, then rebuild Apache configuration and restart Apache.
- Official cPanel reference: https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/

Important:

- Build the frontend **after** the `.env` file is correct.
- `NEXT_PUBLIC_*` values are compiled into the frontend build, so changing them later requires a rebuild.
- After changing code or rebuilding, restart the Passenger app with:

```bash
cd /home/yaftom/mis-system/mis-front
mkdir -p tmp
touch tmp/restart.txt
```

#### Option B: Your Host Does Not Support Node Apps

This is the current likely case for your account.

Use one of these:

- deploy the frontend to a Node-friendly provider
- or refactor the frontend to static export before hosting it on cPanel

Do **not** assume that installing Node in cPanel terminal alone is enough to host the current frontend publicly.

### Step 9: Update Frontend Domain DNS

Point:

- `api.your-domain.com` to your cPanel backend host
- frontend domain to your chosen frontend host

If both frontend and backend are on the same server, make sure backend and frontend use separate domains or subdomains.

### Step 10: Verify Production

Test in this order:

1. Open `https://api.your-domain.com/up`
2. Open the frontend and log in
3. Confirm `/api/auth/me` works
4. Open a few core pages
5. Install the PWA
6. Go offline and confirm cached pages still open
7. Create an offline-capable record, reconnect, and confirm it syncs
8. Upload and preview a file, then check it after reconnect
9. Confirm scheduled reminders and queue jobs run correctly

### Step 11: Future GitHub Updates

When you push new code to GitHub:

```bash
cd /home/yaftom/mis-system
git pull origin main
```

Then redeploy changed parts:

Backend:

```bash
cd /home/yaftom/mis-system/mis-backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Frontend:

```bash
cd /home/yaftom/mis-system/mis-front
npm install
npm run build
```

If the frontend is running under Passenger or another Node manager, restart it after the build.

### cPanel GitHub Flow

If you want to deploy directly from GitHub inside cPanel:

1. Open `Git Version Control` in cPanel.
2. Clone your GitHub repository into `/home/yaftom/mis-system`.
3. Set backend domain document root to `/home/yaftom/mis-system/mis-backend/public`.
4. Register the frontend from `/home/yaftom/mis-system/mis-front` in `Application Manager`.
5. Use terminal to install dependencies, build, migrate, and cache.
6. After future GitHub pulls, rerun backend/frontend build steps and touch `tmp/restart.txt` for the frontend Passenger app.

### Single-Repo cPanel Setup For `app.yaftom.com` And `api.yaftom.com`

Because your GitHub repository contains both `mis-front` and `mis-backend`, the cleanest setup is:

- clone the repository once into `/home/yaftom/mis-system`
- point `api.yaftom.com` to `/home/yaftom/mis-system/mis-backend/public`
- register `app.yaftom.com` in `Application Manager` from `/home/yaftom/mis-system/mis-front`

Important:

- In this setup, you usually do **not** need `.cpanel.yml`.
- `Git Version Control` is used to clone and update the repository from GitHub.
- The backend and frontend run directly from subdirectories inside that checked-out repository.

Recommended update flow:

1. Push code to GitHub.
2. In cPanel `Git Version Control`, open the repository and click `Update from Remote`.
3. In Terminal, run backend/frontend post-pull commands.
4. Restart the frontend Passenger app with `touch tmp/restart.txt`.

## Static Export Feasibility

Current verdict:

- The frontend is **not ready for static export as-is**.
- The main blocker is route structure, not heavy server-only Next.js usage.
- A static-export deployment is still **possible with refactoring** if you want to remove the Node.js runtime requirement.

Why it fails today:

- Next.js static export does not support dynamic routes without `generateStaticParams()`.
- This app contains many runtime dynamic segments that depend on unknown IDs or tokens at browser time, for example:
  - `/customers/[uuid]`
  - `/customers/[uuid]/activity`
  - `/employees/[uuid]`
  - `/apartment-sales/[uuid]/financial`
  - `/apartment-sales/[uuid]/history`
  - `/print/.../[uuid]/...`
  - `/q/[token]`
- These URLs are loaded client-side with `useParams()` and local/API data, which is good for an offline-first app, but the static exporter still cannot pre-generate arbitrary path files.

Good news:

- No frontend route handlers were found.
- No `cookies()`, `headers()`, `NextRequest`, `NextResponse`, or server actions were found in the app code.
- No `next/image` usage was found, so default image-optimization is not currently a blocker.
- Most pages are already client-driven and load data after hydration, which makes a future static-only conversion realistic.

What would need to change:

- Convert arbitrary dynamic routes to static routes that read values from query strings, hash fragments, or local state.
- Keep only finite dynamic routes where build-time values are known, and add `generateStaticParams()` for those.
- Change `next.config.ts` from `output: "standalone"` to `output: "export"` only after those route changes are complete.

Recommended route conversion targets:

- Keep `/reports/[slug]` and `/print/reports/[slug]` only if you add `generateStaticParams()` from the known report keys.
- Replace `/q/[token]` with a static page such as `/q` or `/qr-access` and read `?token=...`.
- Replace print routes like `/print/rentals/[uuid]/bill/[paymentUuid]` with static print shells that read query params.
- Replace profile/detail pages like `/employees/[uuid]` with static shells such as `/employees/profile?uuid=...`.
- Remove redirect-only routes like `/customers/[uuid]` because `/customers/detail#uuid` already exists.

Practical recommendation:

- If you need the fastest deployment path, keep the current Next.js Node deployment.
- If your hosting cannot support Node.js, the frontend can be converted to static hosting, but it should be treated as a focused refactor rather than a config-only change.

## Auth and Offline Notes

- Online login stores a Sanctum bearer token in browser storage.
- The current live backend `AuthController` still deletes all user tokens on login and logout.
- If you want true per-device token isolation for the next launch, update backend login/logout so they only revoke the current device token and send a stable device name from the frontend.
- Offline login still depends on previously saved browser credentials and cached data.
- If the user clears browser storage, offline access is lost until the next online login.
- If a token is revoked on logout, offline access can still work locally, but the user will need to sign in again once internet returns.

## Production Validation Steps

After deployment, test these in order:

1. Log in online and confirm `/api/auth/me` works.
2. Open core pages you need offline and use the app’s cache status panel to verify they are cached.
3. Create one offline-capable record while disconnected, reconnect, and confirm it syncs through `/api/sync/push`.
4. Upload and open at least one document, then disconnect and confirm the preview still opens if it was loaded before.
5. If you implement per-device token isolation, log out from one browser and confirm another logged-in browser stays active.
6. Confirm scheduled jobs run by checking CRM reminders and queue activity.

## Server Updates You Still Need To Provide

These are operational items, not code items:

- Real production domains for frontend and backend
- HTTPS certificates
- Database, queue, and mail credentials
- Process manager for Laravel queue worker and Next.js server
- Cron entry for Laravel scheduler
- Optional biometric bridge service if you want device sync

## cPanel / Shared Hosting Readiness

Based on this project's actual requirements:

- The backend can run on standard cPanel hosting if PHP 8.2+ and the required Laravel extensions are available.
- The frontend cannot be treated like a plain static site in its current deployment shape. It is configured as a Next.js 16 Node application with `output: "standalone"` and should run behind a Node-capable host.
- PWA support does not need special server software beyond HTTPS and correct static file delivery, but the service worker should not be cached too aggressively.

Ask the hosting provider to confirm these are available before deployment:

- PHP 8.2 or newer
- Laravel-required PHP extensions: `ctype`, `curl`, `dom`, `fileinfo`, `filter`, `hash`, `mbstring`, `openssl`, `pcre`, `pdo`, `session`, `tokenizer`, `xml`
- Composer 2
- SSH / Terminal access
- Git access or Git deployment support
- Cron Jobs
- Symlink support for `php artisan storage:link`
- Node.js 20 or newer for the frontend. Next.js 16 requires Node 20.9+.
- cPanel Application Manager / Passenger support for Node.js apps
- `ea-apache24-mod-passenger` and `ea-apache24-mod_env` if the host uses EasyApache / Passenger for Node apps

Important:

- `ext-fileinfo` is mandatory for this Laravel app and for `composer install`.
- If Composer reports `league/flysystem-local` or `league/mime-type-detection` requiring `ext-fileinfo`, stop and ask the host to enable PHP `fileinfo` for the account's active PHP version.
- On EasyApache systems, the server administrator typically installs the matching package such as `ea-php82-php-fileinfo`.

Strong recommendation:

- If the host cannot provide a persistent Node.js application environment for the frontend, deploy only the Laravel backend on this cPanel server and move the Next.js frontend to a Node-friendly platform or a VPS.

Notes for this specific project:

- Redis is optional right now. The backend defaults to database-backed queue, cache, and session storage.
- A persistent Laravel queue worker is still needed because the app uses the database queue driver.
- The Laravel scheduler must run every minute because the app registers scheduled CRM reminder commands.
- Biometric sync should be treated as a separate bridge/worker service. Shared hosting is often not a good fit for that part.

Recommended domain layout:

- `api.your-domain.com` -> Laravel backend
- `your-domain.com` or `app.your-domain.com` -> Next.js frontend

NGINX / caching caution:

- Keep caching enabled for static assets.
- Exclude or reduce caching for `/api/*`, auth responses, and the PWA service worker files so deploys and login state do not get stuck behind stale cache.

## cPanel Terminal Install Checklist

Use this section when you only have cPanel Terminal / SSH access and want to know what you can install yourself.

### You Can Usually Install Yourself

- `nvm` to manage a user-space Node.js version in your home directory
- Node.js `22` or `20` through `nvm`
- project `npm` dependencies inside the frontend folder
- a user-space `composer.phar` if Composer is not already available globally

Recommended commands:

```bash
mkdir -p ~/.local/bin
mkdir -p ~/.nvm
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22
nvm use 22
node -v
npm -v
```

If Composer is missing:

```bash
cd ~
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php --install-dir="$HOME/.local/bin" --filename=composer
php -r "unlink('composer-setup.php');"
export PATH="$HOME/.local/bin:$PATH"
composer --version
```

If the installer fails with `allow_url_fopen` errors, use one of these fallbacks.

Temporary override for the installer:

```bash
mkdir -p "$HOME/.local/bin"
cd "$HOME"
wget -O composer-setup.php https://getcomposer.org/installer
php -d allow_url_fopen=On composer-setup.php --install-dir="$HOME/.local/bin" --filename=composer
rm -f composer-setup.php
export PATH="$HOME/.local/bin:$PATH"
composer --version
```

If that still fails, install Composer manually with a wrapper script:

```bash
mkdir -p "$HOME/.local/bin"
cd "$HOME"
wget -O "$HOME/.local/bin/composer.phar" https://getcomposer.org/download/latest-stable/composer.phar
cat > "$HOME/.local/bin/composer" <<'EOF'
#!/bin/sh
php "$HOME/.local/bin/composer.phar" "$@"
EOF
chmod +x "$HOME/.local/bin/composer"
export PATH="$HOME/.local/bin:$PATH"
composer --version
```

### You Usually Cannot Install Yourself On Shared Hosting

These normally require the hosting provider, reseller root, or server administrator:

- Passenger / cPanel Application Manager runtime support
- `ea-apache24-mod-passenger` or `ea-ruby27-mod_passenger`
- `ea-apache24-mod_env`
- system-wide `ea-nodejs20` or `ea-nodejs22`
- Apache / Nginx server modules
- PHP extensions
- Supervisor / systemd services
- MySQL / MariaDB server packages

### What This Project Actually Needs

Backend:

- PHP `8.2+`
- Composer `2`
- Laravel-required PHP extensions
- MySQL or MariaDB
- Cron jobs
- symlink support for `php artisan storage:link`

Frontend:

- Node.js `20.9+` minimum. Prefer Node `22`.
- `npm`
- a real Node app runtime if you keep the current `standalone` deployment mode

Operational services:

- Laravel scheduler cron every minute
- Laravel queue worker or equivalent process runner
- HTTPS for frontend and backend

### Important Limitation

Installing Node.js yourself with `nvm` is useful for:

- running `npm install`
- building the frontend
- local testing over SSH

It does **not** automatically make the server capable of hosting the current Next.js frontend publicly. Without Passenger, Application Manager, or another server-managed Node process setup, a manual Node install alone is not a production deployment solution for this frontend.

### Recommended Direction For This Hosting

- Install `nvm` and Node `22` for build tooling and diagnostics.
- Use the cPanel server for the Laravel backend.
- Only keep the frontend on this server if the host enables Passenger / Node app support.
- Otherwise, either:
  - move the frontend to a Node-friendly platform, or
  - refactor the frontend for static export and host the static output here.

## Biometric Attendance Note

The biometric module is not fully server-complete by configuration alone. Based on [BiometricAttendanceService.php](/d:/mis-system/mis-backend/app/Services/BiometricAttendanceService.php:105):

- `bridge-api` mode needs a separate bridge service with `/health` and `/sync` endpoints.
- `zkteco-pull` mode still needs a server-side bridge or SDK worker.
- `csv-import` mode needs an import or bridge process to post normalized punches to `/api/attendance/bridge/punches`.

Also make sure the pending biometric employee migration is applied:

- [2026_04_21_090000_add_biometric_user_id_to_employees_table.php](/d:/mis-system/mis-backend/database/migrations/2026_04_21_090000_add_biometric_user_id_to_employees_table.php:1)
