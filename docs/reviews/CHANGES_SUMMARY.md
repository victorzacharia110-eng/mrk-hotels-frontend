# MRK Hotels — What We Fixed: A Plain-Language Summary

**For the management and staff of MRK Hotels** — this companion to your two written reviews explains every change in everyday language.

---

## 1. What is this document?

Your software team answered two of your written reviews — the **Reception review** and the **Waiter / Restaurant & Bar review**. Everything listed below is already built, tested and working. This document explains, in plain words, what the problem was, what we changed, and what it means for you day to day.

## 2. Reception — reservations and the guest's room bill

### 2.1 — The guest's room bill now shows every night
**The problem:** the bill could show a single line called "RENTAL CHARGES" instead of each night, and the figures on screen did not always update right away when something changed.

**What changed:** the bill now shows **one line for every night** (for example "Room 101 · Rent 24/09/2026"). Every figure — the balance next to the guest's name, the summary at the top and the bill table — **updates the moment anything changes**: the dates, the room rate, or the guest's details and e-mail.

**What it means for you:** correct figures, no old totals left behind, no mystery lines.

### 2.2 — A payment made before check-in no longer looks like a check-in
**The problem:** adding a payment for a customer who is only *booked* (not yet staying) used to change the row from red to green, as if they had checked in.

**What changed:** the row only turns green when the guest is **actually checked in**. A customer who paid but has not arrived still shows as "booked".

### 2.3 — Future-dated bookings cannot be checked in early
**What changed:** a reservation for, say, 26/09/2026 cannot be checked in before that date arrives.

### 2.4 — Management can now test and use the management-only actions
**The problem:** the review noted there was nowhere for the manager to test management-only actions (cancelling a reservation, editing room charges) — "no dashboard at manager page".

**What changed:** managers, accountants and hotel admins now land on the main Dashboard after signing in, and that is exactly where those management-only actions live. Cancelling (voiding) a reservation, editing room charges and fixing a folio after check-out are all available there — and never visible to reception or waiters.

### 2.5 — "TOTAL PAID" shows only money actually received
**The problem:** applying a discount or a negative adjustment was making "TOTAL PAID" go up, which was wrong.

**What changed:** discounts and refunds now reduce the **balance owed**, while "TOTAL PAID" counts only real money received (payments plus the booking deposit).

### 2.6 — Room-charge edits and voids are clear, and management-only
**The problem:** after editing or cancelling a room charge, an old "RENTAL CHARGES" line could reappear at the old full price.

**What changed:** that duplicate line is gone — the bill shows exactly the nights still owed. Only managers/accountants can edit or cancel room charges, and it now also works correctly for guests who are booked but not yet checked in. When a charge is changed on screen, the audit trail shows the **person's name**, not a technical code.

### 2.7 — Splitting and transferring bills no longer gets confusing
**The problem:** after a split or a transfer, clicking one bill could make the other's balance show zero; a payment on one bill could make the other's balance go negative; and a transferred bill kept a confusing "related folio" tag.

**What changed:**
- Each bill keeps and shows its own balance — nothing turns to zero when you look at the other one.
- Money (payments, charges, inclusions, discounts) is always added to the bill **you are actually looking at**.
- When a bill is **transferred** to another guest, the "related folio" tag disappears; when a bill is **split** (same party, two bills), each bill keeps its tag and its own totals.
- After a split, each separate bill can be **printed or e-mailed on its own** — two independent invoices.

### 2.8 — Invoices print properly and e-mails give clear messages
**The problem:** "Print invoice" silently downloaded a file with no layout, and sending an invoice by e-mail just said "server error".

**What changed:** "Print invoice" now opens a clean, well-laid-out printable page (proper margins, hotel name at the top). Sending by e-mail now tells you clearly if the customer's e-mail address is wrong, if the e-mail service failed, or if there was a network problem — no more bare "server error".

### 2.9 — Posting a balance to the creditors account is clear
**What changed:** if the hotel has a creditors account set up, an unpaid balance posts to it; if not, the screen says exactly that. If there is nothing owing, it says "This folio has no outstanding balance to post." The two situations are no longer confused.

### 2.10 — What the "−" sign in the bill means
**What changed:** inside the Folio Operations section on the guest's bill, a small note now explains the "−" sign, so no one has to guess:
- a "−" before an amount means **money received** (a payment, discount or refund);
- a "−" on the **balance** means the guest has **paid more than their charges** — the difference is a credit on the bill.

This makes the figures on the bill clear for reception, management and the guest alike.

## 3. Restaurant & Bar — waiters, kitchen, cashier and management

### 3.1 — A waiter's screen shows only what a waiter does
**The problem:** waiters could see buttons that belong to the kitchen or bar — start cooking, the ready bell, the "served" tick, voideing, finishing — when the review said the panel should only show **RUNNING** or **SETTLED**.

**What changed:** those kitchen/bar buttons have been **removed from the waiter's screen** (and protected, so a waiter cannot trigger them by other means). The waiter still:
- places orders,
- adds items while the table eats,
- picks their own occupied tables,
- reopens a **closed** order to see what was ordered and reprint the bill (marked as a reprint / closed order),
- and receives the signal when the kitchen says the food is ready.

### 3.2 — Management can open the cashier/bartender panel — and the VOID button is theirs
**The problem:** management wanted to see the same panel as the cashier or bartender — Order Summary, Room Service, Delivery Manager — and to be the only ones able to VOID a closed or paid bill.

**What changed:** hotel admins and managers can now open the cashier/bartender panel. On paid or closed bills, a **VOID button appears next to the reprint button** — always with an "are you sure?" confirmation and asking for a reason.

When management voids a paid bill, the payment is **refunded**, and if the bill was charged to a room the room charge is **released** — so the day's reports stay correct, even after the day is closed. Waiters and cashiers **cannot** void a settled bill; only management can.

### 3.3 — Merging two tables into one bill — no more fake "voided"
**The problem:** when a bar order and a restaurant order were put together, the old order appeared as a "voided" entry on the cashier's panel, which was misleading.

**What changed:** combining two tables into one bill now simply finishes the old order quietly. It never shows up as voided, and the combined bill stays correct on the table it was moved to — still payable as ONE bill.

### 3.4 — The restaurant dashboard lists are now up to date
- **LOW STOCK:** the list now reads the correct shelf, and updates the moment the store accepts a delivery of an item. Items such as juices will no longer sit at "0" after they have been received.
- **FAST MOVING:** the list updates by itself as orders come in — no need to refresh the page.

## 4. A small fix to the Menu Item Sales report

In the Menu Item Sales Summary report, the "department" headings and the department filter now show proper words (Restaurant, Bar, and so on) instead of technical codes.

## 5. How do I know it works?

Every change above is built and protected by automated tests — the software team's regression suites stay green after each change (835 backend checks and 229 frontend checks). All of it is already in the live system.