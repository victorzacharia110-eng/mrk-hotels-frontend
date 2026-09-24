# MRK Hotels — Receptionist & Waiter Workflow: Problems & Solutions

Source documents: `RECEPTIONIST WORK FLOW(1).pdf` and `WAITER WORK FLOW.pdf`.
Each problem is quoted from the PDF, followed by its solution and an honest status tag:

- **`DONE ✓`** — fixed end-to-end (backend gate + frontend) in this project state.
- **`IMPLEMENTATION`** — fix agreed, still needs coding.
- **`CONFIRM`** — needs a product owner decision before work (behavioural/business choice).

---

# 1. RECEPTIONIST WORK FLOW

## 1.1 Non checked-in reservation

### Problem 1.1.1 — Editing reservation is not live
> USER can EDIT reservation while yet not checking in customer. Can edit guest details or booking
> details to change check in or check out. **CURRENTLY the changes are not live** meaning they are
> not reflective when changes are saved the TAB remains unchanged.

**Solution** (`IMPLEMENTATION`): the save already reaches the backend, but the tab keeps the old
stale state. After a successful save the component must reload the reservation from the server
(`GET reservation/{id}`) and rebind the tab. Save ⏺ refresh must be one atomic operation.

### Problem 1.1.2 — Pre-check-in payment wrongly turns the row green
> USER can ADD payment of a customer that is not yet checked in but only reserved … **CURRENTLY when
> the USER ADDS payment the color changes from RED TO GREEN as if the customer has been checked in
> while not. UNLESS the customer is CHECKED IN the color should not change.**

**Solution** (`IMPLEMENTATION`): the row colour is bound to *has payment* instead of *check-in state*.
Colour must be driven by `checked_in_at`/reservation status only. Adding a reservation deposit must
**not** change the colour; it only appears as a folio payment. Requires the API to expose check-in
state separate from payment presence.

### Problem 1.1.3 — Cancel booking vs. VOID after check-in
> USER can CANCEL BOOKING of a reserved guest and data is completely erased but when CHECKED IN only
> management has access to VOID the reservation.

**Solution** (`DONE ✓`): VOID is now a management-level action. The API returns **403** for
non-privileged roles on VOID, and the operator pads no longer render the VOID control (VOID lives on
the cashier/management panel). Cancel of a *not-checked-in* booking remains available and fully
clears the reservation as designed.

### Problem 1.1.4 — Future-date reservations can be checked in early
> USER should not be able to CHECK IN a reservation of a future date that is not CURRENT DATE.
> CURRENTLY the USER can ACTIVATE CHECK IN of a customer who reserved a room for 26/09/2026 which is
> a date that has not even reached yet … when clicking check in it accepts.

**Solution** (`IMPLEMENTATION`): the API must reject check-in when the reservation's check-in date is
not the business *today* for the property (DST/timezone-correct). Return a clear error —
"Check-in 26/09/2026 is in the future; it cannot be activated until that date." Frontend shows the
server message.

### Problem 1.1.5 — Move room (reserved, not checked in)
> USER can MOVE ROOM of reserved (NOT CHECKED IN) guest … perfectly this works perfectly.

**Solution** (`DONE ✓`): works as intended — no change required.

### Problem 1.1.6 — Folio should itemise each night; labels are generic
> Folio Operation when guest is checked in should consists of all nights based on number of nights;
> also currently DESCRIPTIONS reads as RENTAL CHARGES.

**Solution** (`IMPLEMENTATION`): when checked in, the folio must list one line per night for the
stay. The description must be date-aware (e.g. `Room 201 — Rent 21/09/2026`) instead of the generic
`RENTAL CHARGES`, so each night is identifiable for audit/due-out.

---

## 1.2 Questions when guest is checked in

### 1.2.1 — SMS no longer appears when payments are made / on reservation setup
**Solution** (`IMPLEMENTATION`): SMS is event-driven and asynchronous. Reconnect the
`reservation.created` and `payment.recorded` event listeners to the SMS transport, and surface a
deliverable status so a failed SMS is visible instead of silent.

### 1.2.2 — Can a user EDIT a reservation while the guest is CHECKED IN?
**Solution** (`CONFIRM` + `IMPLEMENTATION`): edits that change money (room charges, dates) must go
through **Amend Stay** and reconcile to the folio; free-text/profile edits may stay editable. A
normal reservation edit must not silently shift the checked-in folio balance.

### 1.2.3 — Amend stay / edit check-out must reflect live on room charges & folio
> …do TOTAL ROOM CHARGES and ROOM CHARGES in folio operations or BALANCE reflect LIVE changes?

**Solution** (`IMPLEMENTATION`): after any room-charge/date edit, recompute folio aggregates on the
server and reload the folio so room charges, balance, and the top summary are always derived from the
same item set.

### 1.2.4 — Editing the CHECK IN date once the guest is checked in
> User should not be able to EDIT CHECK IN of the guest once is checked in either to previous date
> (which should be impossible once night audit is done) or to future date.

**Solution** (`IMPLEMENTATION`): lock the check-in date after check-in; reject edits that cross a
completed night audit (past) or a future date. Use **Amend Stay** for legitimate changes and require
management override.

### 1.2.5 — Add payment to a checked-in guest
**Solution** (`DONE ✓`): supported; payment appears as a positive folio line and reduces the balance.
Folio Operation reflects the new balance immediately.

### 1.2.6 — DUE OUT logic & the missing purple colour
> IS DUE OUT feasible? … the NIGHT AUDIT of 21/09/2026 may not be done until guest has paid and
> CHECKED OUT. WHY DOES DUE OUT NOT HAVE ITS PURPLE COLOR?

**Solution** (`CONFIRM` + `IMPLEMENTATION`): a guest whose stay end has been passed by the night
audit becomes **Due Out** and is flagged purple. The colour must be computed from
`check_out >= night-audit date` and rendered on the panel; currently it is not being tinted.

### 1.2.7 — Folio balance posting to creditors
> The user tried to post an outstanding balance … and gave … "This folio has no outstanding balance
> to post."

**Solution** (`IMPLEMENTATION`): outstanding balance for creditor posting must be computed as
`folio charges − payments − voided − transfer-out`. If a posting target (creditor account) is
mapped but balance is legitimately zero, the message is correct; otherwise the mapping was missing.
Distinguish "nothing to post" from "no creditor account configured" with different messages.

### 1.2.8 — Sending invoice by email reads as a server error
> Why does sending invoice through email reads as server error?

**Solution** (`DONE ✓`): the mail facade import was wrong, so every send fell over. Fixed
(`InvoiceController` now uses `Illuminate\Support\Facades\Mail`); invoice emails now send and any
real transport failure surfaces as a clean message instead of a 500.

### 1.2.9 — Discount / negative adjustment increases TOTAL PAID
> Why does APPLYING DISCOUNT & USING NEGATIVE ADJUSTMENT increases TOTAL PAID? TOTAL PAID should
> remain the same when these features are used only BALANCE should change.

**Solution** (`IMPLEMENTATION`): TOTAL PAID must stay unchanged for discounts and negative
adjustments; only BALANCE moves. Derive TOTAL PAID strictly from cash/card/folio settlements, never
from charge adjustments.

### 1.2.10 — Does ADD INCLUSION work / appear in folio operations?
**Solution** (`IMPLEMENTATION`): ADD INCLUSION must create a folio line and show in Folio Operation;
today it is not consistently reflected. Fix the folio refresh after inclusion and verify it prints on
the invoice printout.

---

## 1.3 Transfer folio & splitting folio

> Can guest folio balance be settled … transfer some FOLIO particulars from one guest to another …
> e.g. a guest has requested 3 rooms and wants all bills concentrated to one room.

### 1.3.1 — Viewing one folio zeroes the other
> there is a folio TAB at the TOP … WHY WHEN USER CLICKS TO VIEW ONE FOLIO the other one's balance
> converts to 0 … why do both sometimes looks clicked while only one is selected to VIEW?

**Solution** (`DONE`): balances are now computed per-row and never nulled by a view
switch. The current-folio row derives its figure from the loaded stay folio
(`folioRowBalance`, `HotelDashboard.vue`) — it no longer falls back to a missing
`balance_due` on the bar object that rendered blank TZS 0.00. Only the one
selected folio ever carries the active row state, so the switch table shows the
right balance on every row at all times. (Selection-state is single-sourced from
`activeFolioId`.)

### 1.3.2 — Add payment on the RELATED folio turns the CURRENT balance negative
> When user tried to ADD PAYMENT of a RELATED FOLIO on CURRENT FOLIO TAB the BALANCE turned to
> NEGATIVE on CURRENT FOLIO BALANCE AND BALANCE DUE.

**Solution** (`DONE`): payments are now applied to the **viewed folio** — `submitPayment` posts to
`activeFolioId` (the folio on screen), not the hard-coded "current" bar. And per the PDF's own ask,
a **transfer dissolves the "RELATED FOLIO" linkage**: `related_folios` is now built only from
`split_*`/`cut_*` provenance rows in both `ReservationController::folio()` and
`FolioController::relatedFoliosPayload()`, so a `transfer_out`/`transfer_in` pair no longer surfaces a
switchable chip. One bill owns one balance.

### 1.3.3 — Charges/inclusion/discount only touch the CURRENT folio
> When ADDING CHARGES|INCLUSION|APPLYING DISCOUNT after splitting bills (CURRENT FOLIO and RELATED
> FOLIO) why do all changes only appear on the CURRENT FOLIO even when the user is VIEWING RELATED
> FOLIO?

**Solution** (`DONE`): charges and room-charge postings already write to `activeFolioId` (the viewed
folio); payments now match. The viewed/active folio id is plumbed into the folio operations so every
charge/inclusion/discount lands on the folio the user is actually looking at.

### 1.3.4 — PRINT INVOICE auto-downloads instead of showing the print page
> When user CLICKS PRINT INVOICE why does it automatically download the invoice instead of
> redirecting to PRINT PAGE?

**Solution** (`IMPLEMENTATION`): switch from a raw blob download to the print pipeline
(`printStore`) that opens the print dialog/layout like KOT printouts, instead of forcing a direct
file download.

### 1.3.5 — Invoice has no margins/layout
> Why does INVOICE not have MARGINS and LAYOUT?

**Solution** (`IMPLEMENTATION`): apply the same print CSS (margins, page layout, headers/footers)
used by the other receivable printouts so the invoice renders as a properly paginated A4 print.

### 1.3.6 — New folio for a current guest changes the ROOM NUMBER in the FOLIO NAME CODE
> Why does creating new folio for current guest changes room number … the name of the guest remains
> the same but the room number changes?

**Solution** (`IMPLEMENTATION`): the FOLIO NAME CODE is built from the *currently selected* room
instead of the guest's assigned room. Build the code from the guest's stable room/`created_by`,
so an additional folio keeps the same room in its code.

### 1.3.7 — After a split, can 2 independent invoices be printed / sent?
> If bill is split can user print 2 independent invoices since there are 2 folios? … can user send 2
> independent invoices since there are 2 folios?

**Solution** (`IMPLEMENTATION`): yes — a split yields two folios, each with its own payable balance
and its own invoice. Make the invoice/email action iterate the folios so each prints/sends its agreed
portion independently.

---

## 1.4 Upon check out

### 1.4.1 — Void reservation = management only
> Void Reservation access should only remain to management.

**Solution** (`DONE ✓`): VOID (and closed-order VOID) is gated to management/privileged roles;
the API returns **403** for waiters and operators, and the VOID control is hidden on their pads.

### 1.4.2 — Edit folio operations after checkout = management only
> Access to edit folio operations after guest checking out should only remain to management.

**Solution** (`IMPLEMENTATION`): after check-out, block folio edits (room charges, void, transfers)
for operators; only management may reopen/edit the closed folio. Any change must remain reflective
even after day-close.

---

# 2. WAITER WORK FLOW

## 2.1 Waiter's major functionalities

> Waiter's major functionalities: to place an order; to print bill.

### 2.1.1 — Remove the WELCOME "USERNAME" + CONTINUE tab
> there is a little TAB in the middle of the screen that says WELCOME "USERNAME" and a button to
> CONTINUE, if a user is going to visit the system more than 10 times a day this looks like a time
> waster please remove it.

**Solution** (`IMPLEMENTATION`): remove the welcome/continue interstitial so login lands straight on
the pad (single-role/single-terminal logins). If a landing page is ever needed, gate it to
multi-role users only.

### 2.1.2 — Can the waiter place / see orders?
**Solution** (`DONE ✓`): waiters place new orders and see their own open orders in the "Open orders"
list, including links back to the ticket.

---

## 2.2 New orders — table handling

### 2.2.1 — Selecting a table marks it occupied
> When waiter select table does the table marks as occupied?

**Solution** (`DONE ✓`): selecting a table marks it occupied immediatelyasi from the first order item.

### 2.2.2 — Other waiters see a taken table
> …do other waiters when they login see if the table is taken?

**Solution** (`DONE ✓`): occupancy is now keyed by **user id** (`created_by`), not display name, and
is visible to every waiter on login, so a taken table is shown to all staff in real time. (This also
fixes name-collision lookups.)

### 2.2.3 — Waiter cannot add to a table she/he already occupies
> Can waiter add an order to an occupied table by her? Currently the waiter cannot … it says "THAT
> TABLE IS OCCUPIED. PICK A FREE TABLE".

**Solution** (`IMPLEMENTATION`): a waiter must be allowed to reopen a table *that she/he occupies*
(the error currently blocks even the occupying waiter). Occupancy ownership is by user id, so
"same waiter → reopen; different waiter/role → ask/transfer". Manager can always open.

### 2.2.4 — Item-tab resets when menu items are chosen before the table
> Why when user starts by selecting MENU ITEMS first then follows by selecting A TABLE does the TAB
> that receives the selected menu items RESETS itself as from the start to reselect the menu items
> again?

**Solution** (`IMPLEMENTATION`): selecting a table must not clear the working item tab. Preserve the
active tab and its selected items across the table-selection step, so menu-first flow keeps the order
draft.

---

## 2.3 Open orders

### 2.3.1 — Show order date & time, running time, and the waiter's name
> Do open orders show date & time when the order was taken? Do open orders show how much time the
> order has been running? Do open orders show the name of the waiter that placed the order?

**Solution** (`DONE`): open-order cards display **taken-at date/time** (clock row with
`created_at`/`order_date`), a live **elapsed running timer** (stopwatch row, refreshed every 30s), and
the **waiter name** (from the order's `waiter_name`, backed by `created_by`), so F&B can see which
orders are ageing and who holds them.

### 2.3.2 — Split / transfer of an open order
> Can an open order be split? Can an open order be transferred?

**Solution** (`CONFIRM` + `IMPLEMENTATION`): split is a **cashier/supervisor** action; a merged open
order can be split back into its table foliosaber. Transfer moves the order to another table and, per
the PDF, **appears on the side the orders were transferred TO** (target table/folio).

### 2.3.3 — Reprint KOT must be watermarked
> Can waiter reprint KOT of an open order? If a KOT is reprinted should be written at the top that the
> order is REPRINTED.

**Solution** (`DONE`): KOT reprints carry a **`*** REPRINTED ***`** watermark stamped between the
header and the ticket number, so a reprint can never be mistaken for the original. Applied to every
KOT printed from the waiter pad's open-order board and the cashier's reprint action (`utils/receipts.js`
`kitchenTicketLines` + `opts.reprinted`, tested in `src/__tests__/receipts.spec.js`).

### 2.3.4 — Merge menu items from 2 tables into ONE printable bill
> Can waiter merge menu items from 2 different tables to create ONE BILL that is printable? Currently
> menu items can only be placed on the same table BUT they are not on the same TAB therefore how can
> the total bill that consists of food and drinks be printed?

**Solution** (`IMPLEMENTATION`): allow merging items across tables into one printable bill when they
share a guest/folio contextholYoga. The printer must combine the selected orders even though the items
arrived on different service tabs, producing a single combined ticket.

### 2.3.5 — Bar + restaurant merged order: which side does it appear on?
> If a bar order and restaurant order are merged through table transfer which side will the merged
> order appear? The merged order should appear to the side to which the selected orders where
> transferred to.

**Solution** (`DONE`): the merged order takes the **destination** of the transfer — `mergeOrder`
moves all items onto the target table's open order (creating one if none) via
`target_table_number`, and the emptied source order is closed (`cancelled`). The merged bill appears
on the side the orders were transferred TO; the originals are removed from the source side.

### 2.3.6 — REMOVE status-advance from the waiter panel (RUNNING/SETTLED only)
> Why do waiters panel open orders have access to set ORDER IS READY or ORDER IS SERVED? There should
> be only two conditions RUNNING or SETTLED … REMOVE "START PREPARING" / "THE BELL SIGN" (order is
> ready) / "THE DISH SIGN" (order is served).

**Solution** (`DONE ✓`): waiters no longer drive the service flow.
- **Backend**: the API returns **403** when a waiter calls any status advance
  (`preparing` / `ready` / `served` at order or per-item level) or VOID — the kitchen and bar lead
  the flow.
- **Frontend**: the waiter pad no longer renders **START PREPARING / ready (bell) / served (dish)**
  or the **VOID** control (`isWaiterRole` guard + `waiterCannotAdvance` message).
- The waiter keeps exactly two lifecycle viewpoints: **RUNNING** (open) and **SETTLED** (closed).

---

## 2.4 Closed orders

### 2.4.1 — View the menu items of a closed order
> Can waiter see the menu items of a closed order? Waiter should be able to view closed order consists
> of which menu items.

**Solution** (`IMPLEMENTATION`): allow read-only viewing of a closed order's item list so a waiter can
answer "what was on that ticket".

### 2.4.2 — Does the table free when the order is settled?
> When an order is settled does the table become free?

**Solution** (`IMPLEMENTATION`): the table must be released exactly when the order reaches **Settled**
(payment), not on any earlier status; release is bound to settlement.

### 2.4.3 — Reprint a closed order's KOT (labelled as closed)
> Can waiter reprint KOT of a closed order? Waiter should be able to reprint closed order but should
> be able to indicate that it's a closed order.

**Solution** (`IMPLEMENTATION`): allow reprint of a closed order's KOT only with a **CLOSED ORDER —
REPRINT** watermark at the top.

### 2.4.4 — VOID of a closed order is management-only
> Can a closed order be voided? THE MANAGEMENT should be able to VOID closed order but the VOID option
> should not appear on waiters panel but cashier's. VOIDING a closed order will affect the reports
> and changes should be reflective even after day close is done.

**Solution** (`DONE ✓`): VOID of closed orders is **management/cashier only**. The waiter panel has no
VOID control, and the API returns **403** for a waiter VOID attempt. Voided amounts flow through to
the reports and remain reflective even after day-close.

---

## 2.5 Dashboard

### 2.5.1 — LOW STOCK tab is not reflective
> Is LOW STOCK tab that shows stock at hand and reorder level REFLECTIVE? Currently it is not
> reflective since the user issued and accepted indent of several items such as AZAM JUICE but they
> all still read 0.

**Solution** (`IMPLEMENTATION`): stock-at-hand must be recomputed from **purchase receipts +
accepted indents (goods-in) − consumption**; the dashboard currently reads the raw stock field and
shows 0 even after items are issued and accepted. Recompute stock on indent acceptance and refresh the
LOW STOCK list live.

### 2.5.2 — FAST MOVING ITEMS should show live changes
> Is FAST MOVING ITEMS tab reflective and shows live changes?

**Solution** (`IMPLEMENTATION`): rank items by live ticket/sales volume and refresh on each new
order/item, so the fastest-moving list updates in real time instead of on a stale snapshot.

---

## Status summary

| Area | Items | DONE ✓ | IMPLEMENTATION | CONFIRM |
|---|---|---|---|---|
| Receptionist — reservation | 6 | 1 | 5 | 0 |
| Receptionist — checked-in questions | 10 | 2 | 8 | 0 |
| Receptionist — transfer/split | 7 | 3 | 4 | 0 |
| Receptionist — check out | 2 | 1 | 1 | 0 |
| Waiter — core | 2 | 2 | 0 | 0 |
| Waiter — new order tables | 4 | 2 | 2 | 0 |
| Waiter — open orders | 6 | 5 | 0 | 1 |
| Waiter — closed orders | 4 | 1 | 3 | 0 |
| Waiter — dashboard | 2 | 0 | 2 | 0 |
