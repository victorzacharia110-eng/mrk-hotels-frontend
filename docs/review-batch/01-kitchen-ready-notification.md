# MRK Hotels — Review Batch 01 · Kitchen Ready Notification (Problem & Solution)

**Module:** Food & Beverage (Order Taker) — **Status: Resolved** — **5 September 2026**

---

## 1. The Problem

When the kitchen marks an order item as **ready**, the waiter who took the order had no automatic way of knowing. The order-taker dashboard showed the item's lifecycle states (pending / ready / served), but nothing visually called out an item that had just become ready, and there was no push notification of any kind.

**What this meant in practice:**

- Waiters had to keep re-checking open orders to see whether their items had left the kitchen.
- Ready food could sit longer before being served, hurting food quality and guest satisfaction.
- The kitchen had no channel to actively ping the responsible waiter.

## 2. Root Cause

- `OrderController::markItemStatus()` (the `PATCH /orders/{id}/items/{itemId}/status` endpoint) only updated the item's `status`; it produced **no notification** when the item transitioned to `ready`.
- The notification service already existed with a `create()` method supporting **per-user** delivery (`user_id` set = targeted) and **broadcast** delivery (`user_id` null), but nothing wired the kitchen event to the target waiter.
- `Order` already carried `created_by` (the waiter who took the order), giving us the delivery target — it just wasn't used.
- The waiter panel (Vue) rendered open items but did not differentiate a ready/served item visually.

## 3. The Solution

### 3.1 Backend — notify the waiter when an item is ready

- Added `NotificationService::orderItemReady()` — a typed helper that builds a targeted (per-user) notification with type `order_item_ready`.
- Called it from `markItemStatus()` whenever an item transitions to `status = ready`.
- The notification targets `$order->created_by` (the waiter) and carries:
  - the **order number**,
  - the **location** of the order (table, room or guest name, whichever the order holds),
  - the **item name** now ready.
- Because the notification sets `user_id`, it is delivered directly to that waiter's in-app notification feed (and, where Echo/Reverb is connected, in real time) rather than broadcast to all staff.

### 3.2 Frontend — auto-ready visual on the waiter panel

- The open-orders list in `OrderTakerDashboard.vue` now renders a green **READY / SERVED pill** for items whose status is `ready` or `served`.
- The dashboard already polls the open-orders feed every 30 seconds while the Open tab is active, so the pill appears automatically without any manual refresh.
- Added the `.item-ready-pill` / `.item-served` styling.

### 3.3 Verification

- New test `test_marking_an_item_ready_pings_the_waiter_who_took_the_order` in `tests/Feature/OrderServingFlowTest.php` asserts that marking an item ready creates the notification for the order's `created_by` with the expected type and payload.

## 4. Files Changed

| Area | File | Change |
| --- | --- | --- |
| Backend | `app/Http/Controllers/Api/V1/FoodBeverage/OrderController.php` | `markItemStatus()` fires `order_item_ready` on the ready transition |
| Backend | `app/Services/NotificationService.php` | New `orderItemReady()` typed helper |
| Frontend | `src/pages/dashboards/OrderTakerDashboard.vue` | READY/SERVED pill on open items + styles |
| Tests | `tests/Feature/OrderServingFlowTest.php` | Ready→waiter notification test |

## 5. Verification Results

- `OrderServingFlowTest` — **17/17 passed** (73 assertions).
- Full backend suite — **569 passed / 2305 assertions**.
- Frontend `vite build` — **clean**; frontend Vitest suite — **107/107 passed**.

## 6. Result

Waiters are now told — in-app and visually on the open-orders panel — the moment one of their items is ready, with the exact order number, location and item, so food leaves the kitchen as soon as possible.