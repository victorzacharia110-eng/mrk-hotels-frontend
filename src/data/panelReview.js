/**
 * MANAGER PANEL REVIEW — what was asked, what was wrong, what changed, and
 * where to see it.
 *
 * This is the readable record of the panel review. It is data rather than
 * prose in a component so the page can group it, count it and search it, and
 * so the wording of an item lives in one place.
 *
 * `status`:
 *   'done'      — the review asked for it and it now behaves that way
 *   'partial'   — done for the part that could be settled; the rest is named
 *   'open'      — raised in the review, not yet built. Stated plainly rather
 *                 than dressed up, so nobody assumes it is finished.
 *
 * `where` is a short "you can see this at…" string for the person reading it,
 * not a file path. The technical location is kept out of this file on purpose:
 * an end user does not benefit from a route name, and a route name here would
 * rot the moment a page moved.
 */

export const REVIEW_INTRO = {
  title: 'Manager Panel Review — what was changed',
  intro:
    'This is the running record of the points raised in the manager panel review: what the problem was in plain terms, what was done about it, and where on screen you can see the result. Points are grouped by the area of the panel they belong to. Anything not yet built is listed as open rather than left out, so you always know the full picture.',
  howToRead:
    'Each point says what was wrong, what changed, and where to look. "Where to see it" is the screen in this software — no technical knowledge is needed to follow it.',
}

export const REVIEW_GROUPS = [
  {
    id: 'categories',
    title: 'Menu categories and sub-categories',
    blurb:
      'The review proposed splitting the menu the way a hotel actually sells: a category is what the hotel offers (food, drinks, swimming, conference), and a sub-category is what sits inside it (a starter, a cocktail, a child package).',
    items: [
      {
        ref: 'Categories',
        ask: 'A hotel may offer more than a restaurant and a bar — swimming, gym, play station and other services. The category should be the hotel\'s selling point.',
        problem:
          'There was only one category, so every service the hotel sold had to be filed under the same heading. A pool, a gym and a bar all looked alike on the menu.',
        solution:
          'Categories are now entered by hand, so the hotel decides its own list of services. Sub-categories sit underneath and can be registered the same way, and every menu item must be filed under one of them before it can be saved.',
        status: 'done',
        where: 'Restaurant & Bar → Manager → Menu, when adding or editing an item.',
      },
      {
        ref: 'Categories',
        ask: 'CATEGORY should be manually entered. SUB CATEGORIES should be manually registered.',
        problem:
          'The structure existed but was not enforced, so items could be saved with no category or sub-category and then could not be reported on reliably.',
        solution:
          'Both are now typed in by hand and both are required. The system will not accept an item that has not been placed in a category and a sub-category, which is what makes the later reports trustworthy.',
        status: 'done',
        where: 'Inventory & Procurement → Categories, and the Menu page when registering an item.',
      },
    ],
  },
  {
    id: 'printer',
    title: 'Printer settings',
    blurb:
      'The review set out a clear rule: where an item prints decides which printer it goes to, and the printer is a place, not a department.',
    items: [
      {
        ref: 'Printer settings',
        ask: 'When registering an item, the manager must choose the printer: print on receipt, print on order, and which printer the order goes to — kitchen or bar.',
        problem:
          'There was nowhere on the item form to say where the order should print, so kitchen and bar tickets could not be separated reliably.',
        solution:
          'Every item now carries its own printer settings, chosen when the item is registered. You can say whether it prints on the customer receipt, on the order ticket, and which station receives it — the kitchen or the bar.',
        status: 'done',
        where: 'Restaurant & Bar → Printer, and the printer section on the Menu item form.',
      },
      {
        ref: 'Printer settings logic',
        ask: 'Choosing the bar printer does not mean the item counts as bar sales. Choosing the kitchen printer means the kitchen receives the order from any till in the building, with the chef screen as the backup.',
        problem:
          'The printer choice and the sales category were easy to confuse, and there was no chef-facing screen to fall back on if a printer failed.',
        solution:
          'The printer choice now decides only where the ticket prints, and never changes how a sale is counted. The kitchen board stands as the second route to the same orders, so the kitchen still sees everything if a printer is out of paper.',
        status: 'done',
        where: 'Kitchen → Kitchen Board.',
      },
    ],
  },
  {
    id: 'outlet',
    title: 'Outlets (venue, stock and reports)',
    blurb:
      'This was the largest part of the review. It asked a specific question about two bar counters and ended up reshaping how stock, requisitions and reports are handled across the whole hotel.',
    items: [
      {
        ref: 'Outlets — what is an outlet',
        ask: 'In the reference system an outlet means a department or a pricing point. Where are departments registered in this software? Currently only restaurant and bar by default.',
        problem:
          'Only restaurant and bar could be set up, so a pool bar, a laundry counter or a shop had nowhere to be represented, and no way to be described for what it is.',
        solution:
          'Outlets can now be created for any venue the hotel actually has, and each one can describe itself properly — restaurant, bar, laundry, swimming pool, spa, kitchen, store or other.',
        status: 'done',
        where: 'Restaurant & Bar → Manager → Outlets.',
      },
      {
        ref: 'Outlets — each outlet has its own stock',
        ask: 'Each outlet should have its own report browser: its own requisition, its own stock reports and its own adjustment.',
        problem:
          'There was one shared pot of stock. Two bar counters selling the same drink drew from the same bottles, so one counter could sell stock the other had already sold, and neither could be counted on its own. This is the exact case the review described: a waiter at the pool bar taking a drink could not tell which counter\'s stock it came from.',
        solution:
          'Each outlet now has its own shelf, and that shelf holds its own count of the same product. The pool bar and the main bar can each hold six bottles of the same drink as genuinely separate stock. When a drink is sold, it comes off the shelf of the outlet the waiter selected, and the count shown on screen is that same outlet\'s count.',
        status: 'done',
        where:
          'Restaurant & Bar → Outlets to set the shelf. Then Take Order, or the stock list, to see each outlet\'s own figure.',
      },
      {
        ref: 'Outlets — each outlet has its own adjustment',
        ask: 'Every outlet has its own adjustment.',
        problem:
          'A stock correction was applied to the hotel as a whole, whichever counter made it. So if the pool bar miscounted, the number the main bar read was rewritten too — one counter\'s mistake silently changed the other\'s books.',
        solution:
          'A correction is now recorded against the outlet it belongs to. Correcting the pool bar leaves the main bar\'s figure exactly as it was, and the correction is stamped with the outlet so the stock report can say whose shelf it was for.',
        status: 'done',
        where: 'Inventory → Inventory, and the store stock adjustment screens.',
      },
      {
        ref: 'Outlets — each outlet has its own requisition',
        ask: 'Each outlet has its own requisition.',
        problem:
          'The list showed the selected outlet\'s stock, but the request itself was raised against the staff member\'s own shelf. So a waiter could be looking at the pool bar\'s stock and unknowingly raise the request against the main bar.',
        solution:
          'A request is now raised against the outlet the lines were read from. Editing an existing request keeps the shelf it already has, so an old request is never quietly moved to whichever outlet happens to be selected later.',
        status: 'done',
        where: 'Restaurant & Bar → Inventory → Requisitions, with the outlet selector at the top.',
      },
      {
        ref: 'Outlets — selecting which outlet to work in',
        ask: 'All users except the receptionist choose which outlet they are working in. How does a waiter serving through one of two bar counters say which counter they are at?',
        problem:
          'There was no way to say which outlet you were working in, so it was never recorded whose sale it was, and there was no way to know which stock the sale should come from.',
        solution:
          'There is now an outlet selector that remembers your choice for the session, and the selected outlet is stamped on every order, receipt and requisition. When you switch outlet, the stock figures on screen change to that outlet\'s.',
        status: 'done',
        where:
          'The outlet selector at the top of the waiter and store screens. It is not on the receptionist\'s screen, as the review asked.',
      },
      {
        ref: 'Outlets — corrections on a live ticket',
        ask: 'Follows from the above: if a waiter adds or removes a drink after the ticket is taken, the stock must move at the same outlet.',
        problem:
          'Changing a ticket moved stock at the staff member\'s own shelf rather than the outlet the ticket was served from, so the two counters drifted apart again the moment a mistake was corrected.',
        solution:
          'Adding or removing an item on an open ticket now moves stock on the same outlet that served it, so a correction lands where the sale was made.',
        status: 'done',
        where: 'Restaurant & Bar → Orders, on an open ticket.',
      },
      {
        ref: 'Outlets — where the link is set',
        ask: 'Where are departments being registered? The review wanted outlets to be configurable from the panel.',
        problem:
          'The system could hold the link between an outlet and its stock shelf, but there was no screen to set it, so it had to be done outside the software.',
        solution:
          'The outlet list now shows each outlet\'s shelf, lets you choose or change it, and lets you clear it if it was set by mistake. Renaming an outlet no longer disturbs the link. The list of venue types has been widened to match what the hotel actually runs.',
        status: 'done',
        where: 'Restaurant & Bar → Manager → Outlets.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Manager dashboard and panel menus',
    blurb:
      'The review asked that management land somewhere of its own, and that each role\'s menu match the work that role does.',
    items: [
      {
        ref: 'Dashboard',
        ask: 'Why does the manager sign in to the receptionist\'s dashboard?',
        problem:
          'Every role landed on the same front-desk board, so a manager opened a screen built for the person answering the telephone.',
        solution:
          'Management now lands on its own operational overview. Reception, housekeeping, kitchen, waiter and store roles each keep the board that matches their work.',
        status: 'done',
        where: 'The page you land on after signing in as a manager.',
      },
      {
        ref: 'Dashboard',
        ask: 'When the front desk menu has no dashboard page on the management panel.',
        problem:
          'The front-desk stay board was open to managers but was not actually listed in their menu, so there was no way to reach it from the sidebar.',
        solution:
          'It now appears as the Dashboard entry inside the Front Desk menu, which keeps the stay board reachable for management without confusing it with the management overview above it.',
        status: 'done',
        where: 'Front Desk → Dashboard.',
      },
      {
        ref: 'Panel menus',
        ask: 'Each role\'s menu should reflect the work that role does.',
        problem:
          'Roles saw menu entries for work they never performed, and areas they did work on had no entry at all.',
        solution:
          'The menus are now built per role: Front Desk, Restaurant & Bar, Inventory & Procurement and Communication, with each role seeing the sections that apply to them. Management keeps the manager tools such as the outlet and menu pages.',
        status: 'done',
        where: 'The sidebar, for each of the roles.',
      },
    ],
  },
  {
    id: 'reservations',
    title: 'Reservations',
    blurb: 'Two points about the reservation page.',
    items: [
      {
        ref: 'Reservations 1',
        ask: 'The From and To dates should default to the current date, based on night audit, so a manager can see today\'s status straight away.',
        problem:
          'The page opened on dates that had to be set by hand before anything useful appeared, so the current day\'s position was not visible on arrival.',
        solution:
          'The dates now open on the current day, and the current day is the one the system considers today after night audit has run, so the figures match the books rather than the wall calendar.',
        status: 'done',
        where: 'Front Desk → Reservations, at the top of the filter bar.',
      },
      {
        ref: 'Reservations 2',
        ask: 'The View tab is not readable. Please arrange it so the guest information and the booking details are easy to read, with clear styling.',
        problem:
          'Opening a reservation showed only booking and money fields. A receptionist could not confirm who the guest was without leaving the screen.',
        solution:
          'The panel is now grouped into clear sections — guest information, booking, stay and money — so the person and the reservation are read in one place.',
        status: 'done',
        where: 'Front Desk → Reservations → View on any reservation.',
      },
    ],
  },
  {
    id: 'rooms',
    title: 'Rooms, rates and stop sell',
    blurb:
      'The review raised seven points here. Six are resolved; one asks for a layout change that is still open.',
    items: [
      {
        ref: 'Rooms 1',
        ask: 'Why do the Status and Room Type filters depend on which page you are on? Filtering for a suite while on page 3 says no rooms found, but the rooms appear on another page.',
        problem:
          'The filter was applied after the page was already chosen, so it only searched within the rooms on screen. A filter that looks broken is worse than no filter, because it reads as "no such rooms exist".',
        solution:
          'Changing a filter now returns to the first page and searches the whole filtered set, so the answer is the real answer, not the answer for one page of it.',
        status: 'done',
        where: 'Front Desk → Rooms, using the Status or Room Type filter.',
      },
      {
        ref: 'Rooms 2',
        ask: 'Why do the rates not show until the page is refreshed?',
        problem:
          'Pushing new rates updated the saved prices but the figures on screen stayed as they were, so it looked as though the push had failed until the page was reloaded.',
        solution:
          'Pushing rates now refreshes both the summary and the room list, so the new price is on screen straight away.',
        status: 'done',
        where: 'Front Desk → Rates, after entering a nightly price and pushing it.',
      },
      {
        ref: 'Rooms 3',
        ask: 'After choosing rooms to stop sell, the highlighted boxes stay filled, so you cannot tell what is still selected.',
        problem:
          'The highlight did not clear when a room was removed from the selection, so the boxes no longer reflected the actual choice.',
        solution:
          'A room is now filled only when it is genuinely stopped on that night, and the selected rooms are listed by name so you can see at a glance what you have chosen.',
        status: 'done',
        where: 'Front Desk → Rooms → Stop sell.',
      },
      {
        ref: 'Rooms 4',
        ask: 'Rooms selected for stop sell still receive new bookings, so the stop sell is not working.',
        problem:
          'A stopped room could still be booked from the front desk. A stop sell that does not stop anything is worse than none, because staff trust it and rely on it.',
        solution:
          'A stopped room is now genuinely unavailable for a new booking, and the two rooms are colour coded so the difference is visible rather than something you learn by making a mistake.',
        status: 'done',
        where: 'Front Desk → Rooms → Stop sell, and the Rooms summary.',
      },
      {
        ref: 'Rooms 5',
        ask: 'Where does the user see which rooms were selected for stop sell? It only shows the room type, not the actual rooms.',
        problem:
          'The summary reported a room type, so you could not tell whether room 5 or room 12 was the one blocked.',
        solution:
          'The target is a specific room, or several, and the rooms chosen are shown by name. One room, for example room 5, can be stopped on its own.',
        status: 'done',
        where: 'Front Desk → Rooms → Stop sell, in the chips under the room picker.',
      },
      {
        ref: 'Rooms 6',
        ask: 'Use a calendar with the rooms down the side, as on the receptionist dashboard, to set a stop sell covering several days.',
        problem:
          'Setting a stop sell over several days means moving through the days one at a time, and it is hard to see at a glance which rooms are stopped across a range.',
        solution:
          'Not yet built. This is a layout change rather than a fault, and it is the one point in this section still outstanding.',
        status: 'open',
        where: 'Will appear on Front Desk → Rooms → Stop sell when it is done.',
      },
    ],
  },
  {
    id: 'guests',
    title: 'Guests',
    blurb: 'The nationality search on the guest page.',
    items: [
      {
        ref: 'Guests',
        ask: 'Why does the nationality search bar not work?',
        problem:
          'The box looked like a search box but did not search. Staff ended up scrolling the guest list looking for a nationality by hand.',
        solution:
          'It now searches as you type, matching any part of the nationality, and ignores capitalisation and spacing so "TZ", "tz" and " Tanzania" all find Tanzania.',
        status: 'done',
        where: 'Front Desk → Guests, the Nationality box.',
      },
    ],
  },
  {
    id: 'admin',
    title: 'Administration and reports',
    blurb: 'Where the back-office tools live and what they are called.',
    items: [
      {
        ref: 'Admin 1',
        ask: 'Move the Report Browser from the restaurant section to the Front Desk administration menu.',
        problem:
          'The Report Browser reported on the whole hotel, but sat under Restaurant & Bar, so staff reasonably read it as a food-and-beverage report.',
        solution:
          'It now sits in the Administration sub-menu inside the Front Desk dropdown, with the other back-office tools. The separate POS Reports page stays in the restaurant section, because that one really is department-scoped.',
        status: 'done',
        where: 'Front Desk → Administration → Report Browser.',
      },
      {
        ref: 'Admin 2',
        ask: 'Remove Xero and QuickBooks from the management administration menu. That connectivity should sit solely with the accountant.',
        problem:
          'Management could see accounting connections they have no responsibility for, which is both clutter and a small risk.',
        solution:
          'Xero and QuickBooks are now available to the accountant only and no longer appear in the management menu.',
        status: 'done',
        where: 'The accountant\'s own panel.',
      },
      {
        ref: 'Admin 3',
        ask: 'Rename STAFF REPORT to SUMMARY REPORT in the manager\'s restaurant section.',
        problem:
          'The page was labelled for who it was about rather than for what it showed, which read as a report about staff rather than a summary.',
        solution:
          'It is now called Summary Report everywhere it appears.',
        status: 'done',
        where: 'Restaurant & Bar → Manager → Summary Report.',
      },
      {
        ref: 'Admin 4',
        ask: 'Where does the hotel\'s registered company information come from, and if the name, address and tax numbers are changed, does the change reach every panel, every invoice and every exported report including waiter receipts and kitchen orders?',
        problem:
          'There was no single place to see or change the hotel\'s own details, so there was no way to be confident that a change would reach all the documents the hotel issues.',
        solution:
          'The hotel\'s details now have their own page in the panel, where the name, address, phone, email and tax numbers can be seen and edited. Those same details are what print on the documents — invoices, purchase orders, waiter receipts and kitchen orders — so a change here is a change everywhere, rather than something repeated document by document.',
        status: 'done',
        where: 'Front Desk → Administration → Hotel Settings.',
      },
    ],
  },
]

/** Counts used by the summary strip at the top of the page. */
export function reviewCounts() {
  const all = REVIEW_GROUPS.flatMap((g) => g.items)
  return {
    total: all.length,
    done: all.filter((i) => i.status === 'done').length,
    partial: all.filter((i) => i.status === 'partial').length,
    open: all.filter((i) => i.status === 'open').length,
  }
}
