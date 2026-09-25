# MRK Hotels — Reception's Adjustments (Transfer & Split): What Was Done

Answers every open point in `RECEPTION'S ADJSUTMENTS TO BE DONE`. The items already
marked **SOLVED** in that document stay solved; the three open items below — the
double deduction on transfer, the split folio showing extra room charges, and the
plain invoice — are now **Fixed ✓** at code level and covered by automated tests in
`src/__tests__/folio-ops.spec.js`.

---

## 1. Folio items transfer — the sender's balance deducts once

### 1.1 — Transferring an item must deduct its value ONCE from the sender
> When user Transfers a folio item … the math on the receiver side is great but the
> math on the sender side is NOT CORRECT … it deducts double the amount meaning
> TZS 10,000/= instead of TZS 5,000/=. **NOT SOLVED**

**Fixed ✓**: a transfer (or split/cut) leaves a "Moved to <guest> (<folio code>)"
book-keeping row on the sender's bill. That row helps staff see where the money went,
but it is a **record only** — the money already left the sender through the moved
lines themselves. Previously the ledger counted it a second time as a credit, so a
5,000 transfer looked like a 10,000 deduction. The provenance row now **renders but
is balance-neutral**: the sender's balance falls by exactly the moved amount and the
receiver's rises by exactly that amount.

## 2. Folio items split — the new bill holds only its own items

### 2.1 — The split/new folio must only carry the split item
> the user tested the SPLIT feature by transferring ROOM POSTING worth TZS 5,000/=
> but upon checking on the new folio made room charges also tend to appear while the
> user only splitted one thing only ROOM POSTING. **NOT SOLVED**

**Fixed ✓**: the new folio shares the room (and therefore the room's nightly rate)
with the original stay, so the bill-builder was **inventing the full rental** on top
of the item actually moved. A split/new folio carries no bill of its own until items
are moved onto it, so no nightly rental is ever generated for it. Only the moved
items build its balance.

### 2.2 — The original bill must not re-add a night it just moved away
> The CURRENT FOLIO & RELATED FOLIO balances should not have glitches when one is
> clicked. **NOT SOLVED**

**Fixed ✓**: on the original bill, a rent night that was moved onto the new folio is
**not reconstructed** by the nightly line-builder (the moved value is accounted for
through the provenance row). Each of the two bills on the same guest now shows exactly
what it holds, whichever one you click first.

## 3. Invoice format

### 3.1 — The printed invoice is a proper company bill again
> Why does it not have company name? Not Color full? Does not resemble folio operation
> details & particulars nor date? … retain former invoice format with company name &
> and all details but with proper margins also match all folio operations. **NOT SOLVED**

**Fixed ✓**: "Print invoice" now opens a full, branded A4 invoice:

- **Company block** — hotel name, city/country, phone, e-mail and tax/VAT numbers,
  plus the hotel logo when one is set.
- **Brand colours** — navy band and blue accent, matching the system's identity.
- **Guest particulars** — folio number, guest name, room, check-in and check-out
  dates, and the date/time the invoice was printed.
- **Every Folio Operations line** — date, particular, description and amount,
  including payments and refunds shown as minus, in the same order as the bill on
  screen.
- **Totals** in Folio Operations wording — TOTAL CHARGES / TOTAL PAID / BALANCE —
  with the balance figure emphasised.
- Clean **margins** on A4 and a footer naming who printed it and when.

---

## How it is verified

- `npx vitest run src/__tests__/folio-ops.spec.js` — **37 tests**, including the new
  transfer double-deduction, split-folio rent, and branded-invoice checks.
- Full frontend regression suite: **233 tests green**; ESLint clean.