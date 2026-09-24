# MRK Hotels — Changes Summary: Reception & Folio, Waiter & Cashier Rounds

One consolidated record of every item worked at code level across the two
assessment rounds. Everything is committed and pushed to the repositories, and
the regression suites stay green (backend 835 tests / 4,055 assertions;
frontend 229 unit tests).

---

## 1. Receptionist & Folio round

Answers the reviewer's `RECEPTIONIST WORK FLOW AFTER ASSESSMENT` plus the
`FOLIO OPERATIONS ADJUSTMENT` follow-up.

| # | Issue | What was solved |
|---|---|---|
| 1 | EDIT reservation while not checked in — not live / FOLIO TABLE unchanged | Stay edits re-price the folio live (rate × nights) and refresh the row on save |
| 2 | ADD payment before check-in flips RED→GREEN as if checked in | Reserved-and-unpaid guests keep their colour until actually checked in |
| 3 | CANCEL/VOID reservation — "NO DASHBOARD AT MANAGER PAGE TO TEST" | Management lands on the stay-view Dashboard at sign-in; void reservation lives there |
| 4 | CHECK IN accepts a future-dated reservation | Future-dated bookings cannot be checked in |
| 5 | Folio should list every night, not a lump "RENTAL CHARGES" | One line per night ("Room 101 · Rent {date}") |
| 6 | All changes live & reflective on a confirmed reservation | Balance re-sums from the live ledger the moment anything changes |
| 7 | "THE FIRST BALANCE IS NOT REFLECTIVE" | Strip balance reads the same live ledger arithmetic as the folio card/footer |
| 8 | DUE OUT: night-audit ordering + missing purple colour | DUE OUT shows purple automatically from the stay dates |
| 9 | Post folio balance to creditors — errors / message confusion | Clear messages: no creditor account configured vs. nothing left to post |
| 10 | Amend stay (e.g. add EMAIL) not live | Saving re-fetches the reservation and re-points rows, ledger and Send-invoice |
| 11 | Phantom "RENTAL CHARGES" line after editing/voiding room charges | Nights itemised per line; remainder computed live — no duplicate at old price |
| 12 | Room-charge edits only reflected when CHECKED IN | Non-checked-in folios re-derive balances live too |
| 13 | EDIT/VOID room charges management-only, no manager dashboard | manager/accountant/owner only, from their sign-in Dashboard |
| 14 | Payment description "edited by <UUID>" | Reads "Edited by ALLY ATHUMAN" |
| 15 | Invoice by e-mail reads as a bare "server error" | Malformed e-mail / server / network failures each get a readable message |
| 16 | Discount / negative adjustment increases TOTAL PAID | Total Paid counts money received only; discounts/refunds move balance |
| 17 | Viewing one folio zeroes the other / both look clicked | Each switcher row keeps its own balance; exactly one active |
| 18 | Payment on a RELATED folio made CURRENT balance negative | Payments (and all entries) post to the folio on screen |
| 19 | "REMOVE the RELATED FOLIO chip when TRANSFER FOLIO is used" | Transfer drops the chip (reactive + persisted); split/cut keep theirs |
| 20 | Charges/inclusion/discount only touched CURRENT folio after split | All post to the folio being viewed |
| 21 | Print invoice auto-downloads | Print opens the print dialog; Download saves the file |
| 22 | Invoice has no margins/layout in a new window | A4 with 12 mm margins, hotel name/title, amount table and footer |
| 23 | Split bill: two independent invoices printable AND sendable | Each folio row has its own Print and Send |
| 24 | After checkout: void reservation management-only | Operators blocked; management uses the stay-view Dashboard |
| 25 | After checkout: editing folio operations management-only | Closed folio is final for operators; management can still correct it |
| 26 | Folio Operations Adjustment follow-up | All points closed and regression-tested (transfer chip, per-night rows, viewed-folio posting, split totals) |

## 2. Waiter & Cashier / Bartender round

Answers the reviewer's `WAITER WORK FLOW ASSESSMENT & NEW RESOLUTION`.

| # | Issue | What was solved |
|---|---|---|
| 1 | Management page on Restaurant & Bar should resemble the cashier/bartender panel (Order Summary \| Room Service \| Delivery Manager) with VOID accessible to management | `/cashier` opens to `hotel_admin` and `manager`; VOID available on settled bills |
| 2 | Welcome "USERNAME + CONTINUE" tab is a time-waster | Welcome modal removed |
| 3 | Cannot add an order to an occupied table the same waiter occupied | Own occupied tables are selectable |
| 4 | Picking menu items first, then a table, resets the picked items | Selection no longer clears |
| 5 | Merge items from 2 tables into ONE printable bill | Single merged bill; appears on the side/table it was transferred to |
| 6 | Waiters can set ORDER IS READY / SERVED — should only be RUNNING or SETTLED | START PREPARING, bell, dish, item-advance, VOID and COMPLETE removed from waiters |
| 7 | Closed orders: view items + reprint KOT marked CLOSED | Closed orders viewable; KOT reprint watermarked CLOSED ORDER |
| 8 | VOID on settled orders (cashier panel, beside reprint, confirm, management-only, reflective after day close) | VOID beside reprint (row + drawer) with confirm + reason; management-only; refunds payment / releases room charge |
| 9 | Transferring bar items into restaurant becomes an AUTOMATIC VOID SETTLEMENT | Merged source closes as terminal MERGED (never VOIDED); excluded from all live surfaces |
| 10 | LOW STOCK tab not reflective after issuing & accepting an indent (AZAM JUICE reads 0) | Department-aware stock read + refresh event on indent accept |
| 11 | Is FAST MOVING ITEMS tab reflective / live? | Reloads on tab entry and refreshes live on order/stock pushes |

## 3. POS Report fix (final round)

| # | Issue | What was solved |
|---|---|---|
| 1 | Menu Item Sales Summary shows a raw POSREPORTS.DEPARTMENTS key | `departmentLabel()` matches the locale map case-insensitively (restaurant/bar) and falls back to the department name for custom departments — group headers and the department filter translate correctly |

## 4. Where the fixes live

| Area | Frontend (mrk-hotels-frontend) | Backend (mrk-hotels-api) |
|---|---|---|
| Folio / reception | `HotelDashboard.vue`, `router/index.js`, `folio-ops.spec.js`, `router-dashboard.spec.js`, POS report browser | invoices, folio/charge endpoints (prior rounds) |
| F&B orders | `OrderTakerDashboard.vue`, `CashierOrderSummaryPage.vue`, `router/index.js`, locales | `OrderController`, `OrderOptions`, `FbDayClose`, `Cashier`, `PosShift`, `ReportController` |
| Stock (LOW STOCK / indent) | dashboard live-tab wiring | `IndentService`, `ReportController`, `IndentController` |
| POS reports | `PosReportBrowserPage.vue` | — |

Regression suites stay green after every change: backend **835 tests (4,055
assertions)**, frontend **229 unit tests**; `php -l`, oxlint and ESLint are
clean.