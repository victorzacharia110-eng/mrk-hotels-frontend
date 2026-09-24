# MRK Hotels — Receptionist & Waiter Review: What Was Fixed

This document answers every question raised in the workflow review (`RECEPTIONIST WORK FLOW(1).pdf`
and `WAITER WORK FLOW.pdf`). Each item shows **the problem** as it was reported, followed by **what is
now working**. Everything below is finished and ready for testing.

---

# 1. RECEPTIONIST WORK FLOW

## 1.1 Before the guest checks in

### 1.1.1 — Editing a reservation is not live
> USER can EDIT reservation while yet not checking in customer. Can edit guest details or booking
> details to change check in or check out. **CURRENTLY the changes are not live** meaning they are
> not reflective when changes are saved the TAB remains unchanged.

**Fixed ✓**: saving a change now updates the screen immediately. Editing a guest's details, check-in or
check-out date — for a pending, confirmed or already-staying guest — reloads the information at once, so
what you save is what you see.

### 1.1.2 — Pre-check-in payment wrongly turns the row green
> USER can ADD payment of a customer that is not yet checked in but only reserved … **CURRENTLY when
> the USER ADDS payment the color changes from RED TO GREEN as if the customer has been checked in
> while not. UNLESS the customer is CHECKED IN the color should not change.**

**Fixed ✓**: the row colour now shows **check-in status only**, never payment. A guest who booked and
paid in advance stays red until they actually check in. Only a real check-in turns the row green;
payments simply appear on the folio.

### 1.1.3 — Cancel booking vs. VOID after check-in
> USER can CANCEL BOOKING of a reserved guest and data is completely erased but when CHECKED IN only
> management has access to VOID the reservation.

**Fixed ✓**: cancelling a **not-yet-checked-in** booking still works and clears the reservation.
Once a guest is checked in, **only management** can void the reservation — the void option no longer
appears to reception staff, and the system blocks it for everyone else.

### 1.1.4 — Future-date reservations being checked in early
> USER should not be able to CHECK IN a reservation of a future date that is not CURRENT DATE.
> CURRENTLY the USER can ACTIVATE CHECK IN of a customer who reserved a room for 26/09/2026 which is
> a date that has not even reached yet … when clicking check in it accepts.

**Fixed ✓**: the system now refuses to check a guest in **before their arrival date**. If the check-in
date is still in the future, the check-in is blocked and a clear message explains the guest can only be
checked in from that date onwards.

### 1.1.5 — Move room (reserved, not checked in)
> USER can MOVE ROOM of reserved (NOT CHECKED IN) guest … perfectly this works perfectly.

**Fixed ✓**: already worked correctly — no change needed. A reserved guest can still be moved between
rooms freely before check-in.

### 1.1.6 — Folio should itemise each night; labels are generic
> Folio Operation when guest is checked in should consists of all nights based on number of nights;
> also currently DESCRIPTIONS reads as RENTAL CHARGES.

**Fixed ✓**: after check-in the folio now lists **one line per night** for the whole stay instead of a
single lump "RENTAL CHARGES" entry. Every night line clearly names the room and the date (for example
"Room 101 · Rent 24/09/2026"), so each night can be identified for auditing and when handling due-out
guests.

---

## 1.2 Questions when the guest is checked in

### 1.2.1 — SMS no longer appears when payments are made / on reservation setup
**Fixed ✓**: SMS messages are connected again at both moments. Guests automatically receive a text when
their booking is created and when they check out, and a payment receipt message after each payment. If a
message ever fails to send, the staff can see the failure instead of it failing silently.

### 1.2.2 — Can a user EDIT a reservation while the guest is CHECKED IN?
**Fixed ✓**: any edit that affects money now updates the bill **live**. Moving a guest to another room
re-prices every night at the new room's rate and updates the folio balance right away. Extending or
shortening the stay adds or removes exactly the right number of nights on the bill. Personal details
(name, phone, etc.) can still be edited freely without touching the bill.

### 1.2.3 — Amend stay / edit check-out must reflect live on room charges & folio
> …do TOTAL ROOM CHARGES and ROOM CHARGES in folio operations or BALANCE reflect LIVE changes?

**Fixed ✓**: after any stay or room edit, the bill, room charges and balance are recomputed together, so
the totals always match each other and never show conflicting numbers.

### 1.2.4 — Editing the CHECK IN date once the guest is checked in
> User should not be able to EDIT CHECK IN of the guest once is checked in either to previous date
> (which should be impossible once night audit is done) or to future date.

**Fixed ✓**: once a guest is in-house, their check-in date **cannot be changed** — neither earlier nor
later. The system rejects the change, and the bill stays based on the actual nights of the stay.

### 1.2.5 — Add payment to a checked-in guest
**Fixed ✓**: works as expected. A payment appears as a line on the folio and lowers the balance
immediately.

### 1.2.6 — DUE OUT logic & the missing purple colour
> IS DUE OUT feasible? … the NIGHT AUDIT of 21/09/2026 may not be done until guest has paid and
> CHECKED OUT. WHY DOES DUE OUT NOT HAVE ITS PURPLE COLOR?

**Fixed ✓**: a guest whose departure date has passed now automatically shows as **DUE OUT in purple**
on the dashboard. The colour appears on its own whenever the stay has ended, so staff see at a glance
who is still to check out and settle.

### 1.2.7 — Folio balance posting to creditors
> The user tried to post an outstanding balance … and gave … "This folio has no outstanding balance
> to post."

**Fixed ✓**: posting an unpaid balance to a creditor now tells the two situations apart. If there is
genuinely nothing left to post, the message stays "This folio has no outstanding balance to post." If
the guest's company has **no creditor account set up**, the system says so explicitly ("No creditor
account is configured for this company…") — so staff know exactly which one to fix.

### 1.2.8 — Sending invoice by email reads as a server error
> Why does sending invoice through email reads as server error?

**Fixed ✓**: invoice emails now send correctly. If the delivery genuinely fails, a clear, sensible
message appears instead of a confusing "server error".

### 1.2.9 — Discount / negative adjustment increases TOTAL PAID
> Why does APPLYING DISCOUNT & USING NEGATIVE ADJUSTMENT increases TOTAL PAID? TOTAL PAID should
> remain the same when these features are used only BALANCE should change.

**Fixed ✓**: applying a discount or a negative adjustment **no longer changes TOTAL PAID** — only the
balance moves. TOTAL PAID now counts only money actually received (cash, card, folio settlement), never
discounts or charge adjustments.

### 1.2.10 — Does ADD INCLUSION work / appear in folio operations?
**Fixed ✓**: ADD INCLUSION creates a folio line and appears in Folio Operations. The balance on screen
and on the printed invoice updates right away.

---

## 1.3 Transfer folio & splitting folio

> Can guest folio balance be settled … transfer some FOLIO particulars from one guest to another …
> e.g. a guest has requested 3 rooms and wants all bills concentrated to one room.

### 1.3.1 — Viewing one folio zeroes the other
> there is a folio TAB at the TOP … WHY WHEN USER CLICKS TO VIEW ONE FOLIO the other one's balance
> converts to 0 … why do both sometimes looks clicked while only one is selected to VIEW?

**Fixed ✓**: every folio now always keeps and shows its **correct balance**. Viewing one folio no longer
makes another read zero, and only the folio you are actually viewing shows as selected.

### 1.3.2 — Add payment on the RELATED folio turns the CURRENT balance negative
> When user tried to ADD PAYMENT of a RELATED FOLIO on CURRENT FOLIO TAB the BALANCE turned to
> NEGATIVE on CURRENT FOLIO BALANCE AND BALANCE DUE.

**Fixed ✓**: payments are now always applied to the folio you are **looking at**. A transfer also fully
separates the bills — once money is moved to another folio, each folio owns its own balance, so a
payment on one can never push the other negative by mistake. One bill, one balance.

### 1.3.3 — Charges/inclusion/discount only touch the CURRENT folio
> When ADDING CHARGES|INCLUSION|APPLYING DISCOUNT after splitting bills (CURRENT FOLIO and RELATED
> FOLIO) why do all changes only appear on the CURRENT FOLIO even when the user is VIEWING RELATED
> FOLIO?

**Fixed ✓**: everything you add — charges, inclusions or discounts — now lands on the folio you are
currently viewing, even after bills have been split.

### 1.3.4 — PRINT INVOICE auto-downloads instead of showing the print page
> When user CLICKS PRINT INVOICE why does it automatically download the invoice instead of
> redirecting to PRINT PAGE?

**Fixed ✓**: the **Print invoice** button now opens a clean, printer-friendly invoice page that goes
straight to the print dialog. The separate **Download** buttons still save a copy of the invoice as a
file — printing and downloading are now two clearly separate actions.

### 1.3.5 — Invoice has no margins/layout
> Why does INVOICE not have MARGINS and LAYOUT?

**Fixed ✓**: the printed invoice now uses a clean layout — A4 with proper margins, the hotel name and
title at the top, amounts in a neat table, and a footer with printing details.

### 1.3.6 — New folio for a current guest changes the ROOM NUMBER in the FOLIO NAME CODE
> Why does creating new folio for current guest changes room number … the name of the guest remains
> the same but the room number changes?

**Fixed ✓**: opening an extra folio for a guest who is already staying **no longer changes the room
number**. The new folio keeps the guest's name and the same room as the original.

### 1.3.7 — After a split, can 2 independent invoices be printed / sent?
> If bill is split can user print 2 independent invoices since there are 2 folios? … can user send 2
> independent invoices since there are 2 folios?

**Fixed ✓**: yes. After a bill is split, **each folio has its own Print and Send buttons**, so the
receptionist can print or email two separate invoices, each carrying its own code and balance.

---

## 1.4 Upon check out

### 1.4.1 — Void reservation = management only
> Void Reservation access should only remain to management.

**Fixed ✓**: voiding a reservation is **management only**. Reception and waiter devices no longer show
the void option, and the system blocks the action for non-management staff.

### 1.4.2 — Edit folio operations after checkout = management only
> Access to edit folio operations after guest checking out should only remain to management.

**Fixed ✓**: once a guest has checked out, changing or voiding folio lines is **limited to management**
(manager, accountant, owner). Operators can no longer touch a closed folio; management can still make a
correction if needed, and any change stays reflected in the reports even after day close.

---

# 2. WAITER WORK FLOW

> Waiter's major functionalities: to place an order; to print bill.

## 2.1 Waiter basics

### 2.1.1 — Remove the WELCOME "USERNAME" + CONTINUE tab
> there is a little TAB in the middle of the screen that says WELCOME "USERNAME" and a button to
> CONTINUE, if a user is going to visit the system more than 10 times a day this looks like a time
> waster please remove it.

**Fixed ✓**: the "Welcome — Continue" pop-up after login has been **removed**. Staff land straight on
their work screen — important for people who sign in many times a day.

### 2.1.2 — Can the waiter place / see orders?
**Fixed ✓**: waiters place new orders and see their own open orders in the Open Orders list, including a
link straight back to each ticket.

---

## 2.2 New orders — table handling

### 2.2.1 — Selecting a table marks it occupied
> When waiter select table does the table marks as occupied?

**Fixed ✓**: as soon as a waiter selects a table and adds the first item, the table shows as
**occupied**.

### 2.2.2 — Other waiters see a taken table
> …do other waiters when they login see if the table is taken?

**Fixed ✓**: a taken table is instantly visible to **every waiter**, with the name of the staff member
holding it. Occupancy is tracked per user, so it is always correct even when two staff share the same
name.

### 2.2.3 — Waiter cannot add to a table she/he already occupies
> Can waiter add an order to an occupied table by her? Currently the waiter cannot … it says "THAT
> TABLE IS OCCUPIED. PICK A FREE TABLE".

**Fixed ✓**: a waiter can now **reopen a table they themselves occupy** to keep adding to that ticket —
using either the table map or the search dropdown. A different waiter's occupied table stays blocked,
and a manager can always open any table.

### 2.2.4 — Item-tab resets when menu items are chosen before the table
> Why when user starts by selecting MENU ITEMS first then follows by selecting A TABLE does the TAB
> that receives the selected menu items RESETS itself as from the start to reselect the menu items
> again?

**Fixed ✓**: choosing the menu items first and only then picking a table **no longer wipes the items**.
The draft order is kept. Items are cleared only when the waiter deliberately moves away from a ticket
of their own that was still open.

---

## 2.3 Open orders

### 2.3.1 — Show order date & time, running time, and the waiter's name
> Do open orders show date & time when the order was taken? Do open orders show how much time the
> order has been running? Do open orders show the name of the waiter that placed the order?

**Fixed ✓**: open-order cards now show **when the order was taken**, **how long it has been running**
(a live timer), and **which waiter placed it** — so supervisors can see which orders are getting old and
who holds them.

### 2.3.2 — Split / transfer of an open order
> Can an open order be split? Can an open order be transferred?

**Fixed ✓**: an open order can be **split** (by the cashier/supervisor) and **transferred**. When
transferred, the order moves to the chosen table and appears on that side.

### 2.3.3 — Reprint KOT must be watermarked
> Can waiter reprint KOT of an open order? If a KOT is reprinted should be written at the top that the
> order is REPRINTED.

**Fixed ✓**: every reprinted kitchen ticket is stamped **"*** REPRINTED ***"** at the top, so the kitchen
can always tell a reprint from the original.

### 2.3.4 — Merge menu items from 2 tables into ONE printable bill
> Can waiter merge menu items from 2 different tables to create ONE BILL that is printable? Currently
> menu items can only be placed on the same table BUT they are not on the same TAB therefore how can
> the total bill that consists of food and drinks be printed?

**Fixed ✓**: items from **two different tables can now be merged into one bill** and printed together.
The source table's order closes and everything appears on the target bill — so food from one table and
drinks from another end up on a single bill.

### 2.3.5 — Bar + restaurant merged order: which side does it appear on?
> If a bar order and restaurant order are merged through table transfer which side will the merged
> order appear? The merged order should appear to the side to which the selected orders where
> transferred to.

**Fixed ✓**: a merged order always appears on the **side it was transferred to**. The original orders on
the source side are removed, so the merged bill shows in exactly one place.

### 2.3.6 — REMOVE status-advance from the waiter panel (RUNNING/SETTLED only)
> Why do waiters panel open orders have access to set ORDER IS READY or ORDER IS SERVED? There should
> be only two conditions RUNNING or SETTLED … REMOVE "START PREPARING" / "THE BELL SIGN" (order is
> ready) / "THE DISH SIGN" (order is served).

**Fixed ✓**: waiters no longer move orders through "start preparing / ready / served" — the **kitchen and
bar lead the service flow**. Waiters see exactly two states, **RUNNING** (open) and **SETTLED** (closed),
and the system blocks them from changing any dish status.

---

## 2.4 Closed orders

### 2.4.1 — View the menu items of a closed order
> Can waiter see the menu items of a closed order? Waiter should be able to view closed order consists
> of which menu items.

**Fixed ✓**: the **Order Summary** tab lists all of the waiter's tickets for the day, including settled
and closed ones. Every row has a **View items** button that expands exactly what was ordered — quantity,
item, accompaniment and amount — so "what was on that ticket" is always answerable.

### 2.4.2 — Does the table free when the order is settled?
> When an order is settled does the table become free?

**Fixed ✓**: a table becomes free only when the **last open ticket on it** is settled, voided or billed
to a room. It stays occupied while any order is still running.

### 2.4.3 — Reprint a closed order's KOT (labelled as closed)
> Can waiter reprint KOT of a closed order? Waiter should be able to reprint closed order but should
> be able to indicate that it's a closed order.

**Fixed ✓**: closed orders can be reprinted, and the ticket is clearly marked **"*** CLOSED ORDER —
REPRINT ***"** so the kitchen knows it is closed work, not a live order.

### 2.4.4 — VOID of a closed order is management-only
> Can a closed order be voided? THE MANAGEMENT should be able to VOID closed order but the VOID option
> should not appear on waiters panel but cashier's. VOIDING a closed order will affect the reports
> and changes should be reflective even after day close is done.

**Fixed ✓**: voiding a closed order is available **only to managers and cashiers** — waiters cannot see
it. Voided amounts still flow into the reports and stay correct even after day close.

---

## 2.5 Dashboard

### 2.5.1 — LOW STOCK tab is not reflective
> Is LOW STOCK tab that shows stock at hand and reorder level REFLECTIVE? Currently it is not
> reflective since the user issued and accepted indent of several items such as AZAM JUICE but they
> all still read 0.

**Fixed ✓**: the stock-on-hand figures are now always calculated from **real movements** — goods received
(purchases and accepted indents) minus goods used. When the store issues or accepts an indent, the LOW
STOCK list updates **on screen immediately**. A received item such as AZAM JUICE no longer stays at 0.

### 2.5.2 — FAST MOVING ITEMS should show live changes
> Is FAST MOVING ITEMS tab reflective and shows live changes?

**Fixed ✓**: the FAST MOVING list is ranked from live sales and **refreshes automatically** whenever an
order or item is added, so it always shows the current best-sellers for the shift.

---

## Status summary

Every item above is **fixed and ready to test**.

| Area | Total items | Fixed ✓ |
|---|---|---|
| Receptionist — reservations (before check-in) | 6 | 6 |
| Receptionist — questions when checked in | 10 | 10 |
| Receptionist — transfer/split folio | 7 | 7 |
| Receptionist — check out | 2 | 2 |
| Waiter — core | 2 | 2 |
| Waiter — new orders / table handling | 4 | 4 |
| Waiter — open orders | 6 | 6 |
| Waiter — closed orders | 4 | 4 |
| Waiter — dashboard | 2 | 2 |
| **Total** | **43** | **43** |