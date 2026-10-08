# MRK SECURITY REVIEW - Implementation Summary

## What was fixed (Backend + Frontend)

### Backend (`mrk-hotels-api` - commit 040c37a)
- Created `auth_trusted_devices` table (migration `2026_10_08_000001_create_auth_trusted_devices_table.php`):
  - UUID PK, `tenant_id`, SHA-256 hash of device key (`device_key_hash`, unique), label, `trusted_until`, `failed_attempts`, `pin_locked_at`, `last_seen_at`, `created_by`, timestamps
  - Trust scoped per property (tenant) so a shared terminal serves all staff at that hotel
  - Stores only hashed device keys (no raw keys persisted)
- Added `App\Models\Auth\TrustedDevice`:
  - `newDeviceKey()` (64-char random), `hashKey()` (sha256 of `mrk-device:{key}`)
  - `findByRawKey()` queries without global scopes (pre-auth lookup)
  - `grantTrust($createdBy, $months)` sets expiry (1/3/6 months), resets attempts/lock
  - `clearPinLock()` clears failed attempts + lock on password login
  - `isExpired()`, `isPinLocked()`, `attemptsRemaining()`, `MAX_FAILED_ATTEMPTS = 5`
- Added `App\Notifications\DeviceTrustCodeNotification` (6-digit OTP, 10 min expiry)
- Updated `App\Http\Controllers\Api\V1\Auth\AuthController`:
  - `login()` accepts `property_code`, `trust_device`, `device_key`
    - Property code filters matches to the matching tenant (disambiguates shared email)
    - If `device_key` is valid, unexpired, and matches user's tenant → sign in directly and **clear PIN lock** (no new OTP)
    - If `trust_device` true → dispatch OTP, return `requires_device_verification`, `challenge`, masked `email` (no token)
    - Otherwise issues token as before (non-2FA login still works if device already trusted or per existing paths)
  - Added `verifyDeviceTrust()` (`POST /api/v1/auth/login/verify-device`): validates challenge+code (max 5 attempts), creates trusted device, grants trust for chosen 1/3/6 months, returns `token`, `device_key` (raw, returned once), `trusted_until`
  - `loginPin()` now requires `device_key`; validates device is trusted + unexpired + not locked
    - PIN lookup scoped to device's `tenant_id` (cannot cross properties). Prefers indexed `login_pin_digest`; falls back to bcrypt for legacy PINs (accepts only unambiguous legacy match)
    - Wrong PIN increments `failed_attempts`, locks at 5 → returns `423 pin_locked`; reports `attempts_remaining`
    - On success clears lock and issues token
- Routes: added `POST /api/v1/auth/login/verify-device` (throttled)
- Updated `StaffPinLoginTest` to use trusted devices; renamed/replaced ambiguous-cross-tenant PIN test to assert device-scoped resolution
- Added `TrustedDeviceSecurityTest` with 11 tests covering OTP flow, expiry, lockout, property code resolution, lock clearing on password login

### Frontend (`mrk-hotels-frontend` - commit a5905c7)
- `src/pages/auth/LoginPage.vue`:
  - Added `property_code` field to password form
  - Two-step device verification UI: enter 6-digit code + choose trust duration (1/3/6 months)
  - PIN mode now requires trusted device context; handles `device_untrusted` (switch to password), `pin_locked` (switch to password + message), `attempts_remaining`
  - Sends `device_key` from `sessionStorage` with PIN login
- `src/api/index.js`: added `authApi.verifyDevice(data)`
- `src/stores/auth.js`:
  - `login()`/`verifyDevice()` clear owner-viewing keys; `verifyDevice()` stores `trusted_device_key`, `trusted_device_until` in sessionStorage
  - `loginPin()` auto-attaches `device_key` if present
  - Clear trusted device keys on logout and on 401/403

## Tests
- Backend: `1080 passed` (includes 11 new TrustedDeviceSecurityTest + 20 StaffPinLoginTest, all passing)
- Frontend: `598/598 passed`, `npm run lint` clean, `npm run build` clean

## What is NOT built (left out / future work)
- **Trusted device management UI**: No admin UI to list/revoke trusted devices per property (audit trail exists via `created_by`, timestamps; revocation would require a new endpoint + UI)
- **Device labeling/metadata**: `label` stored but not collected/editable from frontend beyond user agent default
- **Retry/resend OTP**: No "resend code" button in the verification step (challenge expires after 10 min; user must restart login)
- **Superadmin bypass semantics**: Superadmin cannot "trust a device" via the 2FA flow (code path skips trust_device for superadmin) — superadmin login behavior unchanged by this hardening
- **Rate limiting granularity**: Device trust challenge uses cache with 5 wrong codes → burn; PIN lock is per-device (5 attempts). Consider adding per-challenge resend limits/email rate limits in prod
- **Identifier binding for PIN**: PIN login still accepts optional `identifier` (email/reg number) but lookup is scoped to device's tenant; identifier is not required with device key (bare PIN works if unique in tenant). This matches existing behavior while fixing cross-tenant leak
- **Email delivery failure handling**: On OTP send, exceptions are caught and reported but not surfaced to UI as a retryable action (user sees generic "enter code" flow only if challenge exists). If mail is down, verification cannot proceed

## SMS Support Added (Backend)
- Created `app/Notifications/Channels/SmsChannel.php` to bridge Laravel notifications to `SmsService` (stores messages via GuestMessage, dispatched by configured SMS driver)
- Updated `DeviceTrustCodeNotification`:
  - Chooses channels from `config('security.device_trust_via')` = `mail|sms|both` (env `DEVICE_TRUST_VIA`, defaults to `both`)
  - Sends SMS if phone exists and channel allows; includes OTP and expiry
- Added `device_trust_via` to `config/security.php`
- All existing tests still pass (1080 passed)
