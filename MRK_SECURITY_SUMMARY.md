# MRK Hotels Security Fix - Simple Summary

**Date:** 8 October 2026  
**Done By:** Victor Zacharia

## What Was Fixed

The old system let anyone try the 4-digit PIN over and over (up to 10,000 guesses). That was too easy to break into. We fixed this.

### Key Changes

1. **Property Code** - Each hotel now has a unique property code. Staff must use the correct code along with their email and password. This stops confusion when the same email is used at different hotels.

2. **Trusted Device** - Before using a PIN on a new computer, tablet or till, the system sends a one-time code to the staff member's email (and SMS if available). They enter that code and choose how long to trust it - 1, 3 or 6 months. After that, the device is trusted for PIN login.

3. **PIN is now safe** - The 4-digit PIN only works on devices that were verified. You cannot just try PINs from any browser or phone anymore.

4. **Auto-lock after 5 wrong tries** - If someone enters the wrong PIN 5 times in a row, that device gets locked for PIN login. To unlock it, just log in with email + password + property code again. No new verification code is needed.

5. **Locks clear automatically** - If the device is already trusted and you log in with email+password, any PIN lock on that device is removed straight away.

## How It Works Now

**First time on a new device:**
1. Enter email + password + property code
2. Get a one-time code by email/SMS
3. Enter code and pick trust length (1/3/6 months) → now logged in and device trusted
4. Next time on same device: use 4-digit PIN

**If PIN is locked (5 wrong tries):**
1. Log in with email + password + property code on that same device
2. PIN unlocks and you can use it again

**If using PIN on an already trusted device:** works as normal

## Also Built

6. **Resend code button** - On the code-entry screen there is now a "Resend code" button (with a 60-second cool-down). If the code expires or never arrives, staff can request a fresh one without starting over.

7. **Trusted devices screen for hotel admins** - Hotel managers and administrators now have a "Trusted Devices" page (Administration menu) showing every computer/terminal allowed to use a PIN: when it was trusted, when it was last used and its status (Trusted / Expired / Locked). Any device can be revoked with one click — that device must then sign in with email + password + property code again.

## What Was Not Done (For Now)

- Superadmin login unchanged (stays as is)
- SMS delivery depends on your SMS provider settings (works if SMS is configured)

## Technical Result

- All existing system tests still pass (no breakages): backend 1086, frontend 604
- New security tests confirm the PIN can no longer be brute-forced, and cover device management + code resend
- Both backend and frontend updated and live-ready
