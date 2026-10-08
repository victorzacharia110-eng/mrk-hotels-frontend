# MRK SECURITY REVIEW - Implementation Report

**Date:** 2026-10-08  
**Repos:** mrk-hotels-api (main), mrk-hotels-frontend (master)

## Executive Summary

Implemented the hardening requirements from the MRK SECURITY REVIEW:
- Property-code scoping for logins (prevents cross-tenant email collisions)
- Device trust with email+SMS OTP (1/3/6-month trust duration)
- PIN-only sign-in restricted to trusted devices with 5-attempt lockout
- Lockout cleared on successful password login (no new OTP required)
- Full test coverage maintained (1080 backend tests passing)

## What Was Fixed

### 1) Backend: Trusted Devices & Auth Flow

**New migration:** `database/migrations/2026_10_08_000001_create_auth_trusted_devices_table.php`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> tenants) — trust scoped to property
- `device_key_hash` (CHAR(64), SHA-256) — only hash stored; raw key never persisted
- `label` (nullable) — device label
- `trusted_until` (timestamp, nullable)
- `failed_attempts` (tinyint, unsigned, default 0)
- `pin_locked_at` (timestamp, nullable)
- `last_seen_at` (timestamp, nullable)
- `created_by` (UUID, nullable, FK -> users)
- Timestamps + indexes

**New model:** `app/Models/Auth/TrustedDevice.php`
- `newDeviceKey()` — generates 64-char random device key
- `hashKey($key)` — `sha256('mrk-device:'.$key)`
- `findByRawKey($key)` — lookup without global scopes (pre-auth)
- `grantTrust($createdBy, $months)` — set expiry (1/3/6), reset attempts/lock
- `clearPinLock()` — clear on password login
- `isExpired()`, `isPinLocked()`, `attemptsRemaining()`
- `MAX_FAILED_ATTEMPTS = 5`

**New notification:** `app/Notifications/DeviceTrustCodeNotification.php`
- Sends 6-digit OTP via mail and/or SMS (configurable)
- Expires in 10 minutes
- Includes hotel name in message

**SMS channel:** `app/Notifications/Channels/SmsChannel.php`
- Bridges Laravel notifications to `SmsService` (records via GuestMessage, dispatched by configured SMS driver)

**AuthController updates:** `app/Http/Controllers/Api/V1/Auth/AuthController.php`
- `login()`:
  - Accepts `email`, `password`, optional `property_code`, `trust_device`, `device_key`
  - Filters by `property_code` when provided (disambiguates shared emails)
  - If valid `device_key` matches unexpired trusted device for user's tenant → sign in, clear PIN lock, return token (no OTP)
  - If `trust_device` true → dispatch OTP, return `requires_device_verification`, `challenge`, masked `email` (no token)
  - Else normal login flow
- `verifyDeviceTrust()` (`POST /api/v1/auth/login/verify-device`):
  - Validates `challenge`, `code`, `trust_months` (1/3/6)
  - Max 5 wrong codes → challenge burned
  - Creates trusted device, grants trust, returns `token`, `device_key` (raw, once), `trusted_until`
- `loginPin()`:
  - Requires `device_key`
  - Validates device trusted, unexpired, not locked
  - PIN lookup scoped to device's `tenant_id` (no cross-tenant)
  - Prefers `login_pin_digest` (indexed); legacy bcrypt fallback (unambiguous only)
  - Wrong PIN → increment, lock at 5 → `423 pin_locked`; returns `attempts_remaining`
  - Success → clears lock, issues token

**Routes:** added `POST /api/v1/auth/login/verify-device` (throttled)

**Config:** `config/security.php` — `device_trust_via` (env `DEVICE_TRUST_VIA`, default `both`)

**Tests:**
- `TrustedDeviceSecurityTest` (11 tests) — OTP flow, expiry, lockout, property code resolution, lock clearing
- `StaffPinLoginTest` updated for trusted-device requirement; cross-tenant PIN test adjusted

**Result:** 1080 backend tests passed, 4936 assertions.

### 2) Frontend: Login UI & Store

**LoginPage.vue** (`src/pages/auth/LoginPage.vue`):
- Added `property_code` field to password form
- Two-step device verification UI: 6-digit code + trust duration (1/3/6 months)
- PIN mode handles: `device_untrusted` → switch to password; `pin_locked` → switch to password; `attempts_remaining` shown
- Sends `device_key` from sessionStorage with PIN login

**API & Store:**
- `src/api/index.js` — `authApi.verifyDevice(data)`
- `src/stores/auth.js` — `verifyDevice()` stores `trusted_device_key`, `trusted_device_until`; `loginPin()` auto-attaches `device_key`; keys cleared on logout/401/403

**Tests:** 598/598 passed; lint & build clean.

## What Was NOT Built

- **Trusted device management UI**: No admin interface to list/revoke trusted devices (audit trail exists via timestamps/created_by)
- **Device labeling in UI**: `label` stored but not editable/collected beyond user agent default
- **Resend OTP**: No "resend code" button (challenge expires in 10 min; user restarts login)
- **Superadmin bypass**: Superadmin login path skips device-trust 2FA (unchanged)
- **Resend/email rate limiting**: Challenge burn on 5 wrong codes exists; consider additional resend/IP limits in production
- **Identifier requirement**: Bare PIN still works when device fixes tenant (identifier optional) — preserves existing behavior while fixing cross-tenant leak
- **Email/SMS delivery failure UX**: If mail/SMS fails on send, user still sees verification UI only if challenge exists; no explicit retry path surfaced
