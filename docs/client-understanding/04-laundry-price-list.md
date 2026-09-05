# Understanding the Update · 4 — Laundry: Your Own Price List

**For the management and staff of MRK Hotels** — **5 September 2026**

---

## 1. What was the problem?

Laundry items were typed in **by hand with the price entered manually every time**. There was no official price list in the system.

**What that meant for you:**

- The same item could be charged different prices on different days or by different staff.
- Guests could be over- or under-charged without anyone noticing.
- The hotel had no clear record of what it launders and at what price.

## 2. What did we change?

- Your hotel now has its own **Cloth Types price list** in the Laundry section.
- For each cloth type (e.g. *Bed sheet*, *Towel*, *Table cloth*) you set up to three prices:
  - **Wash price**
  - **Iron price**
  - **Dry-clean price**
- When a new laundry order is entered, your attendant **picks the cloth type from the list** and the system **fills in the correct price automatically** for the service chosen.
- Changing the service (wash → iron → dry-clean) **re-prices the order automatically**.
- Prices are protected: staff cannot accidentally type a different price for a listed item.

## 3. Why it matters to you

- **Consistent prices.** Every guest pays the same price for the same item — every time.
- **Easy to manage.** You can add, change or disable cloth types at any time from the Laundry page — no developer needed.
- **Better reports.** Consistent item names mean laundry reports make sense.

## 4. What you need to do (once)

To enable this, add your cloth types once:

1. Go to **Laundry → Cloth Types**.
2. Click **Add**, enter the item name and its wash / iron / dry-clean prices, and save.
3. Repeat for each cloth type you offer.

Until you add any, your staff can keep entering items by hand **exactly as before** — nothing is blocked.

## 5. Summary

| Question | Answer |
| --- | --- |
| Where is the price list? | Laundry → Cloth Types |
| How many prices per item? | Up to three — wash, iron, dry-clean |
| Who can manage it? | Your manager with the laundry permissions |
| What if we don't add cloth types? | The order form stays exactly as it is today |
| Can staff still overtype a price? | No — for listed items, the system price is used automatically |