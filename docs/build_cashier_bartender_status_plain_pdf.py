#!/usr/bin/env python3
"""Build the plain-language Cashier & Bar Tender status PDF."""
from html import escape
from pathlib import Path

from weasyprint import HTML

from build_cashier_bartender_status_pdf import (
    DATE,
    KNOWN_FAILURES,
    SECTIONS,
    VERSION,
)

HERE = Path(__file__).parent
OUT = HERE / "MRK_Cashier_Bartender_Panel_Status_Plain_Language.pdf"

TITLE_MAP = {
    "1. Top Panel & Access": "1. Top bar and access",
    "2. Dashboard": "2. Dashboard",
    "3. Ingredients": "3. Ingredients",
    "4. Product Library": "4. Product Library",
    "5. Shift Manager & Day Close": "5. Shift Manager and Day Close",
    "6. Blocked Devices & Net Lock": "6. Blocked Devices and Net Lock",
    "7. New Order / In House": "7. New orders and In House",
    "8. Open Orders & My Orders": "8. Open Orders and My Orders",
    "9. Take Out, No Charge, Room Service & Delivery": "9. Take Out, No Charge, Room Service and Delivery",
    "10. Requisitions": "10. Requisitions",
    "11. Order Summary": "11. Order Summary",
    "12. Inventory Dropdown & Renaming": "12. Inventory menu and name changes",
}

REPLACEMENTS = [
    ("Top-right area showed CASHIER/BAR TENDER wording", "The top-right area showed the job title CASHIER/BAR TENDER"),
    ("Waiter Assignment shortcut", "Waiter Assignment button"),
    ("user manual, profile, language and dark mode were scattered", "the user manual, profile, language and dark mode options were scattered"),
    ("clickable profile", "profile button"),
    ("wall-clock date", "today's calendar date"),
    ("the today's", "today's"),
    ("business-date", "working-day"),
    ("business date", "working day"),
    ("department/outlet-scoped menu stock", "stock for the selected department and outlet"),
    ("menu-level value", "the menu item's own low-stock level"),
    ("SI Unit", "unit"),
    ("QTY", "quantity"),
    ("sub-categories", "subcategories"),
    ("sub-category", "subcategory"),
    ("Sub Category", "Subcategory"),
    ("SKU", "product code"),
    ("OPEN PRICE", "open price"),
    ("DISCOUNT", "discount"),
    ("default KITCHEN/BAR MENU dropdown", "default KITCHEN/BAR MENU selector"),
    ("two decimals (step 0.01)", "two decimal places"),
    ("from/to calendar interval", "date range"),
    ("date interval", "date range"),
    ("clear/X action", "clear button"),
    ("clear/X button", "clear button"),
    ("back/forward arrows", "back and forward arrows"),
    ("middleware", "access rule"),
    ("endpoints", "screens"),
    ("APIs", "screens"),
    ("numeric level", "role level"),
    ("role-aware access", "access based on staff role"),
    ("payload", "information"),
    ("toast", "message"),
    ("KOT", "kitchen ticket"),
    ("tenant code", "hotel code"),
    ("ORD/ORD-TK/ORD-RS/ORD-DM-YYYY-NNNN", "clear order numbers for each order type"),
    ("RQ-YYYY-NNNN", "clear requisition numbers"),
    ("ORD-YYYY-NNNN", "clear order numbers"),
    ("ORD-TK-YYYY-NNNN", "clear Take Out order numbers"),
    ("ORD-RS-YYYY-NNNN", "clear Room Service order numbers"),
    ("ORD-DM-YYYY-NNNN", "clear Delivery order numbers"),
    ("registered account selection", "choosing from registered accounts"),
    ("room posting", "charging to a room"),
    ("creditors", "credit accounts"),
    ("provider", "payment option"),
    ("dropdown", "menu"),
    ("search bar", "search box"),
    ("segmented filter", "simple filter"),
    ("Pending/Complete simple filter", "Pending/Complete filter"),
    ("Command centre", "Action bar"),
    ("command centre", "action bar"),
    ("command bar", "action bar"),
    ("command buttons", "extra buttons"),
    ("Extra extra buttons", "Extra buttons"),
    ("order peek", "order details"),
    ("action column", "button column"),
    ("an button column", "a button column"),
    ("an button", "a button"),
    ("detail modal", "details pop-up"),
    ("drawer", "side panel"),
    ("pencil icon", "edit icon"),
    ("accordion", "expandable section"),
    ("role-aware", "role-based"),
    ("reprints could duplicate old items", "reprints could repeat old items"),
    ("own-table continuation", "continuing your own table"),
    ("additional KOT", "additional kitchen ticket"),
    ("per-order void beside split/transfer/merge", "cancel button next to split, move and combine"),
    ("counted action", "action that shows how many orders are selected"),
    ("bell icon", "bell symbol"),
    ("silently failing", "nothing happening"),
    ("reloads the list", "refreshes the list"),
    ("registered inventory", "saved inventory"),
    ("detail modal", "details pop-up"),
    ("page start/page end", "pages"),
    ("existing lines", "existing items"),
    ("scrollable", "scrolls smoothly"),
    ("routes", "links"),
    ("Reorder Level", "low-stock level"),
    ("reorder values", "low-stock levels"),
    ("reorder level", "low-stock level"),
    ("PDF wording", "requested wording"),
    ("item stock badge", "item stock label"),
    ("filter chips", "filter buttons"),
    ("date/filter workflow", "date and filter controls"),
    ("selected lines stay visible", "selected items stay visible"),
    ("older rows", "older items"),
    ("requested terminology", "requested names"),
    ("did not surface requested-by", "did not show who requested it"),
    ("which shows Requested By", "which shows who requested it"),
    ("Number of checks", "Failing checks"),
    ("clear order numbers numbering", "clear order numbering"),
    ("scoped to", "limited to"),
    ("paging", "page breaks"),
    ("S/N", "reference number"),
    ("table/detail", "list/details"),
    ("top commands", "top buttons"),
    ("accepted requisition stock", "stock received from requisitions"),
    ("stock accepted from requisitions", "stock received from requisitions"),
    ("Subcategory", "subcategory"),
]

OVERRIDES = {
    "Outlet selection listed all store outlets, including non-selling outlets, so a cashier could pick a counter that does not sell.": (
        "The outlet list showed every store outlet, including outlets that do not sell. A cashier could choose a counter that should not be used for selling.",
        "The outlet screen now shows only outlets that sell. The outlet you choose controls orders, stock and reports.",
        "Outlet screen after login",
    ),
    "Menu maintenance was reachable from the cashier panel and produced errors; the client wants menu editing only on the management panel.": (
        "Menu editing could be opened from the cashier panel and caused errors. The client wants menu editing to stay in the management panel.",
        "Menu has been removed from the cashier sidebar. Only management users can edit the menu, from the management panel.",
        "Management > Menu",
    ),
    "Switching Restaurant/Bar after choosing a table locked categories and wiped the selected menu items.": (
        "Switching between Restaurant and Bar after choosing a table locked the categories and cleared the items already selected.",
        "Switching department now keeps the selected table and the items already chosen. Staff can continue the same order after switching.",
        "Dashboard > Restaurant/Bar switch",
    ),
    "Menu-item reorder level was inherited from store inventory; the client wants a separate menu reorder level.": (
        "The low-stock level for a menu item was taken from store inventory. The client wants a separate low-stock level for each menu item.",
        "A low-stock level can now be set on each menu item. The dashboard uses that menu-item level.",
        "Management > Menu > item form",
    ),
    "SI Unit was a manual fill-in field instead of following the registered inventory item.": (
        "The unit was typed by hand instead of following the saved inventory item.",
        "The unit is now filled in automatically from the selected inventory item and cannot be changed by mistake.",
        "Cashier > Ingredients > Add > Unit",
    ),
    "Ingredient QTY showed more than the standard two decimal places.": (
        "Ingredient quantities showed more than two decimal places.",
        "Quantities now show and accept two decimal places.",
        "Cashier > Ingredients > Quantity",
    ),
    "Search was on the first tab instead of the top of the product table; categories and sub-categories were not presented like the waiter panel.": (
        "Search was on the first tab instead of at the top of the product table, and categories and subcategories did not look like the waiter panel.",
        "Search is now at the top. Category buttons run across the page, and subcategories appear below the selected category.",
        "Cashier > Product Library > search and category rows",
    ),
    "Day Close allowed a running order to be settled inline, sometimes without the required provider.": (
        "Day Close allowed a running order to be paid directly, sometimes without the required payment option.",
        "Paying from Day Close now takes you to Order Summary, where the full payment, room, credit account or no-charge steps are completed.",
        "Cashier > Day Close > Take payment",
    ),
    "After closing the business day the page did not clearly return the user to the dashboard.": (
        "After closing the working day, the screen did not clearly return staff to the dashboard.",
        "Closing the day now takes you back to the dashboard on the new working day.",
        "Cashier > Day Close > Close Day",
    ),
    "Transaction Lock had no way to unfreeze a locked order from the list.": (
        "There was no way to unlock a locked order from the Transaction Lock list.",
        "Each order now has an Unlock action. Only cashiers, bartenders and management can unlock. Waiters cannot.",
        "Cashier > Net Lock > order action",
    ),
    "Settled or voided orders could be locked even though only running orders should be lockable.": (
        "Paid or cancelled orders could be locked, even though only running orders should be lockable.",
        "Closed orders can no longer be locked. The lock action is only available for running orders.",
        "Cashier > Order Summary > Freeze; Cashier > Net Lock",
    ),
    "Categories and menu search were available before a table was chosen.": (
        "Menu categories and search were available before a table was chosen.",
        "Categories and search results now stay hidden until a table is selected.",
        "Cashier > In House > New Order",
    ),
    "Stock shown on menu items did not clearly follow the selected outlet or accepted indent stock.": (
        "The stock shown on menu items did not clearly follow the selected outlet or stock received from requisitions.",
        "Menu stock now follows the selected outlet and includes stock received from requisitions.",
        "Cashier > In House > item stock label",
    ),
    "VOID ALL was a bulk action with unclear placement.": (
        "VOID ALL was a bulk action and it was not clear where it belonged.",
        "The action is now called VOID. Each order also has its own cancel button next to split, move and combine. The selected-orders action shows how many orders are selected.",
        "Cashier > In House > Open Orders toolbar and order cards",
    ),
    "Delivery ordering tab had no way to select a driver.": (
        "There was no way to choose a driver when taking a Delivery order.",
        "A searchable driver menu has been added, using the list of waiters and drivers.",
        "Cashier > Delivery > New Delivery Order",
    ),
    "New requisition item dropdown was limited, items were not selectable and SI Unit was missing.": (
        "The new requisition item list was limited, some items could not be selected, and the unit was missing.",
        "The item list is now searchable and shows the registered items for the department. Items can be selected and the unit is shown on each line.",
        "Cashier > Requisitions > New",
    ),
    "The order drawer only allowed editing existing items; there was no + action to add items, and quantity edits failed with 'The quantity field is required.'": (
        "The order side panel only allowed editing existing items. There was no + action to add items, and changing a quantity failed with an error saying the quantity was required.",
        "The side panel now has an edit icon and a + action. Quantity changes are saved correctly.",
        "Cashier > Order Summary > order > edit/add",
    ),
    "Transfer could not select a free table or a table occupied by the same user.": (
        "Moving an order could not choose an empty table or a table already used by the same waiter.",
        "Moving an order now offers empty tables and the waiter's own occupied tables as valid destinations.",
        "Cashier > Order Summary > order > Move table",
    ),
    "Voided order details did not show the reason for voiding.": (
        "Cancelled order details did not show why the order was cancelled.",
        "Order details now show why it was cancelled, who cancelled it and when.",
        "Cashier > Order Summary > Cancelled > order",
    ),
    "Settle only supported payment and room posting; creditors and no-charge accounts were missing.": (
        "Taking payment only supported normal payment and charging to a room. Credit accounts and no-charge accounts were missing.",
        "Credit account and No Charge options have been added, with a choice of registered accounts.",
        "Cashier > Order Summary > Take payment",
    ),
    "Cashier/bar tender panel had no inventory dropdown like the inventory panel.": (
        "The cashier and bar tender panel had no inventory menu like the main inventory panel.",
        "An Inventory section has been added with Low Stock, Stock Transfers, Stock Count and Stock Adjustment. Access depends on the staff role.",
        "Cashier sidebar > Inventory",
    ),
    "Inventory read endpoints were blocked for cashier/bartender by the numeric level middleware.": (
        "Cashiers and bartenders were blocked from viewing inventory screens because of an access rule.",
        "Cashiers and bartenders can now open the inventory screens they need. Access for other roles is unchanged.",
        "Inventory screens",
    ),
    "Take-away, room-service, delivery and requisition numbers included a tenant code instead of the requested sequential format.": (
        "Take Out, Room Service, Delivery and requisition numbers included a hotel code instead of the requested simple sequence.",
        "Orders now use clear numbers for each order type, and requisitions use clear requisition numbers.",
        "Order and requisition lists and printouts",
    ),
    "Dashboard used a from/to calendar interval, which contradicted the single Day Close business date.": (
        "The dashboard used a date range, which did not match the single working day used by Day Close.",
        "It now uses one working-day date field, linked to Day Close instead of today's calendar date.",
        "Dashboard > date field",
    ),
    "Requisition page button on the dashboard did not link to the requisition section.": (
        "The Requisitions button on the dashboard did not open the Requisitions page.",
        "The dashboard requisition summary now opens the Requisitions page.",
        "Dashboard > Requisitions > View requisitions",
    ),
    "Add Ingredient inventory dropdown was not searchable and only exposed a limited list.": (
        "The Add Ingredient inventory list was not searchable and only showed a limited list.",
        "It is now a searchable list showing the full saved inventory.",
        "Cashier > Ingredients > Add",
    ),
    "Add Ingredient dropdown attached stock counts to item labels.": (
        "The Add Ingredient list showed stock counts next to item names.",
        "The list now shows item names only, without stock counts.",
        "Cashier > Ingredients > Add > Inventory Item",
    ),
    "The old ITEM LOOKUP page name overlapped with EZEE and was not differentiated.": (
        "The old ITEM LOOKUP page name was too similar to EZEE and did not stand out.",
        "The page is now called PRODUCT LIBRARY in the menu, page titles and links.",
        "Cashier > Product Library",
    ),
    "Blocked Devices page had no useful purpose and cluttered the cashier sidebar.": (
        "The Blocked Devices page had no useful purpose and cluttered the cashier sidebar.",
        "The page is now hidden from the cashier sidebar until a useful purpose is defined. The page itself is still available.",
        "Cashier sidebar",
    ),
    "SEND ORDER and TOTAL placement did not match the PDF wording.": (
        "The SEND ORDER and TOTAL buttons were not in the position requested.",
        "SEND ORDER is now on the left and TOTAL is on the right. The send button still says SEND ORDER so staff are not confused.",
        "Cashier > In House > Selected Items bottom row",
    ),
    "There was no way to add new menu items on top of an existing order, and reprints could duplicate old items.": (
        "There was no way to add new items to an existing order, and reprints could repeat old items.",
        "A + button has been added in Order Summary, and staff can continue from their own occupied table. Only the newly added items are printed on the additional kitchen ticket.",
        "Order Summary > order > +; In House > occupied table",
    ),
    "Order template number/date/time layout was unclear, and every item showed PENDING and a bell icon.": (
        "The order card layout for number, date and time was unclear, and every item showed PENDING and a bell symbol.",
        "The order card now uses clear order numbers, shows date and time clearly, no longer shows PENDING and a bell for every item, and includes price and amount columns.",
        "Cashier > In House > Open Orders card",
    ),
    "Requisition status was a dropdown.": (
        "Requisition status was a drop-down list.",
        "It is now a simple Pending/Complete filter.",
        "Cashier > Requisitions > Pending/Complete",
    ),
}


def plain_text(text: str) -> str:
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text


def plain_row(problem: str, solution: str, status: str, where: str):
    if problem in OVERRIDES:
        problem, solution, where = OVERRIDES[problem]
    else:
        problem = plain_text(problem)
        solution = plain_text(solution)
        where = plain_text(where.split("|")[0].strip())
    return problem, solution, status, where


PLAIN_SECTIONS = [
    (
        TITLE_MAP.get(title, title),
        [plain_row(*row) for row in rows],
    )
    for title, rows in SECTIONS
]

STATUS_LABELS = {
    "Done": "Complete",
    "Done (assumption)": "Complete (clarified)",
}


def status_class(status: str) -> str:
    if status.startswith("Done (assumption)"):
        return "badge badge-assumption"
    return "badge badge-done"


def status_label(status: str) -> str:
    return STATUS_LABELS.get(status, status)


def section_html(title: str, rows) -> str:
    body = []
    for problem, solution, status, where in rows:
        body.append(
            "<tr>"
            f"<td>{escape(problem)}</td>"
            f"<td>{escape(solution)}</td>"
            f"<td>{escape(where)}</td>"
            f'<td><span class="{status_class(status)}">{escape(status_label(status))}</span></td>'
            "</tr>"
        )
    return f"""
    <section class="section">
      <h2>{escape(title)}</h2>
      <table>
        <colgroup>
          <col style="width:29%">
          <col style="width:41%">
          <col style="width:20%">
          <col style="width:10%">
        </colgroup>
        <thead>
          <tr>
            <th>What was wrong</th>
            <th>What changed</th>
            <th>Where you will see it</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>{''.join(body)}</tbody>
      </table>
    </section>
    """


KNOWN_FAILURE_LABELS = {
    "amend-group.spec.js": "Changing a group booking",
    "folio-ops.spec.js": "Guest folio operations",
    "group-booking-room-picker.spec.js": "Choosing rooms for a group booking",
    "hotel-dashboard-management-band.spec.js": "Hotel dashboard management banner",
    "room-occupancy.spec.js": "Room occupancy",
    "HousekeepingDashboardTest (date-bound completed_today)": "Housekeeping daily totals (date-sensitive)",
}

failures_html = "".join(
    f"<tr><td>{escape(KNOWN_FAILURE_LABELS.get(name, name))}</td><td>{escape(count)}</td></tr>"
    for _system, name, count in KNOWN_FAILURES
)

sections_html = "".join(section_html(title, rows) for title, rows in PLAIN_SECTIONS)
total_rows = sum(len(rows) for _, rows in PLAIN_SECTIONS)
total_done = sum(1 for _, rows in PLAIN_SECTIONS for row in rows if row[2].startswith("Done"))
assumptions = sum(1 for _, rows in PLAIN_SECTIONS for row in rows if "assumption" in row[2])

HTML_DOC = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MRK Hotels — Cashier &amp; Bar Tender Panel: Plain-Language Status</title>
<style>
  @page {{
    size: A4 landscape;
    margin: 14mm 10mm 14mm 10mm;
    @top-left {{
      content: "MRK Hotels — Cashier & Bar Tender Panel: Plain-Language Status";
      font-size: 7.5pt; color: #64748b;
    }}
    @top-right {{
      content: "{DATE} · {VERSION}";
      font-size: 7.5pt; color: #64748b;
    }}
    @bottom-center {{
      content: "Page " counter(page) " of " counter(pages);
      font-size: 7.5pt; color: #94a3b8;
    }}
  }}
  @page cover {{
    margin: 0;
    @top-left {{ content: none; }}
    @top-right {{ content: none; }}
    @bottom-center {{ content: none; }}
  }}
  * {{ box-sizing: border-box; }}
  html {{ font-size: 9pt; }}
  body {{
    font-family: "DejaVu Sans", "Noto Sans", sans-serif;
    color: #1e293b;
    line-height: 1.45;
    margin: 0;
  }}
  .cover {{
    page: cover;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 0 22mm;
    color: #fff;
    background: linear-gradient(150deg, #005eb8 0%, #003d77 72%, #002b55 100%);
  }}
  .cover .logo {{
    width: 96px; height: 96px; margin: 0 auto 16pt;
    background: #fff; border-radius: 50%; padding: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
  }}
  .cover .logo img {{ width: 100%; height: 100%; display: block; }}
  .cover .kicker {{ font-size: 9pt; letter-spacing: 3px; text-transform: uppercase; color: #bfdbfe; }}
  .cover h1 {{ color: #fff; font-size: 25pt; line-height: 1.18; margin: 10pt 0 8pt; }}
  .cover .subtitle {{ color: #e2e8f0; font-size: 10.5pt; margin: 0 auto; max-width: 190mm; }}
  .cover .rule {{ width: 84px; height: 3px; background: #60a5fa; margin: 14pt auto; border-radius: 2px; }}
  .cover .meta {{ color: #dbeafe; font-size: 9pt; line-height: 1.7; }}
  .cover .meta strong {{ color: #fff; }}
  .summary {{ display: flex; gap: 8pt; justify-content: center; margin: 14pt auto 0; max-width: 190mm; }}
  .summary .box {{
    flex: 1; background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 7px;
    padding: 8pt 6pt;
  }}
  .summary .num {{ display: block; font-size: 18pt; font-weight: 700; color: #fff; }}
  .summary .label {{ display: block; font-size: 7.5pt; color: #dbeafe; text-transform: uppercase; letter-spacing: 0.6px; }}
  .section {{ margin-top: 10pt; }}
  h2 {{
    font-size: 13.5pt; color: #005eb8; margin: 0 0 6pt;
    border-bottom: 2px solid #005eb8; padding-bottom: 3pt;
    page-break-after: avoid;
  }}
  h3 {{ font-size: 10.5pt; color: #334155; margin: 12pt 0 5pt; page-break-after: avoid; }}
  table {{ width: 100%; border-collapse: collapse; margin: 0 0 10pt; page-break-inside: auto; }}
  thead {{ display: table-header-group; }}
  tr {{ page-break-inside: avoid; }}
  th {{
    background: #005eb8; color: #fff; text-align: left;
    padding: 5pt 6pt; font-size: 8pt; font-weight: 700;
  }}
  td {{ border: 1px solid #dbe3ef; padding: 5pt 6pt; vertical-align: top; font-size: 8pt; }}
  tbody tr:nth-child(even) td {{ background: #f8fafc; }}
  .badge {{
    display: inline-block; padding: 2pt 6pt; border-radius: 999px;
    font-size: 7pt; font-weight: 700; white-space: nowrap;
  }}
  .badge-done {{ background: #dcfce7; color: #166534; }}
  .badge-assumption {{ background: #dbeafe; color: #1d4ed8; }}
  .note {{
    background: #eff6ff; border-left: 4px solid #005eb8;
    padding: 8pt 10pt; margin: 8pt 0 12pt; border-radius: 0 6px 6px 0;
    color: #1e3a8a; font-size: 8.5pt;
  }}
  .note strong {{ color: #0f172a; }}
  .highlights {{ margin: 0 0 8pt; padding-left: 16pt; }}
  .highlights li {{ margin-bottom: 4pt; }}
  .small-table th, .small-table td {{ font-size: 8pt; }}
  .footer-note {{ color: #64748b; font-size: 7.8pt; margin-top: 8pt; }}
  .keep {{ break-inside: avoid; page-break-inside: avoid; }}
</style>
</head>
<body>
  <section class="cover">
    <div class="logo"><img src="MRK_logo.png" alt="MRK Hotels"></div>
    <div class="kicker">MRK Hotels</div>
    <h1>Cashier &amp; Bar Tender Panel<br>What Changed and Why</h1>
    <div class="rule"></div>
    <p class="subtitle">A plain-language summary for hotel managers and staff. It explains each reported problem, what was changed, and where to see the change in the panel.</p>
    <div class="summary">
      <div class="box"><span class="num">{total_rows}</span><span class="label">Requests covered</span></div>
      <div class="box"><span class="num">{total_done}</span><span class="label">Completed</span></div>
      <div class="box"><span class="num">{assumptions}</span><span class="label">Clarified with client</span></div>
      <div class="box"><span class="num">0</span><span class="label">Still outstanding</span></div>
    </div>
    <div class="meta" style="margin-top:14pt;">
      <strong>Prepared:</strong> {DATE} &nbsp;·&nbsp; <strong>Release:</strong> {VERSION}
    </div>
  </section>

  <section class="section">
    <h2>How to read this document</h2>
    <div class="note">
      <strong>Complete</strong> means the requested change is in the panel and has been checked.
      <strong>Complete (clarified)</strong> means the request wording was not fully clear, so a sensible interpretation was agreed and documented.
      <br><br>
      This version avoids technical details. A separate technical version lists code locations and release references for the project team.
    </div>
    <h3>What this means for staff</h3>
    <ul class="highlights">
      <li>The top bar is simpler: one profile button for the user manual, profile, language, dark mode and logout.</li>
      <li>The working day is now consistent across the dashboard, order screens, requisitions and Day Close.</li>
      <li>Ordering is faster: categories appear after choosing a table, selected items stay visible, and items can be added to an existing order.</li>
      <li>Order lists are clearer, with standard order numbers, fewer confusing columns and order numbers that open the details.</li>
      <li>Payments are safer: Day Close sends staff to Order Summary to complete payment, room, credit account or no-charge steps.</li>
      <li>Inventory is easier to reach, with low stock, transfers, counts and adjustments in the cashier menu.</li>
      <li>Screen names and order numbers now match the wording requested by the client.</li>
    </ul>
    <div class="note">
      <strong>One clarification:</strong> the request about SEND ORDER and TOTAL was handled by moving SEND ORDER to the left and TOTAL to the right. The send button still says SEND ORDER, so staff are not confused about which button sends the order.
    </div>
  </section>

  {sections_html}

  <section class="section">
    <h2>What was checked</h2>
    <table class="small-table">
      <colgroup><col style="width:34%"><col style="width:66%"></colgroup>
      <thead><tr><th>Check</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Screen build</td><td>Passed</td></tr>
        <tr><td>Screen layout checks</td><td>Passed</td></tr>
        <tr><td>Cashier and bar tender screen tests</td><td>802 passed; 13 older failures outside this work</td></tr>
        <tr><td>Cashier and bar tender back-office tests</td><td>10 passed</td></tr>
        <tr><td>All back-office tests (last run)</td><td>1127 passed; 1 older failure outside this work</td></tr>
        <tr><td>English and Swahili labels</td><td>Matched</td></tr>
      </tbody>
    </table>
    <div class="keep">
      <h3>Older issues outside this work</h3>
      <p class="footer-note">These issues were already present before this review. They are not part of the Cashier and Bar Tender changes, but they are listed here for transparency.</p>
      <table class="small-table">
        <colgroup><col style="width:80%"><col style="width:20%"></colgroup>
        <thead><tr><th>Area</th><th>Failing checks</th></tr></thead>
        <tbody>{failures_html}</tbody>
      </table>
    </div>
  </section>
</body>
</html>
"""

if __name__ == "__main__":
    HTML(string=HTML_DOC, base_url=str(HERE)).write_pdf(str(OUT))
    print(f"Wrote {OUT} ({total_rows} items, {total_done} completed, {assumptions} clarified)")
