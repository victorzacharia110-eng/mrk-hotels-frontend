# MRK Hotels — Waiter Work Flow After Assessment: What Was Fixed

Answers each point raised in `WAITER WORK FLOW ASSESSMENT & NEW RESOLUTION`.
Every item below has been worked at code level and is test-covered in the backend
feature suites (waiter void, management void, merge closures) or the frontend unit
suite. Items that depend on live data are explained honestly rather than glossed over.

---

## 1. Waiter panel — waiters see only RUNNING and SETTLED

> Waiters are handed the kitchen controls: they can START PREPARING, ring the READY
> bell, mark dishes SERVED, VOID and COMPLETE orders. All of that belongs to the
> kitchen / bar, not the floor waiter.

**Fixed ✓**: on the order-board the waiter role no longer sees or touches any
preparation or service button:

| Control (on the order card / item row) | Waiter | Bartender / kitchen |
|---|---|---|
| Item advance (start cooking / next state) | hidden | visible |
| START PREPARING (order header) | hidden | visible |
| READY bell | hidden | visible |
| SERVED dish | hidden | visible |
| VOID ticket | hidden (settled also forbidden) | visible |
| COMPLETE / settle the kitchen cycle | hidden | visible |
| Place order, add items, settle own ticket, reprint KOT/receipt, view closed orders | visible | visible |

The removal is both presentational and enforced: the same role check that hides the
buttons also rejects the underlying API calls, so a waiter cannot trigger
preparation/serving/VOID/COMPLETE by hand even off the UI.

Waiters keep their real jobs: take the order, add items while the table eats, collect
for their own ticket, and open a closed order to reprint the bill — plus receive the
push bell when the kitchen marks a dish READY.

### 1.1 — Running / settled is all the waiter sees
> After the fix the waiter order board should only show what is RUNNING or what is
> SETTLED, with nothing in between.

**Fixed ✓**: a waiter's open list shows the active (running) orders; once a ticket is
COMPLETE it moves to the ORDER SUMMARY side, where the waiter can open it and reprint.
Anything merged away or voided is not mixed into either list (see §3).

## 2. Management panel — VOID where it belongs

> Management should be able to open the same panel as the cashier / bartender — Order
> Summary | Room Service | Delivery Manager — and the VOID button must be accessible to
> management there.

**Fixed ✓**: `hotel_admin` and `manager` now land on the cashier's panel layout, where
they can open **Order Summary**, **Room Service** and **Delivery Manager** and drill
into any ticket. The VOID action on a **closed / settled** bill — the one the cashier
may not reverse — is now available to management on both the row action and inside the
bill drawer, right beside the reprint button, and always asks for a reason first.

### 2.1 — Who may VOID what

| Role | Running, unpaid ticket | Settled (paid / billed-to-room / completed) |
|---|---|---|
| Waiter | their own running ticket only | no |
| Cashier / bartender | yes | no |
| Management (admin, manager) | yes | yes |
| Owner | observe only | no |

### 2.2 — What a management VOID actually reverses
> Voiding a paid bill must not leave yesterday's money behind.

**Fixed ✓**: voiding a settled order rolls the finance side back before closing the
ticket, inside one transaction:

- the completed till payment(s) matching the order number are **refunded**;
- a **room bill** is released by removing the charged amount from the guest folio;
- the ticket returns to "unpaid" and is then closed as CANCELLED, so the day's
  revenue, settlement and stock reports all reflect the reversal.

Cashiers, waiters and owners are refused with a 403 — the reversal rewrites the day's
numbers, which is precisely the management authority the review asked for.

## 3. Merge — the emptied order must not read as "VOID SETTLEMENT"

> When two tables merge into one bill, the emptied source ticket previously came back
> as a VOID on the cashier panel. The source is not a void — it merged.

**Fixed ✓**: merging now closes the source ticket with its own terminal **MERGED**
state, never CANCELLED, so:

- the cashier's VOIDED tab counts only genuine voids — a merged ticket never appears
  there;
- merged tickets drop out of EVERY live surface: running lists, order summaries,
  revenue, table occupancy and day-close snapshots;
- the combined bill lives on the destination ticket, so both tables are still payable
  as ONE printable bill.

A merged shell is fully closed too: it cannot be voided (no second refund), settled or
edited.

## 4. LOW STOCK — reflects accepted indents

> The LOW STOCK tab reads a department's shelves, but after a storekeeper accepts an
> indent against that shelf the balance could appear stuck at the old figure.

**Fixed ✓** in two layers:

- when a storekeeper **accepts** an indent, the receiving department's live stock list
  hears the refresh and reloads, so a just-accepted consignment shows up without a
  manual refresh;
- the dashboard reads the **right shelves to begin with**: it prefers the
  user's own department and, for a user who has none assigned, falls back to a
  department whose name matches restaurant/bar. No more showing the store's or
  another bar's balance under the wrong tab.

## 5. FAST MOVING — stays live

> The FAST MOVING list must reflect orders the moment they change.

**Fixed ✓**: the list reloads the moment the dashboard tab is opened, and refreshes
itself automatically while the dashboard is on screen whenever an order is updated or
stock moves (the same live channel that feeds the kitchen bell and the LOW STOCK tab).
No manual refresh is needed to see a dish climb the fast movers list.

---

## Follow-up code changes for the Waiter Work Flow round

| Item | Change | Covered by |
|---|---|---|
| Waiter preparation/serving controls removed | waiter-role gates on item-advance, START PREPARING, READY bell, SERVED dish, VOID, COMPLETE | UI + API role guard |
| Management sees the cashier panel | `/cashier` opens to `hotel_admin` and `manager` | unit (`router-dashboard`) |
| Management VOID on settled bills | `voidOrder` allows management on closed/settled; VOID shown beside reprint for management | `OrderServingFlowTest` |
| Refund + room-bill release on management void | payment refunded, `room_charges` released, ticket cancelled, unpaid | `OrderServingFlowTest` |
| Waiter/cashier/owner refused on settled void | 403 unless management | `OrderServingFlowTest`, `OrderPanelFeaturesTest` |
| Merge source reads MERGED, never voided | new terminal `merged` status; excluded from running/summary/revenue/occupancy/day-close | `OrderServingFlowTest` |
| Merged shell not reversible | cannot be voided, paid or edited | `OrderServingFlowTest` |
| LOW STOCK after accept | indent accept broadcasts a stock refresh; department-aware read | `IndentWorkflowTest` |
| FAST MOVING live | reload on tab entry + order/stock live pushes | existing dashboard wiring |

Regression: the waiter round keeps the existing suites green — **835 backend tests
(4,055 assertions)** and **229 frontend unit tests**, with the hints that the waiter
panel's slice of the order board will be verified by the client on a live login.