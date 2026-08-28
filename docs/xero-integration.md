# Xero Accounting Integration — Developer Guide

Connects each MRK hotel (tenant) to Xero so its invoices, payments and chart of
accounts can be pulled into the system. The integration is **per-hotel**: every
tenant stores its own OAuth 2.0 access + refresh tokens in `xero_settings`,
scoped by `tenant_id`.

This guide walks through setting it up for local development first, then moving
to production (the "put in the production URL" step).

---

## 1. How the integration is used in the system

1. A **hotel admin/manager** opens the hotel panel → **Integrations → Xero**
   (`/app/integrations/xero`).
2. They click **Connect to Xero** → a popup opens at `login.xero.com` with the
   hotel's OAuth consent screen.
3. After authorization, Xero redirects the popup to the API callback
   (`GET {API_BASE}/api/xero/callback`), which exchanges the code for tokens,
   stores them per tenant, and `postMessage`s `{ type: 'xero:oauth', success, organisation }`
   back to the opener. The popup auto-closes and the page flips to **Connected**.
4. Staff can then **Test Connection**, enable sync toggles, and manually sync
   **Invoices**, **Payments** and the **Chart of Accounts** for a date range.
5. Every call to Xero is written to a per-tenant **sync log**
   (`xero_sync_logs`) and surfaced in the page's Sync Logs table.
6. **Enabled sync toggles run automatically** every 30 minutes via the
   `integrations:xero-sync` scheduled command. The first failure of a streak
   raises an in-app + email alert to the hotel's admin; repeated failures on
   consecutive cycles are not re-sent.
7. **Superadmins** see connection health across all hotels on the
   Integration Dashboard (`/v1/integrations/dashboard`).

> Xero issues short-lived access tokens (~30 min); the API auto-refreshes them
> with the stored refresh token (`offline_access`). Refresh tokens rotate on
> every use — the new one is persisted in the same request. OAuth tokens are
> **encrypted at rest** with the app key (`app/Casts/Encrypted.php`) and never
> appear in API responses.

---

## 2. What makes this work (and the trap most people hit)

Since **2 March 2026** Xero split the old broad scopes into **granular scopes**.
Apps created **on/after that date can ONLY use granular scopes** — requesting
`accounting.transactions` returns `invalid_scope` at the consent screen.

The MRK integration requests only granular scopes:

```
offline_access accounting.invoices accounting.payments accounting.contacts accounting.settings accounting.reports.aged.read accounting.reports.profitandloss.read accounting.reports.trialbalance.read
```

Read endpoints on the Xero API for the scopes granted in this flow:

| Endpoint (Xero) | Scope it needs |
|---|---|
| `GET /Organisation` | `accounting.settings` |
| `GET /Accounts` (chart of accounts) | `accounting.settings` |
| `GET /Invoices` | `accounting.invoices` |
| `GET /Payments` | `accounting.payments` |
| `GET /Reports/AgedReceivablesByContact` | `accounting.reports.aged.read` |
| `GET /Reports/ProfitAndLoss` | `accounting.reports.profitandloss.read` |
| `GET /Reports/TrialBalance` | `accounting.reports.trialbalance.read` |

If one of these returns HTTP 401 with header `WWW-Authenticate: insufficient_scope`,
the connection no longer has that scope (user re-consent required).

---

## 3. Configuration — STEP BY STEP (local dev first)

### 3.1 Create/get the Xero app (developer.xero.com)

1. Sign in at **developer.xero.com** → **My Apps** → **New app**.
2. App type: **Web app** (server-side auth-code flow).
3. Fill in the app name (e.g. `MRK Hotels`), company URL, privacy/terms URLs.
4. Note the **Client ID** and **Client secret** shown on the **Configuration** tab.

### 3.2 Add the Redirect URI (THE critical step)

On the Xero app's **Configuration** tab, in **Redirect URIs**, add **exactly**
the URL below — including the `/api` segment. It must match the app's base URL
character-for-character (no trailing slash, same scheme/host):

| Environment | Redirect URI |
|---|---|
| Local dev | `http://localhost:8000/api/xero/callback` |
| Production | `https://YOUR-API-DOMAIN.com/api/xero/callback` |

> Xero allows `http://localhost` for development. Production **must** be HTTPS.

### 3.3 Scopes (Configuration tab)

Where the **Scopes** section is present, tick (at minimum):

`app.connections`, `accounting.invoices`, `accounting.payments`,
`accounting.contacts`, `accounting.settings` (write variants).

If your app has no scopes checkboxes (older UI), that's fine — scopes are
carried in the authorize URL the API builds (3.4/3.5).

### 3.4 API `.env` — backend config

Edit `~/Documents/Projects/Apis/LaravelApis/mrk-hotels-api/.env`:

```
# Global kill-switch (pages show "not connected" when false)
XERO_ENABLED=true

# From the Xero app "Configuration" tab
XERO_CLIENT_ID=YOUR_CLIENT_ID
XERO_CLIENT_SECRET=YOUR_CLIENT_SECRET

# MUST equal a Redirect URI registered on the Xero app (3.2)
XERO_REDIRECT_URI=http://localhost:8000/api/xero/callback

# Granular scopes only (see section 2). Offline_access = refresh tokens.
XERO_SCOPES="offline_access accounting.invoices accounting.payments accounting.contacts accounting.settings accounting.reports.aged.read accounting.reports.profitandloss.read accounting.reports.trialbalance.read"

# Optional: webhook validation key (leave empty to disable webhook verification)
XERO_WEBHOOK_KEY=

# HTTP timeout for Xero API calls, seconds
XERO_TIMEOUT=30
```

Then clear the config cache and restart the server:

```bash
php artisan config:clear
# if using php artisan serve: stop it (Ctrl-C), then start again
php artisan serve --port=8000
```

> ⚠️ `.env` values are read at process boot. If you change `.env` you MUST
> `config:clear` and restart any running `php artisan serve`.

### 3.5 Frontend `.env`

`~/Documents/Projects/Frontends/VueFrontends/mrk-hotels-frontend/.env`

```
# Base URL of the API (no trailing slash, includes /api).
# Must be the SAME host that serves the Xero callback route.
VITE_API_URL=http://localhost:8000/api
```

### 3.6 Sanity-check before clicking Connect

```bash
# 1. The authorize URL the API builds must contain your redirect URI + scopes:
php artisan tinker --execute="echo app(\App\Services\Integration\XeroService::class)->getAuthorizationUrl('test');"

# 2. The callback route must answer (renders a page, not 404/redirect):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/xero/callback   # → 200
```

### 3.7 First connect (run this once after local dev is green)

1. Hotel panel → **Integrations → Xero** (roles: `hotel_admin`, `manager`).
2. Click **Connect to Xero** → complete Xero login + authorize (accept scopes).
3. Popup closes; page shows **Connected** + the organisation name.
4. **Test Connection** → green *"Connection to Xero is working."*
5. Pick a date range → **Sync Invoices**, **Sync Payments**, **Sync Chart of Accounts**.
6. Check the **Sync Logs** table at the bottom of the page (and the API DB in
   `xero_sync_logs`) — each row logs status, duration and the raw error on failure.

---

## 4. Going to PRODUCTION (Laravel Cloud)

The API and frontend both deploy to **Laravel Cloud** — no cron, no local
`.env` on the server. Comprehensive runbook: **`DEPLOY_CLOUD.md` in the API
repo** (copy-paste). The Xero-relevant highlights:

1. **Custom domain** for the API (`cloud domain:create/verify`; SSL auto).
   Use it, not the default `*.laravel.cloud` URL — Xero's redirect must be stable.
2. **API env vars** set per environment in the dashboard:
   - `XERO_REDIRECT_URI=https://<api-domain>/api/xero/callback` (literal)
   - full granular `XERO_SCOPES` + `XERO_CLIENT_ID/SECRET` + `XERO_ENABLED=true`
   - **`APP_KEY`** from `php artisan key:generate --show` — it now encrypts the
     stored Xero tokens; changing it later invalidates every connection
   - `CACHE_STORE=redis` (powers the refresh lock + `onOneServer()` scheduler)
3. **Build command:** `composer install --no-dev --optimize-autoloader && php artisan optimize`
4. **Deploy command:** `php artisan migrate --force` (runs the token-encryption migration)
5. **Scheduler:** enable the **Scheduler toggle** on the app compute cluster —
   Cloud runs `schedule:run` every minute, feeding `integrations:xero-sync`.
6. **Xero portal:** add `https://<api-domain>/api/xero/callback` as a Redirect
   URI, then request **Production** access; after approval, hotels
   disconnect/re-connect once for the new domain + scopes.
7. **Frontend SPA:** set `VITE_API_URL=https://<api-domain>/api`, build command
   `npm ci && npm run build`, own custom domain via `cloud domain:create`.

---

## 5. Files involved

**API** (`~/Documents/Projects/Apis/LaravelApis/mrk-hotels-api`):

| File | Purpose |
|---|---|
| `.env` / `.env.example` | `XERO_*` config block |
| `config/xero.php` | Reads env into service config (api host, oauth URLs, scopes) |
| `database/migrations/2026_08_27_000100_create_xero_settings_table.php` | Per-tenant settings + tokens |
| `database/migrations/2026_08_27_000200_create_xero_sync_logs_table.php` | Sync log ledger |
| `app/Models/Integration/XeroSetting.php` | Model + `isConfigured()` / `isTokenExpired()`; tokens encrypted at rest, never serialized |
| `app/Models/Integration/QuickBooksSetting.php` | Same encryption/visibility treatment for QuickBooks tokens |
| `app/Casts/Encrypted.php` | AES-256 encrypt/decrypt cast |
| `app/Models/Integration/XeroSyncLog.php` | Sync log model |
| `app/Services/Integration/XeroService.php` | OAuth URL, token exchange/refresh (per-tenant locked), connections, Invoices/Payments/Accounts/Reports, sync + logging |
| `app/Console/Commands/SyncXeroIntegrations.php` | `integrations:xero-sync` — scheduled auto-sync + failure alerts |
| `routes/console.php` | `Schedule::command('integrations:xero-sync')->everyThirtyMinutes()->withoutOverlapping()` |
| `app/Http/Controllers/Api/V1/Integration/XeroController.php` | API endpoints + `webCallback()` |
| `routes/api.php` | Routes under `integrations/xero` (all `level:80`) |
| `routes/web.php` | `GET api/xero/callback` → `webCallback` (`xero.callback`) |
| `database/migrations/2026_08_28_000300_encrypt_integration_oauth_tokens.php` | Encrypts legacy plaintext tokens on upgrade |
| `app/Http/Controllers/Api/V1/Superadmin/IntegrationDashboardController.php` | Per-tenant status for superadmins |

**Frontend** (`~/Documents/Projects/Frontends/VueFrontends/mrk-hotels-frontend`):

| File | Purpose |
|---|---|
| `.env` | `VITE_API_URL` |
| `src/api/index.js` | `xeroApi` wrapper (mirrors the endpoints below) |
| `src/pages/integrations/XeroPage.vue` | Connect popup + postMessage listener, test/sync/settings/logs UI |
| `src/router/index.js` | Route `/app/integrations/xero` |
| `src/config/modules.js` | Module entry `integrations/xero` (roles `hotel_admin`, `manager`) |
| `src/locales/en.json` / `sw.json` | `nav.xero` + `integrations.xero.*` strings |
| `src/pages/superadmin/IntegrationDashboardPage.vue` | Xero status column/card |
| `src/components/IntegrationStatusCell.vue` | Renders the per-hotel Xero status cell |

---

## 6. API endpoint reference

All routes require an authenticated user whose role has access to `level:80`
features (e.g. `hotel_admin`, `manager`); the route group is prefixed
`integrations/xero`:

| Method | URI | Controller method | Notes |
|---|---|---|---|
| `GET` | `/v1/integrations/xero/auth-url` | `getAuthUrl` | Returns `{ url }` for the OAuth popup |
| `POST` | `/v1/integrations/xero/callback` | `callback` | Code-exchange endpoint (used programmatically) |
| `GET` | `/v1/integrations/xero/settings` | `settings` | Returns `{ settings }` for the tenant |
| `PUT` | `/v1/integrations/xero/settings` | `updateSettings` | `sync_invoices`, `sync_payments`, `sync_chart_of_accounts`, `environment` |
| `POST` | `/v1/integrations/xero/test` | `testConnection` | Live `GET /Organisation`; returns `{ success, message }` |
| `GET` | `/v1/integrations/xero/accounts` | `getAccounts` | Chart of accounts from Xero |
| `GET` | `/v1/integrations/xero/reports/{report}` | `getReport` | Read-only report: `aged_receivables`, `profit_and_loss` or `trial_balance`; optional `from_date`/`to_date` (Y-m-d) → returns the Xero report document (`ReportTitles` + `Rows`) |
| `POST` | `/v1/integrations/xero/sync/invoices` | `syncInvoices` | Body: `{ start_date?, end_date? }` → `{ synced, errors }` |
| `POST` | `/v1/integrations/xero/sync/payments` | `syncPayments` | Body: `{ start_date?, end_date? }` → `{ synced, errors }` |
| `GET` | `/v1/integrations/xero/logs` | `getLogs` | Paginated `{ logs }`, filters `direction`, `status` |
| `DELETE` | `/v1/integrations/xero/disconnect` | `disconnect` | Clears tokens for the tenant |

Web (popup callback — **no auth**):

| Method | URI | Purpose |
|---|---|---|
| `GET` | `{API_BASE}/api/xero/callback` | `webCallback()` — exchanges code, stores tokens, `postMessage('xero:oauth')`, closes popup |

Superadmin (read-only):

| Method | URI | Purpose |
|---|---|---|
| `GET` | `/v1/integrations/dashboard` | `{ summary.xero, hotels[].integrations.xero }` across all tenants |

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Xero page: `invalid_request` / `Invalid redirect_uri` | Authorize URL redirect URI ≠ a registered Xero Redirect URI | Match `.env` XERO_REDIRECT_URI with the portal exactly (3.2); `config:clear` + restart |
| Xero page: `invalid_scope` / `Invalid scope` | Requesting a broad scope (`accounting.transactions`) on a post-Mar-2026 app | Use the granular scope set (2, 3.4) |
| Xero page: `unauthorized_client` | Wrong/reported Client ID or secret | Copy from the app's Configuration tab (3.1) |
| API call returns HTTP 401 `insufficient_scope` | Token lacks the granular scope for that endpoint | Re-connect via the app (consent again with the new scopes) |
| "Connection failed" on Test Connection but logs show `success` | Frontend response-handling glitch (fixed: now honours `data.success`) | Update frontend to latest build; check `last_error` on the row |
| `(intermediate value).success is not a function` | `toast.success/toast.error` doesn't exist; use `toast(...)` / `toastError(...)` | Already fixed in Xero + QuickBooks pages |
| Token refresh `invalid_grant` | Payment/refresh token rotated; two refreshes raced | The per-tenant cache lock in `refreshAccessToken()` prevents the race; a lone failure just means an out-of-spec retry |
| Refresh lock timeout `Unable to acquire lock` | More than 10s of concurrent refresh attempts on one hotel | Harmless single-cycle skip; contacts resolve |
| Production consent fails / asks demo org only | Xero app still in Development mode | Complete Xero app review → Production (4.5) |

---

## 8. Key decisions if you change anything later

- **Single group-wide Xero org (all hotels → one org):** NOT supported by design.
  Connection is per-tenant on purpose (`tenant_id` in `xero_settings`). Re-architecting
  to a group org means centralised tokens + cross-tenant aggregation.
- **Scopes are additive in Xero.** If you later need more (e.g. `accounting.attachments`),
  add the granular scope to `XERO_SCOPES`, tick it on the app, and have users
  re-authorise once.
- **Delivery mechanism is the scheduler**, not webhooks. `integrations:xero-sync`
  runs every 30 minutes for hotels with sync toggles on, alerts admins on the
  first failure of a streak (in-app + email), and honours a `--tenant=UUID`
  override. Webhooks (`XERO_WEBHOOK_KEY`) remain a future option if
  event-driven sync is wanted instead of polling.