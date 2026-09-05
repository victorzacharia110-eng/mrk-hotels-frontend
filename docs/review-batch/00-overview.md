# MRK Hotels — Review Batch · Problems & Solutions

**Scope:** 5-item review batch · **Status: All Resolved** — **5 September 2026**

---

## 1. Overview

This batch addressed five issues raised during review, spanning the Food & Beverage, Housekeeping and Laundry modules. Each problem and its solution is documented as a separate PDF in this package:

| # | Document | Problem | Solution |
| --- | --- | --- | --- |
| 01 | Kitchen Ready Notification | Waiter isn't told when food is ready | Typed notification to the order's waiter + auto-ready READY/SERVED pill on the order-taker dashboard |
| 02 | Housekeeping Sidebar | Housekeeping staff saw irrelevant, badly grouped navigation | Dedicated role branch: Dashboard → Housekeeping → Laundry → Issue Reports → Communication (Messages + Room Status) |
| 03 | Housekeeping Task Export | Excel/CSV export was flat-key-mangled and misaligned | Rows flattened with explicit export-ready fields + declared `:columns` |
| 04 | Laundry Cloth-Type Registry | Free-typed items, hand-entered prices, no price list | Registry (table/model/controller/routes) whose service prices lock order pricing server-side |
| 05 | Laundry Settlement & Room Billing | Charges could land on vacant rooms; no deliberate settle flow | Occupied-room-only billing (422 otherwise) + settlement modal (Mark paid / Post to room) |

## 2. Verification (all documents)

- Backend full suite: **569 passed / 2305 assertions** — includes the new `ClothTypeTest`, the extended `LaundryOrderTest`, the added ready-notification test, and the migration-phase policy test.
- Frontend: `vite build` **clean**; Vitest **107/107 passed**.
- Translations: every new key added to **both** `en.json` (fallback) and `sw.json`; key parity verified.

## 3. Deliberately Held for Review

Nothing in this batch has been **committed or pushed** — both repositories remain at the latest working state so the changes can be reviewed before landing.

| Repo | Path |
| --- | --- |
| Backend API | `mrk-hotels-api` |
| Web frontend | `mrk-hotels-frontend` |

## 4. Document Index

- `MRK_Hotels_Review_Batch_01_Kitchen_Ready_Notification.pdf`
- `MRK_Hotels_Review_Batch_02_Housekeeping_Sidebar.pdf`
- `MRK_Hotels_Review_Batch_03_Housekeeping_Task_Export.pdf`
- `MRK_Hotels_Review_Batch_04_Laundry_Cloth_Type_Registry.pdf`
- `MRK_Hotels_Review_Batch_05_Laundry_Settlement_Room_Billing.pdf`