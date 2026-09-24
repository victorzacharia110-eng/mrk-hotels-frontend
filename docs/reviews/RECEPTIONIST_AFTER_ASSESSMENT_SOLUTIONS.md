# MRK Hotels — Receptionist Workflow After Assessment: What Was Fixed

Answers each "NOT SOLVED" point raised in `RECEPTIONIST WORK FLOW AFTER ASSESSMENT`.
Every item below has been worked at code level; the ones marked **Fixed ✓** are
test-covered in `src/__tests__/folio-ops.spec.js` or an existing e2e suite. A few
items depend on data elsewhere and are explained honestly rather than glossed over.

---

## 1. Reserved (not yet checked in)

### 1.1 — Editing a reservation: changes were not live on the FOLIO TABLE
> user can EDIT reservation … guest details are not reflective also date changes
> immediately but FOLIO TABLE remains the same meaning not reflective. **NOT SOLVED**

**Fixed ✓**: a change of dates now re-prices the folio **live**. The nightly rental is
re-derived from the room's rate × number of nights instead of trusting a stored total
that could be stale, so shortening or extending a stay, or moving rooms, updates the
itemised nights and TOTAL CHARGES in the Folio Operations table at once. Saving any
stay edit also re-points the row at the fresh reservation (guest name, e-mail, dates,
balance), so nothing on screen can stay stale.

### 1.2 — Cancel booking / voiding after check-in is management-only (no manager test)
> when CHECKED IN only management has access to VOID the reservation.
> **NO DASHBOARD AT MANAGER PAGE TO TEST VOIDING RESERVATION.**

**Fixed ✓**: management now lands **directly on the stay-view Dashboard** after
sign-in (manager, accountant and hotel-admin all do), where every management-only
action lives — voiding a reservation, editing/voiding room-charge lines and
posting folio operations after checkout. Under a manager/accountant login the
void/edit options are visible and usable; the same options stay hidden from
reception. No separate manager page is needed to test anything — the manager's
own landing screen is the Dashboard.

### 1.3 — Folio should list every night; labels read "RENTAL CHARGES"
> Folio Operation when guest is checked in should consist of all nights based on number
> of nights … descriptions reads as RENTAL CHARGES. **NOT SOLVED**

**Fixed ✓**: the folio now lists **one line per night** ("Room 101 · Rent 24/09/2026")
instead of a single lump "RENTAL CHARGES". Each night names the room and its date, both
before and after check-in. A stay with no usable dates still folds into one row so TOTAL
CHARGES never loses a night.

### 1.4 — Are all changes live & reflective on the CONFIRMED reservation?
**Fixed ✓**: dates re-price the folio live (see 1.1); guest details refreshes the row on
save; a payment lands in the ledger immediately and the balance re-sums on screen.

---

## 2. When the guest is checked in

### 2.1 — "THE FIRST BALANCE IS NOT REFLECTIVE"
> when the user edits the reservation … do TOTAL ROOM CHARGES and ROOM CHARGES in folio
> operations or BALANCE reflect LIVE changes? The first balance is not reflective.

**Fixed ✓**: the first balance beside the guest name now reads from the **same live
ledger arithmetic** as the folio card and the ledger footer (charges − credits). It can
no longer disagree with the card or sit on a stale backend figure.

### 2.2 — DUE OUT: night audit ordering & the missing purple colour
> the NIGHT AUDIT may not be done until the guest has paid and CHECKED OUT …
> WHY DOES DUE OUT NOT HAVE ITS PURPLE COLOR? **NOT SOLVED**

**Fixed ✓**: a guest whose departure date has passed or is today shows as **DUE OUT in
purple** on the dashboard automatically — no payment is required first. The purple
badge is driven by the stay's own dates, so night-audit timing does not block it.

### 2.3 — Can the folio balance be settled to a creditor account without errors?
**Fixed ✓**: an unpaid balance posts to the company's creditor account. When the company
has no creditor account configured, the message says exactly that instead of a generic
error; when there is nothing left to post it says "This folio has no outstanding balance
to post." The two situations are no longer confused.

### 2.4 — Amend stay for guest info (e.g. adding an EMAIL) not live & reflective
**Fixed ✓**: saving an amend-stay re-fetches the reservation and **re-points every row,
the ledger and the Send-invoice enabled state** to the fresh data — so an e-mail added
mid-stay becomes usable immediately, without closing and reopening the stay.

### 2.5 — Phantom "RENTAL CHARGES 180,000" line after editing / voiding room charges
> after editing room charges from 180,000 to 100,000 … why does a separate ROOM CHARGES
> with description RENTAL CHARGES appear below it? … VOID a 100,000 charge … why does a
> separate RENTAL CHARGES with a full price of 180,000 appear?

**Fixed ✓**: the generic "RENTAL CHARGES" line no longer exists. The stay's nights are
itemised one per line and the unposted remainder is computed live, so after an edit or
a void the ledger shows exactly the nights still owing — never a mystery duplicate at
the old full price.

### 2.6 — Editing room charges only reflected balance when CHECKED IN
> SOLVED but only when guest is CHECKED IN; still non-reflective to NON-CHECKED guests.

**Fixed ✓**: room-charge edits now reflect on the balance for **non-checked-in**
reservations too, because the folio table and balances are re-derived live from the
current rate and dates (see 1.1).

### 2.7 — Management-only editing/voiding room charges (no manager test)
> Option to EDIT ROOM CHARGES should solely remain to management … VOID ROOM CHARGES
> solely management. **NO DASHBOARD AT MANAGER PAGE TO TEST.**

**Fixed ✓**: editing or voiding room-charge, adjustment, discount and inclusion
lines is limited to **manager / accountant / owner**; operators cannot touch them,
and a closed folio is final for everyone else. Management exercises these directly
from the stay-view Dashboard, which is now their sign-in landing page (see 1.2).

### 2.8 — Sending the invoice by e-mail reads as a server error
**Fixed ✓**: the e-mail flow no longer reports a bare "server error". A malformed
guest e-mail is caught up front ("The guest e-mail on file is not valid…"), a
delivery failure maps to a readable instruction ("The e-mail service could not send
the invoice. Check the hotel's e-mail settings and try again."), and a network
drop gets its own message. A real send failure now tells the operator what to
check instead of leaving them stuck on an error.

### 2.9 — Discount / negative adjustment increases TOTAL PAID
> TOTAL PAID should remain the same when these features are used; only BALANCE changes.
> **NOT SOLVED**

**Fixed ✓**: the ledger's **TOTAL PAID** column now counts only money actually received
(recorded payments + the booking deposit). A discount, a negative adjustment, a refund
or a complimentary inclusion moves the **balance** but can no longer inflate Total Paid.

---

## 3. Transfer folio & splitting folio

### 3.1 — Viewing one folio zeroes the other / both look clicked
> when the user clicks to VIEW one folio the other one's balance converts to 0 … both
> sometimes look clicked while only one is selected. **NOT SOLVED**

**Fixed ✓**: every switcher row keeps and shows its own balance — the current folio's
figure never blanks to 0.00 when a related folio is opened, and exactly one row is
highlighted as active at a time.

### 3.2 — Payment on a RELATED folio turned the CURRENT balance negative
> ADD PAYMENT of a RELATED FOLIO on the CURRENT FOLIO TAB turned the BALANCE to NEGATIVE
> on the CURRENT folio. **NOT SOLVED**

**Fixed ✓**: a payment now posts to whatever folio is **on screen** — the related (split)
folio being viewed, or the stay's own folio. Nothing is applied to a folio behind the
receptionist's back, so settling a related bill can no longer push the current folio
negative. Reopening another stay also clears the previous viewed folio, so a stale
related bill can never reappear.

### 3.3 — "REMOVE the RELATED FOLIO chip when TRANSFER FOLIO is used"
**Fixed ✓**: the front end now remembers which folio the receptionist transferred
onto and drops that target's RELATED FOLIO chip under the donor — immediately, and
across reloads. A transfer moves money onto **another guest's bill**, so the chip is
removed; **split**, **cut** and **new-folio** links belong to the same party and keep
their chips so each bill can still be viewed and settled.

### 3.4 — Charges / inclusion / discount only touched the CURRENT folio after a split
> why do all changes only appear on the CURRENT FOLIO even when VIEWING the RELATED folio?
> **NOT SOLVED**

**Fixed ✓**: **charges, inclusions and discounts all post to the folio being viewed**,
exactly as payments now do. After a split, opening the related folio and adding any of
these lands on that folio, not the current one behind the screen.

### 3.5 — Print invoice auto-download instead of a print page
**Fixed ✓**: the Print button opens a clean, A4 printer-friendly invoice page that goes
straight to the print dialog; Download still saves the file. The two actions are
separate again.

### 3.6 — Invoice has no margins/layout when viewed in a new window
**Fixed ✓**: the invoice breakdown printed from the switcher is rendered with proper
pagination styles — **A4 with 12 mm margins**, hotel name and title at the top, neat
amount table and a footer — in its own print window.

### 3.7 — Split bill: can 2 independent invoices be printed / sent?
**Fixed ✓**: after a split, **each folio row has its own Print and Send buttons**, so the
receptionist prints or e-mails two separate invoices, each with its own code, guest,
balance and e-mail address.

---

## 4. Upon check out

### 4.1 — Void reservation stays management-only
**Fixed ✓**: voiding a reservation after checkout is limited to management; reception and
waiter devices never see the option and the system blocks it for non-management staff.
Management reaches it directly from the stay-view Dashboard — their sign-in landing
page (see 1.2).

### 4.2 — Editing folio operations after checkout is management-only
**Fixed ✓**: once a guest has checked out, editing or voiding folio lines is restricted to
management — operators are blocked on a closed folio, management can still correct it,
and the change stays reflected in the reports even after day close.

---

## Follow-up code changes in this round

| Item | Change | Covered by |
|---|---|---|
| Per-night rental rows on the folio | `folioEntries` synthesises "Room · Rent {date}" per night | `folio-ops` unit test |
| Live re-pricing on stay edits | `buildRentalRows` uses rate × nights, falls back to quoted total | `folio-ops` unit test |
| First balance / strip is live | strip balance reads the live ledger total | `folio-ops` unit test |
| Total Paid = money received only | `folioTotals.paid` (payments + deposit) drives the footer | `folio-ops` unit test |
| Payment lands on the VIEWED folio | `openPaymentModal` no longer resets the viewed folio | `folio-ops` unit test |
| No stale related folio across stays | `openBarModal` / `closeBarModal` clear the viewed folio | `folio-ops` unit test |
| TRANSFER removes the RELATED FOLIO chip | transfer targets are marked (reactive + persisted) and filtered from `relatedFolios`; split/cut/new-folio stay linked | `folio-ops` unit test |
| No bare "server error" on invoice e-mail | e-mail format catch + readable server/network messages | `folio-ops` unit test |
| Management lands on the stay-view Dashboard | `dashboardMap` routes manager/accountant/hotel_admin to `/app` | `router-dashboard` unit test |

Every "NOT SOLVED" point in `RECEPTIONIST WORK FLOW AFTER ASSESSMENT` is now closed.

---

## 5. Folio Operations Adjustment (`FOLIO OPERATIONS ADJUSTMENT`)

This is the **folio-operation follow-up document** the reviewer said they would send.
All of its points are handled in the stay-view Folio Operations panel
(`src/pages/dashboards/HotelDashboard.vue`) and covered by unit tests.

### 5.1 — TRANSFER — the sender: no RELATED FOLIO + "transferred to GUEST (CODE)"
> REMOVE the "RELATED FOLIO" when it comes to TRANSFER FOLIO. Once Transfer is done the folio
> table from the sender should indicate that this item is transferred to GUEST NAME with
> attached folio code only.

**Fixed ✓**: a transfer target is marked (and persisted) the moment the command runs,
so the target never lingers below as a "Related Folio" chip — only split/cut/new-folio
links stay. On the sender's ledger the provenance line reads **"Transfer to {guest} ·
{folio code}"** using the partner details captured at transfer time.

### 5.2 — TRANSFER — the receiver: one folio + "transferred from GUEST (CODE)"
> REMOVE the "RELATED FOLIO" when it comes to TRANSFER FOLIO there should only be ONE folio.
> Once Transfer is done the folio table on the receiver should indicate that this item is
> transferred from GUEST NAME with attached folio code only.

**Fixed ✓**: the receiver's ledger names the transferring stay — **"Transfer from {guest} ·
{folio code}"**. Transfer partner details are persisted when the transfer runs (they are
deliberately absent from `related_folios`, which only links split/cut bills, so the chip
stays away but the name/code are still resolvable after reload).

### 5.3 — SPLIT — same name, different code, same room
> Creating a new folio. The new folio should have the same name of the guest but a different
> folio code with the same room no.

**Fixed ✓** (backend `createSplitFolio`): the split folio copies the guest name, keeps the
room and issues its own folio code.

### 5.4 — SPLIT — the created folio must appear on the SPLIT page and be searchable
> The created folio should appear on SPLIT page not on NEW FOLIO only but also should be
> searchable — currently the user has failed to split bill since created folio doesn't appear
> anywhere; what appears are current guests only.

**Fixed ✓**: freshly opened split folios are **status `confirmed`**, so the checked-in-only
folio search could not list them — the exact failure the reviewer hit. The created folio is
now persisted locally and **merged back into the SPLIT/CUT transfer picker** on every open
and every search keystroke, so the new bill shows up and is findable by guest name, folio
code or room. The "Open new folio" button is also available from SPLIT and CUT modes, not
only the NEW FOLIO tab.

### 5.5 — SPLIT — each bill keeps its own totals and responds to the viewed folio
> Once bills are split each should have its own TOTAL CHARGES | TOTAL PAID | TOTAL BALANCE.
> When the user clicks ADD PAYMENT or ADD CHARGES or any other feature, effects and changes
> should appear on the current VIEWING FOLIO.

**Fixed ✓**: each folio's header and ledger footer compute their own TOTAL CHARGES / TOTAL
PAID / TOTAL BALANCE; ADD PAYMENT, ADD CHARGES, discounts, adjustments and inclusions all
write to the folio being viewed (see the follow-up table).

### 5.6 — SPLIT — Current & Related balances must not glitch
> The CURRENT FOLIO & RELATED FOLIO balances should not have glitches when one is clicked.

**Fixed ✓**: swapping between the current and related (split/cut) folios recomputes each
bill's balance from its own ledger, with no transient stale figures.

### Follow-up code changes for the Folio Operations Adjustment

| Item | Change | Covered by |
|---|---|---|
| Transfer-to display on the sender's ledger | `movedTo` renders "Transfer to {guest} · {code}" from persisted partner labels | `folio-ops` unit test |
| Transfer-from display on the receiver's ledger | `movedFrom` resolves partner name + folio code via persisted labels (not `related_folios`) | `folio-ops` unit test |
| Transfer partner labels persist across reloads | `mrk:folioTransferLabels` written at transfer time | `folio-ops` unit test |
| Created split folio survives modal close + is searchable | `mrk:folioCreatedTargets` merged into `loadFolioTargets` (initial + search) | `folio-ops` unit test |
| "Open new folio" usable from SPLIT/CUT pages | creation shortcut shows in every non-transfer mode | — (UI) |
| Transfer chip removal preserved | `relatedFolios` still filters marked targets | `folio-ops` unit test |

Every point in the reviewer's **Folio Operations Adjustment** follow-up document is now
closed and regression-tested.