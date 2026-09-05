# MRK Hotels — Review Batch 02 · Housekeeping Sidebar (Problem & Solution)

**Module:** Housekeeping (Navigation) — **Status: Resolved** — **5 September 2026**

---

## 1. The Problem

The housekeeping role saw a **general-purpose sidebar** that surfaced modules mostly irrelevant to their work and buried the ones they actually use.

**What this meant in practice:**

- Housekeeping staff were shown Food & Beverage entries (Restaurant & Bar, Fun Games, etc.) they never use.
- Housekeeping-critical surfaces — the room-status accordions and the staff communication channel — were hidden inside generic groupings instead of being promoted.
- The layout was chosen by which modules are "active in the hotel," not by the logged-in role, so housekeepers had to hunt for what they need.

## 2. Root Cause

- `StoreLayout.vue` built `visibleModules` from the role's permissions, then dropped items into one of a few generic groups (e.g. an "other" or communications grouping) regardless of whether the role was housekeeping.
- There was **no dedicated branch** for the housekeeping role, so its navigation was just the receptionist/general layout minus the modules they lacked permission for.
- Items such as **Messages** and the **room-status accordions** lived under a generic communication grouping rather than being a first-class, clearly-labelled housekeeping section.

## 3. The Solution

### 3.1 A role-specific navigation branch

- Added an `isHousekeeping` computed (role check: `user_role === 'housekeeping'`).
- Added a dedicated `visibleModules` branch for housekeeping staff that builds a focused, ordered navigation:

1. **Dashboard**
2. **Housekeeping** (task board)
3. **Laundry**
4. **Issue Reports**
5. **Communication**
   - **Messages**
   - **Room Status**

### 3.2 Exclusions

For the housekeeping role the following were intentionally removed from the sidebar:

- **My Profile** (moved out of the housekeeping rail)
- **Fun Games**
- **Restaurant & Bar** (F&B module)

### 3.3 Grouping

The Communication group now uses the **`Communication`** accordion label with its two sub-entries (Messages + Room Statuses) on top, so the two surfaces housekeeping reaches for most are one click away.

## 4. Files Changed

| Area | File | Change |
| --- | --- | --- |
| Frontend | `src/layouts/StoreLayout.vue` | `isHousekeeping` computed + dedicated housekeeping `visibleModules` branch |

## 5. Verification Results

- Frontend `vite build` — **clean**.
- Frontend Vitest suite — **107/107 passed** (sidebar layout logic is exercised via the store/layout mocks used by the routing tests).
- Full backend suite — unchanged side effects, **569 passed / 2305 assertions**.

## 6. Result

Housekeeping staff now get a lean, role-appropriate navigation rail: Dashboard → Housekeeping → Laundry → Issue Reports → Communication (Messages + Room Status). F&B and games modules no longer clutter their workspace, and the room-status view they rely on is promoted into the communication group.