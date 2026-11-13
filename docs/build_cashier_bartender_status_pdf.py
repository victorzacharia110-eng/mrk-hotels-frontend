#!/usr/bin/env python3
"""Build the Cashier & Bar Tender panel problems/solutions/status PDF."""
from html import escape
from pathlib import Path

from weasyprint import HTML

HERE = Path(__file__).parent
OUT = HERE / "MRK_Cashier_Bartender_Panel_Problems_Solutions_Status.pdf"
DATE = "9 November 2026"
VERSION = "v1.0.162"
FRONTEND_COMMIT = "96ff697"
BACKEND_COMMIT = "e7236da"

SECTIONS = [
    (
        "1. Top Panel & Access",
        [
            (
                "Top-right area showed CASHIER/BAR TENDER wording and a separate Waiter Assignment shortcut; user manual, profile, language and dark mode were scattered.",
                "Removed the role wording and Waiter Assignment shortcut. The clickable profile now contains User Manual, My Profile, Dark Mode, English/Swahili and Logout.",
                "Done",
                "Top-right profile menu | src/layouts/CashierLayout.vue",
            ),
            (
                "Outlet selection listed all store outlets, including non-selling outlets, so a cashier could pick a counter that does not sell.",
                "Outlet gate now loads only sellable outlets via sellingOnly: true. The selected outlet drives orders, stock and reports.",
                "Done",
                "Outlet gate after login | src/layouts/CashierLayout.vue",
            ),
            (
                "Menu maintenance was reachable from the cashier panel and produced errors; the client wants menu editing only on the management panel.",
                "Removed Menu from the cashier sidebar and restricted menu routes/actions to hotel_admin and manager. MenuListPage keeps the management gate.",
                "Done",
                "Cashier sidebar removed; Management > Menu | src/router/index.js | src/utils/menuAccess.js | src/pages/menu/MenuListPage.vue",
            ),
        ],
    ),
    (
        "2. Dashboard",
        [
            (
                "Switching Restaurant/Bar after choosing a table locked categories and wiped the selected menu items.",
                "The department switch now preserves the selected table and selected item lines. Users can continue the ticket after switching.",
                "Done",
                "Dashboard > Restaurant/Bar toggle | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Dashboard used a from/to calendar interval, which contradicted the single Day Close business date.",
                "Replaced the interval with one business-date input, synced to Day Close rather than the wall-clock date.",
                "Done",
                "Dashboard > date field | src/pages/dashboards/OrderTakerDashboard.vue | src/stores/workingDate.js",
            ),
            (
                "Dashboard LOW STOCK count was not scoped to the selected department and had no link to the full low-stock list.",
                "LOW STOCK now uses department/outlet-scoped menu stock and includes an arrow that opens the Low Stock page.",
                "Done",
                "Dashboard > Low Stock card | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Menu-item reorder level was inherited from store inventory; the client wants a separate menu reorder level.",
                "Added a menu reorder-level field on the menu item form; dashboard low stock uses that menu-level value.",
                "Done",
                "Management > Menu > item form | src/pages/menu/MenuListPage.vue | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Low Stock table combined QTY and SI Unit, and reorder values did not reflect the menu item setup.",
                "Separated SI Unit into its own column; QTY and Reorder Level are numeric; reorder level comes from the menu item.",
                "Done",
                "Dashboard > Low Stock table; Inventory > Low Stock | src/pages/dashboards/OrderTakerDashboard.vue | src/pages/cashier/CashierLowStockPage.vue",
            ),
            (
                "Requisition page button on the dashboard did not link to the requisition section.",
                "The dashboard requisition summary now links to the working Requisitions page.",
                "Done",
                "Dashboard > Requisitions > View requisitions | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Extra command buttons below the requisition summary linked to unrelated pages.",
                "Removed the command buttons below the requisition summary.",
                "Done",
                "Dashboard > below Requisitions | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
        ],
    ),
    (
        "3. Ingredients",
        [
            (
                "Ingredients menu tree skipped sub-categories and jumped from category straight to menu items.",
                "Grouped the left menu tree by registered sub-category, falling back to category only for older rows.",
                "Done",
                "Cashier > Ingredients > left menu tree | src/pages/cashier/CashierIngredientsPage.vue",
            ),
            (
                "Add Ingredient inventory dropdown was not searchable and only exposed a limited list.",
                "Replaced it with a searchable dropdown listing the full registered inventory.",
                "Done",
                "Cashier > Ingredients > Add | src/pages/cashier/CashierIngredientsPage.vue",
            ),
            (
                "Add Ingredient dropdown attached stock counts to item labels.",
                "Removed stock counts from the dropdown labels; the picker now shows registered item names only.",
                "Done",
                "Cashier > Ingredients > Add > Inventory Item | src/pages/cashier/CashierIngredientsPage.vue",
            ),
            (
                "SI Unit was a manual fill-in field instead of following the registered inventory item.",
                "SI Unit is now read-only and auto-fills from the selected inventory item (si_unit or unit).",
                "Done",
                "Cashier > Ingredients > Add > SI Unit | src/pages/cashier/CashierIngredientsPage.vue",
            ),
            (
                "The ingredients header had a default KITCHEN/BAR MENU dropdown even though those menus do not exist.",
                "Removed the default KITCHEN/BAR MENU dropdown.",
                "Done",
                "Cashier > Ingredients header | src/pages/cashier/CashierIngredientsPage.vue",
            ),
            (
                "Ingredient QTY showed more than the standard two decimal places.",
                "QTY is displayed and edited with two decimals (step 0.01).",
                "Done",
                "Cashier > Ingredients > QTY | src/pages/cashier/CashierIngredientsPage.vue",
            ),
        ],
    ),
    (
        "4. Product Library",
        [
            (
                "The old ITEM LOOKUP page name overlapped with EZEE and was not differentiated.",
                "Renamed the page to PRODUCT LIBRARY in navigation, titles and routes.",
                "Done",
                "Cashier > Product Library | src/pages/cashier/CashierItemLookupPage.vue | src/locales/en.json | src/locales/sw.json",
            ),
            (
                "Search was on the first tab instead of the top of the product table; categories and sub-categories were not presented like the waiter panel.",
                "Moved search to the top; added horizontal category buttons and a sub-category row filtered by the selected category.",
                "Done",
                "Cashier > Product Library > search and category rows | src/pages/cashier/CashierItemLookupPage.vue",
            ),
            (
                "Product table had SKU, OPEN PRICE and DISCOUNT columns, and lacked SI Unit and Sub Category.",
                "Removed SKU, OPEN PRICE and DISCOUNT; added SI Unit and Sub Category columns.",
                "Done",
                "Cashier > Product Library table | src/pages/cashier/CashierItemLookupPage.vue",
            ),
            (
                "An extra tab beside the item lookup table and the default dropdown duplicated the page.",
                "Removed the extra tab and the default dropdown.",
                "Done",
                "Cashier > Product Library | src/pages/cashier/CashierItemLookupPage.vue",
            ),
        ],
    ),
    (
        "5. Shift Manager & Day Close",
        [
            (
                "Shift history had no calendar and did not use the business date.",
                "Added a business-date calendar synced to Day Close, defaulting to the current business date.",
                "Done",
                "Cashier > Shift Manager > History date | src/pages/cashier/CashierShiftManagerPage.vue",
            ),
            (
                "Shift history date filtering did not handle shifts opened on one day and closed on another.",
                "Closed shifts now appear under their closed date; open shifts still appear under their opened date.",
                "Done",
                "Cashier > Shift Manager > History | app/Http/Controllers/Api/V1/FoodBeverage/PosShiftController.php",
            ),
            (
                "Day Close allowed a running order to be settled inline, sometimes without the required provider.",
                "Settle now redirects to Order Summary so payment method/provider or room/creditor/no-charge flow is completed there.",
                "Done",
                "Cashier > Day Close > Settle | src/pages/cashier/CashierDayClosePage.vue",
            ),
            (
                "Closed Days table could grow without a practical limit.",
                "Closed Days history is capped to the last 30 records.",
                "Done",
                "Cashier > Day Close > Closed Days | src/pages/cashier/CashierDayClosePage.vue",
            ),
            (
                "Timezone setting was shown on the cashier Day Close panel.",
                "Removed timezone settings from the cashier panel; it remains on the management Hotel Settings page.",
                "Done",
                "Management > Hotel Settings > Timezone | src/pages/settings/HotelSettingsPage.vue",
            ),
            (
                "After closing the business day the page did not clearly return the user to the dashboard.",
                "Successful Close Day now redirects to the dashboard on the new business date.",
                "Done",
                "Cashier > Day Close > Close Day | src/pages/cashier/CashierDayClosePage.vue",
            ),
        ],
    ),
    (
        "6. Blocked Devices & Net Lock",
        [
            (
                "Blocked Devices page had no useful purpose and cluttered the cashier sidebar.",
                "Muted the page from the sidebar until a useful purpose is defined; the page itself is retained.",
                "Done",
                "Cashier sidebar (hidden) | src/layouts/CashierLayout.vue | src/router/index.js",
            ),
            (
                "Transaction Lock had no way to unfreeze a locked order from the list.",
                "Added an Unlock action on each row. Only cashier, bartender and management can unlock; waiters cannot.",
                "Done",
                "Cashier > Net Lock > row action | src/pages/cashier/CashierTransactionLockPage.vue | app/Http/Controllers/Api/V1/FoodBeverage/CashierController.php",
            ),
            (
                "Settled or voided orders could be locked even though only running orders should be lockable.",
                "Freeze now rejects closed orders; the cashier action only arms for running tickets.",
                "Done",
                "Cashier > Order Summary > Freeze; Cashier > Net Lock | app/Http/Controllers/Api/V1/FoodBeverage/CashierController.php",
            ),
        ],
    ),
    (
        "7. New Order / In House",
        [
            (
                "Categories and menu search were available before a table was chosen.",
                "Category rail and search results are now gated until a table is selected.",
                "Done",
                "Cashier > In House > New Order | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "A selected table could not be unselected, and revisiting the user's own occupied table did not show the existing order.",
                "Tapping the selected table releases it. Revisiting the user's own occupied table loads its existing lines for additional ordering.",
                "Done",
                "Cashier > In House > table map | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Item selection area was too small to comfortably browse menu items.",
                "Increased the item picker height to show two full rows at once.",
                "Done",
                "Cashier > In House > item grid | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Stock shown on menu items did not clearly follow the selected outlet or accepted indent stock.",
                "Menu stock is loaded with the selected outlet and uses the department/outlet stock snapshot, including accepted indent quantities.",
                "Done",
                "Cashier > In House > item stock badge | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Selected Items tab repeated TABLE on every line and broke the list into page start/page end.",
                "Removed the TABLE column and paging; the selected list is continuous and scrollable. Price and Amount columns are present.",
                "Done",
                "Cashier > In House > Selected Items | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "SEND ORDER and TOTAL placement did not match the PDF wording.",
                "Resolved as a position swap: SEND ORDER action on the left, TOTAL amount on the right. The send action keeps its correct label.",
                "Done (assumption)",
                "Cashier > In House > Selected Items bottom row | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "There was no way to add new menu items on top of an existing order, and reprints could duplicate old items.",
                "Added the Order Summary + button and own-table continuation. Only newly added lines are printed on the additional KOT.",
                "Done",
                "Order Summary > order > +; In House > occupied table | src/pages/cashier/CashierOrderSummaryPage.vue | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
        ],
    ),
    (
        "8. Open Orders & My Orders",
        [
            (
                "Open Orders calendar had a clear/X button and defaulted to the wall-clock date.",
                "Removed the clear action and defaulted to the Day Close business date.",
                "Done",
                "Cashier > In House > Open Orders date | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "VOID ALL was a bulk action with unclear placement.",
                "Renamed the action to VOID, kept per-order void beside split/transfer/merge, and kept the selected-orders void as a counted action.",
                "Done",
                "Cashier > In House > Open Orders toolbar/card | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Open Orders search tried to locate guest/order number instead of waiter.",
                "Search now filters by waiter name only.",
                "Done",
                "Cashier > In House > Open Orders search | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "Order template number/date/time layout was unclear, and every item showed PENDING and a bell icon.",
                "Applied ORD-YYYY-NNNN numbering, positioned date/time clearly, removed per-item PENDING and bell icons, and added price/amount columns.",
                "Done",
                "Cashier > In House > Open Orders card | src/pages/dashboards/OrderTakerDashboard.vue | app/Support/NumberGenerator.php",
            ),
            (
                "Open Orders filters included SERVED, READY and UNPAID.",
                "Replaced them with All / Running / Settled.",
                "Done",
                "Cashier > In House > Open Orders filter chips | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "My Orders calendar had a clear/X button and defaulted to the wall-clock date.",
                "Removed the clear action and defaulted to the Day Close business date.",
                "Done",
                "Cashier > In House > My Orders date | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "My Orders top panel used RUNNING and TOTAL TODAY.",
                "Renamed RUNNING to PENDING and TOTAL TODAY to TOTAL.",
                "Done",
                "Cashier > In House > My Orders top cards | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "My Orders status dropdown only offered PENDING.",
                "Added COMPLETED to the status dropdown so pending and completed orders can be filtered.",
                "Done",
                "Cashier > In House > My Orders status filter | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
            (
                "My Orders table showed date, waiter and an action column.",
                "Removed date (kept time), waiter and action columns; order number is clickable and opens the order details.",
                "Done",
                "Cashier > In House > My Orders table | src/pages/dashboards/OrderTakerDashboard.vue",
            ),
        ],
    ),
    (
        "9. Take Out, No Charge, Room Service & Delivery",
        [
            (
                "Take Out and No Charge top commands used ALL / PREPARING / READY / COMPLETED.",
                "Replaced them with PENDING / SETTLED / VOIDED.",
                "Done",
                "Cashier > Take Out; Cashier > No Charge | src/pages/cashier/CashierTakeAwayPage.vue | src/pages/cashier/CashierNoChargePage.vue",
            ),
            (
                "Working date calendars had back/forward arrows and could drift from Day Close.",
                "Removed the arrows and synced the date to the business date.",
                "Done",
                "Take Out, No Charge, Room Service, Delivery date fields | src/components/cashier/OrderDateNav.vue",
            ),
            (
                "Take Out ordering tab had vertical categories, missing sub-categories and an oversized menu list.",
                "Categories are horizontal, sub-categories appear inside the item list, and the menu list is resized so selected lines stay visible.",
                "Done",
                "Cashier > Take Out > New Take Out | src/components/cashier/NewOrderModal.vue",
            ),
            (
                "Take Out order table had date, unclear order numbers and non-clickable order numbers.",
                "Applied ORD-TK-YYYY-NNNN, removed date (kept time), and made order numbers open the order peek.",
                "Done",
                "Cashier > Take Out table | src/pages/cashier/CashierTakeAwayPage.vue | app/Support/NumberGenerator.php",
            ),
            (
                "Room Service top commands used ALL / PREPARING / READY / COMPLETED.",
                "Replaced them with PENDING / SETTLED / VOIDED.",
                "Done",
                "Cashier > Room Service | src/pages/cashier/CashierRoomServicePage.vue",
            ),
            (
                "Room Service in-house guest tab had a shopping-cart icon on the order action.",
                "Removed the cart icon and kept the word ORDER.",
                "Done",
                "Cashier > Room Service > In-house guest tab | src/pages/cashier/CashierRoomServicePage.vue",
            ),
            (
                "Some Room Service menu items were unclickable and could not be selected.",
                "Out-of-stock items are clickable and show a clear toast instead of silently failing; in-stock items can always be added.",
                "Done",
                "Cashier > Room Service > ordering tab | src/components/cashier/NewOrderModal.vue",
            ),
            (
                "Room Service order table lacked waiter, showed an item column and included the date.",
                "Added waiter, removed the item column, removed date (kept time), and applied ORD-RS-YYYY-NNNN.",
                "Done",
                "Cashier > Room Service table | src/pages/cashier/CashierRoomServicePage.vue | app/Support/NumberGenerator.php",
            ),
            (
                "Delivery top commands used PREPARING / READY / COMPLETED.",
                "Replaced them with PENDING / SETTLED / VOIDED.",
                "Done",
                "Cashier > Delivery | src/pages/cashier/CashierDeliveryPage.vue",
            ),
            (
                "ADD DELIVERY ORDER button showed two plus icons.",
                "Removed the duplicate plus icon.",
                "Done",
                "Cashier > Delivery > Add Order | src/pages/cashier/CashierDeliveryPage.vue",
            ),
            (
                "Delivery ordering tab had no way to select a driver.",
                "Added a searchable driver dropdown backed by the waiter roster.",
                "Done",
                "Cashier > Delivery > New Delivery Order | src/components/cashier/NewOrderModal.vue",
            ),
            (
                "Delivery order table lacked waiter and sender/driver columns.",
                "Added Waiter and Sender/Driver columns and applied ORD-DM-YYYY-NNNN.",
                "Done",
                "Cashier > Delivery table | src/pages/cashier/CashierDeliveryPage.vue | app/Support/NumberGenerator.php",
            ),
        ],
    ),
    (
        "10. Requisitions",
        [
            (
                "The title STORE REQUISITIONS did not match the page purpose.",
                "Renamed it to REQUISITIONS.",
                "Done",
                "Cashier > Requisitions | src/locales/en.json | src/locales/sw.json",
            ),
            (
                "Requisition calendar had an interval and a clear/X action.",
                "Replaced it with one business-date calendar, no clear action, synced to Day Close.",
                "Done",
                "Cashier > Requisitions date | src/pages/requisitions/RequisitionPage.vue",
            ),
            (
                "Requisition status was a dropdown.",
                "Replaced it with a Pending/Complete segmented filter.",
                "Done",
                "Cashier > Requisitions > Pending/Complete | src/pages/requisitions/RequisitionPage.vue",
            ),
            (
                "Requisition reference used the old numbering format.",
                "Requisitions now use RQ-YYYY-NNNN.",
                "Done",
                "Cashier > Requisitions > S/N | app/Support/NumberGenerator.php",
            ),
            (
                "New requisition item dropdown was limited, items were not selectable and SI Unit was missing.",
                "Dropdown is searchable, lists department-eligible registered items, items are selectable, and SI Unit is shown per line.",
                "Done",
                "Cashier > Requisitions > New | src/pages/requisitions/RequisitionPage.vue",
            ),
            (
                "INDENT FORWARD naming was confusing.",
                "Renamed it to INDENT RECEIVED.",
                "Done",
                "Cashier > Requisitions tabs | src/locales/en.json | src/locales/sw.json",
            ),
            (
                "Requisition section had a search bar that duplicated the date/filter workflow.",
                "Removed the search bar.",
                "Done",
                "Cashier > Requisitions toolbar | src/pages/requisitions/RequisitionPage.vue",
            ),
            (
                "Requisition/Indent tables had an action column and did not surface requested-by.",
                "Removed the action column; actions live in the detail modal, which shows Requested By.",
                "Done",
                "Cashier > Requisitions table/detail | src/pages/requisitions/RequisitionPage.vue",
            ),
        ],
    ),
    (
        "11. Order Summary",
        [
            (
                "Order Summary working date used a calendar with back/forward arrows.",
                "Removed the arrows and synced the date to the business date.",
                "Done",
                "Cashier > Order Summary date | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "There was no filter by order type.",
                "Added an order-type dropdown filter.",
                "Done",
                "Cashier > Order Summary > order type filter | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Search by order number was not useful and did not locate orders by waiter.",
                "Search now filters by waiter name.",
                "Done",
                "Cashier > Order Summary search | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Command centre included VIEW, UNFREEZE, RECALL and VOID ALL; VOID SELECTED had the wrong name.",
                "Removed VIEW, UNFREEZE, RECALL and VOID ALL. Renamed VOID SELECTED to VOID.",
                "Done",
                "Cashier > Order Summary command bar | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Order Summary table included the date even though a calendar exists.",
                "Removed the date and kept the time.",
                "Done",
                "Cashier > Order Summary table | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "The order drawer only allowed editing existing items; there was no + action to add items, and quantity edits failed with 'The quantity field is required.'",
                "Replaced EDIT ITEMS with a pencil icon and added +. Quantity updates now send the correct payload.",
                "Done",
                "Cashier > Order Summary > order > pencil/+ | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Voiding from the order drawer did not clearly return to the summary.",
                "Void now closes the drawer, reloads the list and returns the user to Order Summary.",
                "Done",
                "Cashier > Order Summary > order > Void | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Transfer could not select a free table or a table occupied by the same user.",
                "Transfer now offers free tables and the user's own occupied tables as valid destinations.",
                "Done",
                "Cashier > Order Summary > order > Transfer | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Voided order details did not show the reason for voiding.",
                "The order peek/drawer now shows the void reason, by whom and when.",
                "Done",
                "Cashier > Order Summary > Voided > order | src/components/cashier/OrderPeekModal.vue | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
            (
                "Settle only supported payment and room posting; creditors and no-charge accounts were missing.",
                "Added Creditor and No Charge modes with registered account selection.",
                "Done",
                "Cashier > Order Summary > Settle | src/pages/cashier/CashierOrderSummaryPage.vue",
            ),
        ],
    ),
    (
        "12. Inventory Dropdown & Renaming",
        [
            (
                "Cashier/bar tender panel had no inventory dropdown like the inventory panel.",
                "Added an Inventory accordion with Low Stock, Stock Transfers, Stock Count and Stock Adjustment, with role-aware access.",
                "Done",
                "Cashier sidebar > Inventory | src/layouts/CashierLayout.vue | src/router/index.js",
            ),
            (
                "Inventory read endpoints were blocked for cashier/bartender by the numeric level middleware.",
                "Added pos-inventory middleware that lets cashier/bartender through while preserving numeric minimums for other roles.",
                "Done",
                "Inventory pages and APIs | app/Http/Middleware/CheckPosInventoryAccess.php | bootstrap/app.php | routes/api.php",
            ),
            (
                "Panel names did not match the client's requested terminology.",
                "Renamed DINE IN to IN HOUSE, TAKE AWAY to TAKE OUT, DELIVERY MANAGER to DELIVERY, ITEM LOOKUP to PRODUCT LIBRARY and TRANSACTION LOCK to NET LOCK.",
                "Done",
                "Cashier sidebar and page titles | src/locales/en.json | src/locales/sw.json | src/router/index.js",
            ),
            (
                "Take-away, room-service, delivery and requisition numbers included a tenant code instead of the requested sequential format.",
                "Order numbers now use ORD/ORD-TK/ORD-RS/ORD-DM-YYYY-NNNN and requisitions use RQ-YYYY-NNNN.",
                "Done",
                "Order/requisition lists and printouts | app/Support/NumberGenerator.php",
            ),
        ],
    ),
]

KNOWN_FAILURES = [
    ("Frontend", "amend-group.spec.js", "4"),
    ("Frontend", "folio-ops.spec.js", "2"),
    ("Frontend", "group-booking-room-picker.spec.js", "2"),
    ("Frontend", "hotel-dashboard-management-band.spec.js", "3"),
    ("Frontend", "room-occupancy.spec.js", "2"),
    ("Backend", "HousekeepingDashboardTest (date-bound completed_today)", "1"),
]


def status_class(status: str) -> str:
    if status.startswith("Done (assumption)"):
        return "badge badge-assumption"
    if status.startswith("Done"):
        return "badge badge-done"
    return "badge badge-neutral"


def where_cell(text: str) -> str:
    parts = [p.strip() for p in text.split("|") if p.strip()]
    out = []
    for part in parts:
        safe = escape(part)
        if part.startswith(("src/", "app/", "database/", "bootstrap/", "routes/", "tests/")):
            out.append(f'<span class="path">{safe}</span>')
        else:
            out.append(safe)
    return "<br>".join(out)


def section_html(title: str, rows) -> str:
    body = []
    for problem, solution, status, where in rows:
        body.append(
            "<tr>"
            f"<td>{escape(problem)}</td>"
            f"<td>{escape(solution)}</td>"
            f'<td><span class="{status_class(status)}">{escape(status)}</span></td>'
            f"<td>{where_cell(where)}</td>"
            "</tr>"
        )
    return f"""
    <section class="section">
      <h2>{escape(title)}</h2>
      <table>
        <colgroup>
          <col style="width:26%">
          <col style="width:39%">
          <col style="width:10%">
          <col style="width:25%">
        </colgroup>
        <thead>
          <tr>
            <th>Problem / PDF request</th>
            <th>Solution implemented</th>
            <th>Status</th>
            <th>Where to find it</th>
          </tr>
        </thead>
        <tbody>{''.join(body)}</tbody>
      </table>
    </section>
    """


total_rows = sum(len(rows) for _, rows in SECTIONS)
total_done = sum(1 for _, rows in SECTIONS for row in rows if row[2].startswith("Done"))
assumptions = sum(1 for _, rows in SECTIONS for row in rows if "assumption" in row[2])

failures_html = "".join(
    f"<tr><td>{escape(system)}</td><td><span class='path'>{escape(name)}</span></td><td>{escape(count)}</td></tr>"
    for system, name, count in KNOWN_FAILURES
)

sections_html = "".join(section_html(title, rows) for title, rows in SECTIONS)

HTML_DOC = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MRK Hotels — Cashier &amp; Bar Tender Panel: Problems, Solutions &amp; Status</title>
<style>
  @page {{
    size: A4 landscape;
    margin: 14mm 10mm 14mm 10mm;
    @top-left {{
      content: "MRK Hotels — Cashier & Bar Tender Panel: Problems, Solutions & Status";
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
  html {{ font-size: 8.6pt; }}
  body {{
    font-family: "DejaVu Sans", "Noto Sans", sans-serif;
    color: #1e293b;
    line-height: 1.42;
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
  .summary {{
    display: flex; gap: 8pt; justify-content: center; margin: 14pt auto 0; max-width: 190mm;
  }}
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
  table {{
    width: 100%; border-collapse: collapse; margin: 0 0 10pt;
    page-break-inside: auto;
  }}
  thead {{ display: table-header-group; }}
  tr {{ page-break-inside: avoid; }}
  th {{
    background: #005eb8; color: #fff; text-align: left;
    padding: 5pt 6pt; font-size: 7.8pt; font-weight: 700;
  }}
  td {{
    border: 1px solid #dbe3ef; padding: 5pt 6pt;
    vertical-align: top; font-size: 7.8pt;
  }}
  tbody tr:nth-child(even) td {{ background: #f8fafc; }}
  .badge {{
    display: inline-block; padding: 2pt 6pt; border-radius: 999px;
    font-size: 7pt; font-weight: 700; white-space: nowrap;
  }}
  .badge-done {{ background: #dcfce7; color: #166534; }}
  .badge-assumption {{ background: #dbeafe; color: #1d4ed8; }}
  .badge-neutral {{ background: #e2e8f0; color: #334155; }}
  .path {{
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 6.9pt; color: #475569;
  }}
  .note {{
    background: #eff6ff; border-left: 4px solid #005eb8;
    padding: 8pt 10pt; margin: 8pt 0 12pt; border-radius: 0 6px 6px 0;
    color: #1e3a8a; font-size: 8pt;
  }}
  .note strong {{ color: #0f172a; }}
  .small-table th, .small-table td {{ font-size: 8pt; }}
  .footer-note {{ color: #64748b; font-size: 7.5pt; margin-top: 8pt; }}
  .keep {{ break-inside: avoid; page-break-inside: avoid; }}
  h3 {{ font-size: 10.5pt; color: #334155; margin: 12pt 0 5pt; page-break-after: avoid; }}
</style>
</head>
<body>
  <section class="cover">
    <div class="logo"><img src="MRK_logo.png" alt="MRK Hotels"></div>
    <div class="kicker">MRK Hotels</div>
    <h1>Cashier &amp; Bar Tender Panel<br>Problems, Solutions &amp; Status</h1>
    <div class="rule"></div>
    <p class="subtitle">Implementation reference for the client review document “CASHIER &amp; BAR TENDER PANEL ALL FEATURES”. Each row maps a PDF problem/request to the change made, its status, and where to find it in the panel.</p>
    <div class="summary">
      <div class="box"><span class="num">{total_rows}</span><span class="label">PDF items covered</span></div>
      <div class="box"><span class="num">{total_done}</span><span class="label">Implemented</span></div>
      <div class="box"><span class="num">{assumptions}</span><span class="label">Assumption noted</span></div>
      <div class="box"><span class="num">0</span><span class="label">Open PDF items</span></div>
    </div>
    <div class="meta" style="margin-top:14pt;">
      <strong>Prepared:</strong> {DATE} &nbsp;·&nbsp; <strong>Frontend:</strong> {VERSION} ({FRONTEND_COMMIT}) &nbsp;·&nbsp; <strong>Backend:</strong> {BACKEND_COMMIT}
    </div>
  </section>

  <section class="section">
    <h2>How to read this document</h2>
    <div class="note">
      <strong>Status:</strong> “Done” means the requested change is implemented and verified in the current code. “Done (assumption)” means the PDF wording was ambiguous and a documented interpretation was used.
      <br><strong>Where to find it:</strong> the first line is the user-facing panel location; monospace lines are the main code references.
      <br><strong>WORKING rows</strong> in the source PDF were intentionally left unchanged. This document focuses on the adjustment/removal/inclusion rows.
      <br><strong>SEND ORDER / TOTAL:</strong> implemented as a position swap (Send left, Total right). A literal word-for-word rename would label the send action “TOTAL”, which would be misleading.
    </div>
  </section>

  {sections_html}

  <section class="section">
    <h2>Verification &amp; known unrelated failures</h2>
    <table class="small-table">
      <colgroup><col style="width:18%"><col style="width:58%"><col style="width:24%"></colgroup>
      <thead><tr><th>Area</th><th>Check</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Frontend</td><td>Production build</td><td>Passed</td></tr>
        <tr><td>Frontend</td><td>ESLint on changed files</td><td>Passed</td></tr>
        <tr><td>Frontend</td><td>Full Vitest suite</td><td>802 passed, 13 failed (unrelated)</td></tr>
        <tr><td>Backend</td><td>StorePosModuleTest</td><td>10 passed, 76 assertions</td></tr>
        <tr><td>Backend</td><td>Full suite (last run)</td><td>1127 passed, 1 unrelated failure</td></tr>
        <tr><td>i18n</td><td>English/Swahili locale parity</td><td>3/3 passed</td></tr>
      </tbody>
    </table>
    <div class="keep">
      <h3>Known unrelated failures</h3>
      <p class="footer-note">These failures predate this review and are outside the Cashier &amp; Bar Tender PDF scope. They are listed for transparency.</p>
      <table class="small-table">
        <colgroup><col style="width:18%"><col style="width:62%"><col style="width:20%"></colgroup>
        <thead><tr><th>System</th><th>Failing spec / test</th><th>Count</th></tr></thead>
        <tbody>{failures_html}</tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <h2>Implementation references</h2>
    <table class="small-table">
      <colgroup><col style="width:22%"><col style="width:78%"></colgroup>
      <thead><tr><th>Repository / commit</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><span class="path">mrk-hotels-frontend</span><br>{FRONTEND_COMMIT}</td><td>Cashier/bar tender panel: complete PDF review fixes</td></tr>
        <tr><td><span class="path">mrk-hotels-api</span><br>{BACKEND_COMMIT}</td><td>Cashier/bar tender panel: complete POS review backend fixes</td></tr>
      </tbody>
    </table>
  </section>
</body>
</html>
"""

if __name__ == "__main__":
    HTML(string=HTML_DOC, base_url=str(HERE)).write_pdf(str(OUT))
    print(f"Wrote {OUT} ({total_rows} items, {total_done} implemented, {assumptions} assumption)")
