# MRK Hotels - Reception Panel Changes Guide

*For Non-Technical Staff | Source document: "RECEPTIONIST PANEL DESIGN AND LOGIC TO BE UPDATED"*

For each request below you will see the **Problem** (written as in the client PDF), the **Solution** delivered, and **Where** to find it in the system. All changes are visible to the reception / front-desk staff.

## 1. ROOMs Page - Inventory Summary & Calendar

- **Problem:** "When receptionist clicks ROOMs the default page is INVENTORY currently in MRK the inventory page is a list of rooms registered... By [room type] ... bottom totals SOLD ROOMS / ROOMS AVAILABLE / TOTAL ROOMS ... a calendar-themed page ... the business date ... should be the first column after room number."
- **Solution:** The Inventory tab now summarises rooms by **room type** and shows totals **SOLD ROOMS / ROOMS AVAILABLE / TOTAL ROOMS**. A new **Availability Calendar** (rooms down the side, days across) puts the **business date in the first column**. The plain room register remains on its own tab.
- **Status:** DONE
- **Path to find:** -> Dashboard -> ROOMs -> Inventory (Summary Totals + Availability Calendar)

## 2. Dashboard Rooms Rows Spacing

- **Problem:** "Reduce the spacing between the dashboard room rows."
- **Solution:** Room rows on the Dashboard chart are tighter, so more rooms fit on one screen.
- **Status:** DONE
- **Path to find:** -> Dashboard -> Rooms Chart (Tighter Rows)

## 3. Business Date

- **Problem:** "Instead of writing the word BUSINESS DATE replace it with the actual BUSINESS DATE in numbers; the business date should be clickable as well meaning by clicking it opens a calendar... the business date on the calendar page ... should be the first column after room number."
- **Solution:** The toolbar now shows the real business date in numbers (for example **09/10/2026**) and it is **clickable** to open a calendar. On the chart the business date is the first day column after the room number.
- **Status:** DONE
- **Path to find:** -> Dashboard -> Top Toolbar -> Business Date Figure (Click To Open Calendar)

## 4. Number Of Guests (And Booking Type)

- **Problem:** "Upon registering a guest there is a REQUIREMENT to fill which type of booking it is: SINGLE BOOKING = 1 GUEST, COUPLE BOOKING = 2 GUESTS, FAMILY BOOKING = 3-5 GUESTS. Replace the profile name of the LOGGED IN USER with the TOTAL number of GUESTS from all checked in guests in the house of the particular BUSINESS DATE."
- **Solution:** The booking form has a **Booking Type** (Single = 1, Couple = 2, Family = 3-5, Group) that sets the guest count. On the Dashboard the logged-in user's name was replaced by the **total number of guests** staying on the business date.
- **Status:** DONE
- **Path to find:** -> Dashboard -> + New Booking -> Booking Type | Dashboard -> Top Bar -> Guests In House Count

## 5. Top Panel And Side Bar Rearrangement

- **Problem:** "The top panel has the hotel info; should be removed... The words ... should be moved into the profile at TOP RIGHT CORNER which will have a circle profile with the user's PROFILE PICTURE if not let it be initials of their registered names. Right next to the profile circle add a NOTIFICATION BADGE BELL. DASHBOARD should be removed completely."
- **Solution:** The hotel contact strip was removed from the staff panel. The top-right corner now has the **circle profile** (initials only) and a **notification bell** beside it. Clicking the profile reveals **Portal, User Manual, My Profile, Log Out** and the language switch (**EN / SW**). The **Dashboard** link and duplicated side-bar account links were removed.
- **Status:** DONE
- **Path to find:** -> Dashboard -> Top Bar (Right Side) -> Bell + Circle Profile (Initials)

## 6. Due Out Conditions Bypassed

- **Problem:** "Upon testing it has occurred once again where DUE OUT color change conditions has been bypassed. Example the user performed night audit of 08/10/2026 therefore the guest SWAUM HAMIS should automatically turn to purple indicating this room is due out therefore night audit for 09/10/2026 would be blocked unless the guest SWAUM HAMIS is checked out. Fix this error."
- **Solution:** A checked-in guest whose checkout day has arrived **or already passed** now stays on the board and turns **purple (Due Out)**. The Due Out and Occupied counts and the guests-in-house figure include them, and the night audit still **blocks** while any overdue guest has an unsettled bill.
- **Status:** DONE
- **Path to find:** -> Dashboard -> Rooms Chart -> Overdue Stay Shown Purple (Due Out)

## 7. Due Out Folio Operations Flaw

- **Problem:** "When room status changes to due out it seems to affect the amount due of the guest either to be paid or to be posted to creditors. Why does this happen? TO FIX - ensure the balance due matches the exact amount that should be payable upon adding payments."
- **Solution:** The amount offered in **Post to Creditors** and **Collect Payment** (and the over-payment guard) now reads the same **ledger balance** shown on the folio (charges minus payments), not the separate backend header figure that shifted when a guest was carried past checkout as a due-out. The amount payable and the balance due therefore always agree.
- **Status:** DONE
- **Path to find:** -> Dashboard -> Open Stay -> Folio Operations -> Balance / Post To Creditors

---

MRK Hotels - Reception Panel Changes Guide | October 2026
