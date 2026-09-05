# MRK Hotels — Review Batch 05 · Laundry Settlement & Room Billing (Problem & Solution)

**Module:** Laundry (Settlement) — **Status: Resolved** — **5 September 2026**

---

## 1. The Problem

Laundry orders had no explicit, controlled **settlement flow**. Any status change could be posted with almost no guardrails, and "post to room" did not verify that the guest was **actually staying in the room** at settlement time.

**What this meant in practice:**

- A laundry bill could be silently added to a **vacant, dirty or already checked-out room** — creating phantom room charges.
- There was no dedicated UI action saying *"settle this order"* with a conscious choice between **Mark as paid** and **Post to room**.
- Walk-in orders created at the desk (with a room number but no reservation link) could not be posted to the room later without manual intervention.

## 2. Root Cause

- `applyRoomBilling()` in `LaundryOrderController` posted `room_charges` whenever the order was `billed_to_room`, but:
  - it did **not check the reservation's status** (a `checked_out` / vacant stay could still be charged); and
  - it required a `reservation_id` that walk-in orders might never have, so their only path was to stay `unpaid` forever.
- The frontend had status buttons but **no settlement modal**, and the payment status was treated like a generic dropdown rather than a deliberate act.

## 3. The Solution

### 3.1 Backend — occupied-room-only billing

`applyRoomBilling()` was rewritten to enforce the business rule **"only a room the guest is staying in can be charged"**:

1. Only a `payment_status` of `billed_to_room` posts a charge.
2. The order must have `total_charge > 0` (412/422 guard against billing a free order).
3. The reservation is resolved either:
   - via the order's own `reservation_id`, **or**
   - for walk-in orders without a link, **by room number** — the latest `confirmed` / `checked_in` reservation on that room (with row-lock for safety).
4. The reservation must still be an **active stay** (`confirmed` or `checked_in`). Otherwise the request is rejected with **HTTP 422**: *"Only currently occupied rooms can be billed. No active stay found for this room."*
5. Only then is the charge added to the reservation's `room_charges`.

Paid and unpaid settlements never touch `room_charges`.

### 3.2 Frontend — a deliberate settle action

- Unpaid orders now show a **Settle** button in the row actions.
- It opens a **Settlement modal** with a clear choice:
  - **Mark as paid** — records the order as settled with cash/card/whatever the hotel uses.
  - **Post to room** — adds the charge to the guest's stay. If the order has no reservation link, the modal shows a **room-number field** so a walk-in order can be resolved and posted to the active stay.
- The modal shows the order number, guest and total charge; the backend's **422 rejection message** is surfaced directly in the modal when the target room is not an active stay (e.g. guest already checked out).
- New i18n keys (`settle*`) added to **both** `en.json` and `sw.json`.

## 4. Files Changed

| Area | File | Change |
| --- | --- | --- |
| Backend | `app/Http/Controllers/Api/V1/Laundry/LaundryOrderController.php` | `applyRoomBilling()` — occupied-room-only, walk-in resolution by room number |
| Frontend | `src/pages/laundry/LaundryListPage.vue` | Settle button + settlement modal (paid / post-to-room) |
| Frontend | `src/locales/en.json`, `sw.json` | `laundry.settle*` keys (both languages) |
| Tests | `tests/Feature/LaundryOrderTest.php` | Vacant-room rejection + walk-in settlement tests |

## 5. Verification Results

- `test_billing_to_a_vacant_room_is_rejected` — posting a checked-out reservation to the room returns **422** and the order stays unpaid with **no** room charge.
- `test_walk_in_order_can_be_posted_to_an_occupied_room_at_settlement` — an order created with only `room_number` is resolved to the in-house stay at settlement and the correct `room_charges` are posted.
- `test_settling_an_order_as_paid_needs_no_room` — marking paid needs no reservation at all.
- Backend full suite — **569 passed / 2305 assertions**.
- Frontend `vite build` — **clean**; Vitest **107/107 passed**.

## 6. Result

Laundry charges can only ever land on a room the guest is actually staying in, walk-in orders can finally be posted to the room when the guest is in-house, and the frontend now treats settlement as an explicit, reviewed action (paid vs. post-to-room) instead of an accidental dropdown flip.