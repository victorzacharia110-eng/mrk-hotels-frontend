# MRK Hotels - Reception Panel Changes Guide

*For Non-Technical Staff | Use this to verify all updates*

## 1. DASHBOARD - Top Toolbar

### A. Profile (Name Only)
- **Location:** Top-right corner of the Dashboard screen.
- **What changed:** The profile chip no longer shows your role - only your name and initials.
- **How to check:** Look at the top-right. You should see just your name with your initial circle - no job title shown.
- **Path to find:** → Dashboard → Top Bar (Right Side) → Profile Chip

### B. Business Date (Replaces "TODAY")
- **Location:** Top toolbar, left side.
- **What changed:** The button now shows **BUSINESS DATE** instead of "TODAY".
- **What it shows:** The hotel's current business date (not your device's calendar date).
- **Behavior:** It only moves forward automatically when the previous business day had **NO activity** (no reservations and no checked-in guests). If there is any activity, it stays on that business date until Night Audit is completed.
- **Path to find:** → Dashboard → Top Toolbar (Left) → **BUSINESS DATE** Button

### C. Search Bar With Results Dropdown
- **Location:** Top toolbar, middle-right (magnifying glass icon).
- **How to use:** Type at least **2 characters** (guest name, room number, or booking reference).
- **What happens:** A dropdown list appears below the search box showing matching stays and rooms.
- **Action:** Click any result in the list to jump straight to that stay or room.
- **Path to find:** → Dashboard → Top Toolbar → Search Box → Type 2+ characters → Results Dropdown

## 2. NEW BOOKING TAB

**How to open:** Click **+ New Booking** on the Dashboard.

### A. Room Dropdown Filters By Room Type
- **Location:** New Booking Form → Room dropdown.
- **What changed:** The room dropdown now only shows available rooms of the **same room type** as what you're working with.
- **Example:** If you select a Suite, the dropdown will only show available Suites - not Standard, Double, or other room types.
- **Path to find:** → Dashboard → + New Booking → Room Field → Dropdown (filtered by room type)

### B. City Field Is Searchable
- **Location:** New Booking Form → City field.
- **What changed:** You can now type to search for cities.
- **How to check:** Click the City dropdown and start typing a few letters - the list filters automatically as you type.
- **Path to find:** → Dashboard → + New Booking → City Field → Type to Search

### C. Auto Total Badge Removed
- **Location:** New Booking Form → Totals/Amount section.
- **What changed:** The extra floating "AUTO TOTAL" badge that appeared outside the form boxes has been removed.
- **What to see:** Totals now display cleanly and neatly inside the form only.
- **Path to find:** → Dashboard → + New Booking → Totals Section

### D. Walk In vs Reservation Buttons
- **Location:** Bottom of the New Booking form.

**If the date is the CURRENT BUSINESS DATE:**
- You will see **TWO** buttons: **WALK IN** (Green) and **RESERVATION**.
  - **WALK IN** – Creates the booking AND checks the guest in immediately. The room turns **GREEN** (Occupied) on the chart.
  - **RESERVATION** – Creates a reservation only. The room stays **RED** (Reserved) and waits to be checked in later.

**If the date is a FUTURE DATE:**
- You will see **ONLY ONE** button: **RESERVATION**. Walk-In is not allowed for future dates.

**Path to find:** → Dashboard → + New Booking → Fill Form → Bottom Action Buttons

## 3. GROUP BOOKINGS (Multi-Room Bookings)

- **Location:** New Booking Form → Booking Type dropdown.
- **What changed:** Group booking is fully supported. When creating a group (party) with 2 or more rooms, the system creates them as linked reservations under one group with a shared reference.
- **How to use:** Select **Group** as Booking Type, add multiple rooms (room selections), set the Primary Room, then save.
- **Where to see group info:** In reservation lists, group bookings show a "Group" badge indicating how many rooms are in the party. Cancellation modal allows cancelling the whole group or selected rooms.
- **Path to find:** → Dashboard → + New Booking → Booking Type = Group → Select 2+ Rooms → Save

## 4. FOLIO OPERATIONS - Correct Related Folio Balance

- **Location:** Folio View → Settle to Creditors (when viewing a related/split folio).
- **What changed:** When viewing a **related folio** (created from Split/Cut), the settlement screen now shows the correct balance for that related folio - not the main/current folio's balance.
- **Path to find:** → Dashboard → Open Stay (with Split/Cut Folios) → View Related Folio → Folio Operations → Settle to Creditors

## 5. MAINTENANCE ROOMS - Cannot Be Booked

- **What changed:** Rooms marked as **Maintenance** cannot be booked.
- **How to check:** Maintenance rooms do **NOT** appear in the Room dropdown when creating a new booking.
- **Path to find:** → Dashboard → + New Booking → Room Dropdown (Maintenance rooms excluded)

## 6. INVOICE - Guest & Staff Signatures

- **Location:** Printed Invoice (Print Invoice Breakdown).
- **What changed:** The printed invoice now includes signature spaces at the bottom.
- **What to see:** At the bottom of the printed invoice there are two signature lines:
  1. **Guest signature & date**
  2. **Authorized signature & stamp**
- **Path to find:** → Dashboard → Open Stay → Print → Print Invoice Breakdown → Bottom of Printed Page

## 7. CHECK OUT - Extra Safety Checks

### A. Related Folios Must Be Settled First
- If a stay has Split/Cut related folios, **ALL** related folio balances must be fully settled before checkout.
- The system will block checkout if any related folio still has an outstanding balance and show a clear message.

### B. Cannot Check Out With Future Departure Date
- You cannot check out if the Check Out Date is **after** the current **BUSINESS DATE**.
- **Allowed:** Overdue stays (departure date has already passed).
- **Blocked:** Stays with a future departure date (clear message shown).
- **Path to find:** → Dashboard → Open Checked-In Stay → Check Out (System validates both rules)

## 8. VOID RESERVATION

### A. Management Only
- "Void Reservation" only appears for: **Manager, Hotel Admin, Owner, or Superadmin**.
- Receptionists will **NOT** see this option at all.
- **Path to find:** → Dashboard → Open Reservation → Three Dots (⋯) Menu → Void Reservation (if authorized)

### B. Reason Required (No Guest Name)
- The popup now asks for **"Reason for voiding"** (text box).
- You must type a reason to confirm. It no longer asks you to type the guest's name.

### C. Voided Reservations Go To Reports (Removed From Dashboard)
- When voided successfully, the reservation is **completely removed** from the Dashboard (not left red).
- To view voided reservations: **Reports → Report Browser → Void Reservations**
- The report shows: Booking Ref, Guest, Room, Dates, Amounts, **Voided On**, **Voided By**, and **Reason**.
- **Path to find:** → Reports → Report Browser → Void Reservations

## 9. SEQUENCING - Automatic Sequential References

- **What changed:** All key records now get automatic sequential reference numbers (clean, ordered, not random).

**Where to see them:**
- **Reservations:** Get sequential Booking Reference (BK-...) automatically
- **Night Audit → Manual Transactions (Insert Transaction):** Get sequential ADJ-... reference numbers
- **Folio Entries & Refunds:** Use sequential FLX-... reference numbers

**Path to find:** → Reservation Details / Night Audit → Transactions / Folio View / Void Reservations Report