# MRK Hotels — Understanding the Latest Updates (Client Edition)

**For the management and staff of MRK Hotels** — **5 September 2026**

---

## 1. What is this document?

Your software team made a set of improvements across three parts of the MRK Hotels system: the **restaurant/waiter area**, **housekeeping**, and **laundry**. This packet explains each change in everyday language — what the problem was, what we changed, and what it means for you and your hotel.

Everything in this packet is already built and tested. A companion packet for your developers gives the technical details.

## 2. The changes at a glance

| # | Area | What changed | Why it matters to you |
| --- | --- | --- | --- |
| 1 | Restaurant (waiting staff) | The waiter is now notified the moment the kitchen finishes an order item | Food leaves the kitchen sooner — guests get their meals hot |
| 2 | Housekeeping (navigation) | Housekeeping staff only see the menus they actually use | Less confusion, faster daily work |
| 3 | Housekeeping (reports) | The Excel/CSV export is now clean and properly laid out | Reliable daily reports and handover sheets |
| 4 | Laundry (price list) | Your hotel can keep a proper laundry price list, and the system now uses it automatically | Consistent, correct prices every day |
| 5 | Laundry (settling bills) | Bills can only be posted to a room the guest is actually staying in, with a clear settle step | No phantom charges; correct guest bills |

## 3. What you will notice

- **Restaurant:** your waiters no longer have to keep checking the kitchen screen — the system flags "READY" in green the moment an item is done.
- **Housekeeping:** when a housekeeper logs in they see only Dashboard, Housekeeping, Laundry, Issue Reports and Communication (with Room Status). No more restaurant or games menus in their way.
- **Reports:** the housekeeping export now downloads as a tidy spreadsheet with clear columns (room, type, pax, cleaning status, assigned staff, occupancy, arrival, departure, nights, status).
- **Laundry:** your attendants choose the item type from your price list (e.g. "Bed sheet") and the system fills in the correct price automatically. You can add or edit cloth types and prices at any time from the Laundry page.
- **Laundry bills:** at settlement your staff consciously choose *Mark as paid* or *Post to room*. The system will not add a charge to a room unless the guest is actually staying in it.

## 4. A quick word on the laundry price list

To get the full benefit of the price list:

1. Open **Laundry → Cloth Types**.
2. Add the items you launder (for example *Bed sheet*, *Towel*, *Table cloth*), each with:
   - a **wash price**,
   - an **iron price**,
   - a **dry-clean price** (if applicable).
3. From then on, choosing that item in an order automatically uses those prices.

Until you add cloth types, your staff can keep entering items by hand exactly as before — nothing breaks.

## 5. Document index

- `MRK_Hotels_Client_Understanding_01_Restaurant_Waiter_Notifications.pdf` — the kitchen-to-waiter "ready" signal.
- `MRK_Hotels_Client_Understanding_02_Housekeeping_Sidebar.pdf` — a cleaner menu for housekeepers.
- `MRK_Hotels_Client_Understanding_03_Housekeeping_Export.pdf` — a reliable spreadsheet export.
- `MRK_Hotels_Client_Understanding_04_Laundry_Price_List.pdf` — the cloth-type price list.
- `MRK_Hotels_Client_Understanding_05_Laundry_Bills.pdf` — correct, controlled room billing.