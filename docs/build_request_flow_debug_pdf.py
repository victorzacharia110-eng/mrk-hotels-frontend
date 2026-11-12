#!/usr/bin/env python3
"""Build the MRK Hotels frontend-to-backend request flow debug guide."""
from __future__ import annotations

import json
import os
import re
import subprocess
from html import escape
from pathlib import Path

from weasyprint import HTML

HERE = Path(__file__).resolve().parent
OUT = HERE / "MRK_Hotels_Frontend_Backend_Request_Flow_Debug_Guide.pdf"
ROUTE_JSON = Path("/tmp/opencode/mrk-routes.json")
FRONTEND_API = HERE.parent / "src" / "api" / "index.js"
BACKEND_DIR = Path(os.environ.get("MRK_BACKEND_DIR", "/home/victor/Documents/Projects/Apis/LaravelApis/mrk-hotels-api"))
DATE = "12 November 2026"
FRONTEND_COMMIT = "6651477"
BACKEND_COMMIT = "d0de4d4"


def load_routes() -> list[dict]:
    if not ROUTE_JSON.exists() and (BACKEND_DIR / "artisan").exists():
        ROUTE_JSON.parent.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            ["php", "artisan", "route:list", "--json"],
            cwd=BACKEND_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        ROUTE_JSON.write_text(result.stdout)
    return json.loads(ROUTE_JSON.read_text())


def load_api_groups() -> list[str]:
    if not FRONTEND_API.exists():
        return []
    source = FRONTEND_API.read_text()
    return re.findall(r"export const (\w+Api)\s*=\s*\{", source)


def short_action(action: str) -> str:
    action = action.replace("App\\Http\\Controllers\\Api\\V1\\", "")
    action = action.replace("App\\Http\\Controllers\\", "")
    return action.replace("App\\Http\\Middleware\\", "")


def short_middleware(items: list[str]) -> str:
    aliases = {
        "Authenticate": "auth",
        "SetTenantContext": "tenant",
        "EnforceFeatureAvailability": "features",
        "VerifyTrust": "trust",
        "CanOperate": "operate",
        "EnsureReportAccess": "reports",
        "EnsurePosInventoryAccess": "pos-inventory",
        "EnsurePosReportAccess": "pos-reports",
        "CheckRoleLevel": "level",
        "ThrottleRequests": "throttle",
    }
    out = []
    for item in items:
        base, _, arg = item.partition(":")
        base = base.rsplit("\\", 1)[-1]
        out.append(f"{aliases.get(base, base)}{(':' + arg) if arg else ''}")
    return " · ".join(out)


def module_label(slug: str) -> str:
    labels = {
        "auth": "Authentication & session",
        "orders": "F&B orders & settlement",
        "outlets": "Outlets & access codes",
        "fnb": "F&B business date & day close",
        "pos": "POS shifts & devices",
        "cashier": "Cashier board & accounts",
        "inventory": "Inventory catalogue & movements",
        "inventory-stock-adjustments": "Stock adjustments",
        "inventory-stock-takes": "Physical stock takes",
        "inventory-transfers": "Stock transfers",
        "inventory-indents": "Store indents",
        "inventory-goods-returns": "Goods returns",
        "inventory-recipes": "Recipes",
        "inventory-production-runs": "Production runs",
        "inventory-market-lists": "Market lists",
        "purchase-requisitions": "Purchase requisitions",
        "purchase-orders": "Purchase orders",
        "goods-received-notes": "Goods received notes",
        "reservations": "Reservations, check-in & folio",
        "folio": "Folio ledger",
        "payments": "Payments",
        "rooms": "Rooms",
        "guests": "Guests",
        "housekeeping-tasks": "Housekeeping tasks",
        "housekeeping": "Housekeeping dashboard",
        "laundry-orders": "Laundry orders",
        "laundry-cloth-types": "Laundry cloth types",
        "laundry-cloth-compositions": "Laundry compositions",
        "messages": "Messaging & conversations",
        "notifications": "Notifications",
        "reports": "Reports",
        "store": "Store & cash register",
        "menu-items": "Menu items",
        "menu-categories": "Menu categories",
        "menu-sub-categories": "Menu sub-categories",
        "menu-accompaniments": "Menu accompaniments",
        "tables": "Tables",
        "table-locations": "Table locations",
        "users": "Users & staff",
        "tenants": "Tenants & hotels",
        "owner": "Owner portal",
        "owners": "Owner accounts",
        "public": "Public website & booking",
        "portal": "Guest portal",
        "integrations": "Integrations & webhooks",
        "accounting": "Accounting",
        "night-audit": "Night audit",
        "business-date": "Business date",
        "attendance": "Attendance",
        "calls": "Calls",
        "companies": "Company database",
        "invoices": "Invoices",
        "plans": "Subscription plans",
        "distribution": "Distribution channels",
        "importers": "Data import",
        "qz": "QZ printer signing",
    }
    return labels.get(slug, slug.replace("-", " ").title())


def flow_table(rows: list[tuple[str, str, str, str]]) -> str:
    body = []
    for number, where, what, signal in rows:
        body.append(
            "<tr>"
            f"<td class='num'>{escape(number)}</td>"
            f"<td><span class='where'>{escape(where)}</span></td>"
            f"<td>{what}</td>"
            f"<td class='signal'>{signal}</td>"
            "</tr>"
        )
    return (
        "<table class='flow'>"
        "<colgroup><col style='width:5%'><col style='width:23%'><col style='width:44%'><col style='width:28%'></colgroup>"
        "<thead><tr><th>#</th><th>Layer / file</th><th>What happens</th><th>Debug signal</th></tr></thead>"
        f"<tbody>{''.join(body)}</tbody></table>"
    )


FLOWS = [
    (
        "5.1 Login, token issuance and session restore",
        "Use this when a user cannot sign in, is bounced back to the login screen, or the app opens without permissions.",
        [
            ("1", "LoginPage.vue → authApi.login()", "The form posts email, password, optional property code, trust flag and device key to <span class='path'>POST /api/v1/auth/login</span>.", "Network: request body; status 200/401/409/422/429."),
            ("2", "routes/api.php:182", "The route is public but throttled by <span class='path'>throttle:auth</span> and <span class='path'>throttle:auth:ip</span>.", "429 means rate limited; wait or clear the throttle."),
            ("3", "AuthController@login", "Validates credentials. An email used by more than one hotel login returns <b>409</b> with <span class='path'>ambiguous: true</span>.", "409 is not a wrong password; ask the user to choose the hotel/property."),
            ("4", "AuthController@login", "Checks the tenant, user status, role and trusted-device state. Unknown devices may receive a verification challenge instead of a token.", "200 with <span class='path'>requires_device_verification</span> is expected; no token yet."),
            ("5", "AuthController@issueSession()", "Creates a Sanctum personal access token. Superadmin gets ability <span class='path'>['*']</span>; everyone else gets <span class='path'>[user_role]</span>.", "The token is returned once; copy it from the login response for API testing."),
            ("6", "stores/auth.js", "Stores <span class='path'>auth_token</span> in <span class='path'>sessionStorage</span>, user/profile data, and the device key in <span class='path'>localStorage</span>.", "Application → Session Storage / Local Storage."),
            ("7", "router/index.js:795", "The guard sees the token, fetches <span class='path'>GET /api/v1/auth/me</span> (up to 3 attempts), then checks role/module access.", "If <span class='path'>/auth/me</span> fails, the token or tenant context is invalid."),
            ("8", "axios response interceptor", "Any 401 while a token exists clears <span class='path'>auth_token</span> and redirects to <span class='path'>/login</span>.", "A surprise redirect usually means the token expired or the tenant was deactivated."),
        ],
        "<b>Most common cause:</b> a stale <span class='path'>auth_token</span> or wrong <span class='path'>X-Tenant-ID</span>. Confirm <span class='path'>/auth/me</span> first, then inspect the failing call.",
    ),
    (
        "5.2 Trusted device, device challenge and PIN login",
        "Use this when a known user is asked to verify a device, the code never arrives, or PIN login fails.",
        [
            ("1", "LoginPage.vue", "The browser sends a stable <span class='path'>device_key</span> from <span class='path'>localStorage</span> plus <span class='path'>trust_device</span>.", "Missing device key makes every login look like a new device."),
            ("2", "POST /auth/login", "Backend checks whether the device is already trusted for that user and tenant.", "Response contains the challenge/verification requirement."),
            ("3", "POST /auth/login/verify-device", "The emailed/app code is verified. Success issues the normal session token.", "422 = bad/expired code; 429 = resend throttle."),
            ("4", "POST /auth/login/verify-device/resend", "Sends a fresh code and invalidates the old challenge according to cache policy.", "Use only when the first code expired; repeated taps hit throttle."),
            ("5", "POST /auth/login-pin", "PIN login is accepted only for a trusted device and a user with a PIN configured.", "401 means PIN/device mismatch; 422 means PIN not configured."),
            ("6", "DeviceTrustController", "Admins at level 60+ can list and revoke trusted devices at <span class='path'>/auth/trusted-devices</span>.", "If a lost phone must be removed, revoke its row and sign in again."),
        ],
        "<b>Debug:</b> compare the <span class='path'>device_key</span> in Local Storage with the row in the trusted-devices table. Clearing site data intentionally creates a new device.",
    ),
    (
        "5.3 Outlet selection, access code and active outlet",
        "Use this when the cashier/bar or store panel will not open, the outlet list is empty, or an access code is rejected.",
        [
            ("1", "useOutletContext.js", "Loads <span class='path'>GET /api/v1/outlets</span> at level 20. The response includes <span class='path'>stockDepartment</span> and <span class='path'>has_access_code</span>, never the hash.", "Empty list: check tenant, role level and whether outlets exist."),
            ("2", "CashierLayout.vue / StoreManagerLayout.vue", "Filters outlets by type: bar/cashier selling points vs store/inventory outlets, then groups them for the two-step picker.", "A missing tab usually means the outlet has the wrong type or no stock department."),
            ("3", "POST /outlets/{id}/verify-access", "The entered code is compared server-side. This route is level 20 and throttled at 20 requests/minute.", "422 = wrong code; 429 = too many attempts; 403 = role/tenant gate."),
            ("4", "POST /outlets/{id}/claim-access", "If the outlet has no code yet, a manager-level user can claim it and set the first code.", "409/422 means another user already claimed it or the code is already set."),
            ("5", "POST /outlets/{id}/reset-access", "Management at level 70+ with <span class='path'>outlets.manage</span> resets the code and shows the one-time generated code.", "If reset is hidden, the user lacks the permission or is not an outlet manager."),
            ("6", "sessionStorage", "The unlocked outlet is stored as <span class='path'>active_outlet</span>. Feature calls pass its id as <span class='path'>outlet_id</span> or <span class='path'>department_id</span>; it is not a global header.", "Check the request body/query, not only headers, when the backend says an outlet is missing."),
            ("7", "GET /outlets/{id}", "The detail response confirms type, stock department, creator and access-code status.", "Use this to verify the exact outlet behind the UI label."),
        ],
        "<b>Remember:</b> access-code verification unlocks the UI gate; it does not replace role/tenant middleware. Both must pass.",
    ),
    (
        "5.4 Create a food & beverage order",
        "Use this when placing an order fails, stock is rejected, or the order appears in the wrong outlet.",
        [
            ("1", "OrderTakerDashboard.vue / cashier order screen", "Builds the cart, table/room selection, guest name, outlet id and line items, then calls <span class='path'>orderApi.create()</span>.", "Copy the exact payload from the Network tab."),
            ("2", "src/api/index.js → orderApi", "Sends <span class='path'>POST /api/v1/orders</span> with bearer token and JSON body.", "Confirm the URL starts with <span class='path'>/v1/orders</span>, not a duplicated <span class='path'>/api</span>."),
            ("3", "OrderController@store", "Validates outlet, table/room, items, quantities, modifiers and payment-related fields.", "422 response keys identify the exact invalid field."),
            ("4", "OrderController@store", "Checks that the F&B business date is open and cleared, then resolves the stock shelf with <span class='path'>UserDepartment::shelfIdForOrder()</span>.", "Business-date or shelf errors mean the outlet/department link is incomplete."),
            ("5", "FnbInventoryService", "Checks ingredient availability against the resolved shelf before creating the order.", "422 'not enough stock' includes the item; compare shelf stock and recipe quantities."),
            ("6", "DB::transaction", "Creates the order and items, calculates totals and commits. Any exception rolls the whole order back.", "No partial order should remain after a 500/422."),
            ("7", "OrderUpdated event", "Broadcasts to the tenant/kitchen channels after commit so boards refresh.", "If the API succeeds but the kitchen does not update, debug Echo, not the order controller."),
        ],
        "<b>Fast check:</b> repeat the same request with the same outlet, shelf and item ids in an API client. If it fails there too, the problem is backend/domain data, not Vue.",
    ),
    (
        "5.5 Kitchen item status, serve and recall",
        "Use this when the kitchen board does not move an item, or a waiter cannot mark food ready/served.",
        [
            ("1", "KitchenBoardPage.vue", "Loads orders with <span class='path'>GET /api/v1/orders</span> and filters by outlet/business date/status.", "An empty board can be a date, outlet or status filter problem."),
            ("2", "orderApi.markItemStatus()", "Sends <span class='path'>PATCH /api/v1/orders/{id}/items/{itemId}/status</span> with the target status.", "Confirm both ids: order id and order-item id are different."),
            ("3", "OrderController@markItemStatus", "Validates the transition and updates the item state; order-level status may follow.", "422 means the transition is not allowed from the current state."),
            ("4", "OrderUpdated event", "Broadcasts the changed order so cashier, waiter and kitchen boards converge.", "Use browser WebSocket frames to confirm the event arrived."),
            ("5", "Echo channels", "Private tenant/user channels are authorized by <span class='path'>POST /broadcasting/auth</span> using the same Sanctum token.", "401/403 on broadcasting auth means the token or channel authorization failed."),
        ],
        "<b>Split-brain symptom:</b> the database is correct but one screen is stale. Reload that screen; if it then shows the right state, investigate the realtime channel.",
    ),
    (
        "5.6 Settle an order: cash, room bill or credit account",
        "Use this when payment is rejected, an order stays unpaid, or a room/credit posting is wrong.",
        [
            ("1", "CashierOrderSummaryPage.vue / waiter settlement panel", "Calls one of <span class='path'>/orders/{id}/pay</span>, <span class='path'>/orders/{id}/bill-to-room</span> or <span class='path'>/orders/{id}/settle-credit-account</span>.", "The three settlement paths have different validation and different debug signals."),
            ("2", "OrderController@pay", "Locks the order row, rejects frozen/merged/already-paid orders, checks who may collect, then marks paid and records a payment.", "422 is a state problem; 403 is an ownership/role problem."),
            ("3", "OrderController@billToRoom", "Finds an active reservation for the room; if the room is merely occupied, it opens a walk-in folio, then increments room charges atomically.", "422 means no active booking/room or the guest has not arrived."),
            ("4", "OrderController@settleCreditAccount", "Requires an active <span class='path'>creditor</span> or <span class='path'>no_charge</span> account belonging to the tenant.", "422 means the account is inactive, wrong type or from another tenant."),
            ("5", "PaymentService / folio update", "Writes the payment or room/credit posting inside the same transaction as the order state change.", "If the order is paid but no payment/folio row exists, inspect the transaction and logs."),
            ("6", "freeTableIfCleared()", "Releases the table when no running orders remain.", "Table still occupied usually means another running order exists."),
            ("7", "AuditService", "Writes an audit row with settlement mode, provider, user and timestamp.", "Use audit history to prove who settled and when."),
        ],
        "<b>Cash shift check:</b> if cash collection is blocked by register state, open the POS shift first at <span class='path'>/pos/shift/open</span>.",
    ),
    (
        "5.7 Void, split, merge, transfer and freeze",
        "Use this when an order cannot be corrected or the wrong ticket was changed.",
        [
            ("1", "Order actions", "Void uses <span class='path'>POST /orders/{id}/void</span>; split/merge/transfer use their dedicated endpoints.", "Do not edit the database directly; these actions have stock/folio side effects."),
            ("2", "OrderController", "Locks the affected order(s), validates status and permissions, then reverses or moves items.", "422 = invalid state; 403 = wrong role/ownership."),
            ("3", "Inventory reversal", "Voiding may return consumed ingredients to stock; the movement is written with the order reference.", "Check stock movements for the order id if quantities look wrong."),
            ("4", "CashierController@freeze/unfreeze", "Frozen orders cannot be settled until unfrozen. Freeze is level 30 + operate.", "422 'Order is frozen' is intentional, not a broken payment."),
            ("5", "Audit + broadcast", "The change is audited and an <span class='path'>OrderUpdated</span> event is dispatched.", "A missing audit row means the action did not reach the controller."),
        ],
        "<b>Rule:</b> correct a settled ticket through a refund/void workflow, not by deleting the order. Deleting breaks payment and audit history.",
    ),
    (
        "5.8 F&B business date and day close",
        "Use this when the day-close button is disabled, close fails, or reports show the wrong day.",
        [
            ("1", "GET /api/v1/business-date", "The frontend loads the current open business date for the tenant.", "Timezone mismatch is the first thing to check."),
            ("2", "CashierDayClosePage.vue", "Loads close history with <span class='path'>GET /api/v1/fnb/day-closes</span> and posts <span class='path'>POST /api/v1/fnb/day-close</span>.", "The posted date must be <span class='path'>Y-m-d</span> in hotel-local time."),
            ("3", "FbDayCloseController@store", "Rejects the current date, already-closed dates, running orders and unsettled orders.", "422 messages state the exact blocker; 409 means already closed."),
            ("4", "FbDayClose snapshot", "Builds and stores totals/snapshot for the closed date.", "Compare snapshot totals with reports before investigating discrepancies."),
            ("5", "Timezone update", "The day-close screen may update the hotel timezone at <span class='path'>PUT /api/v1/fnb/timezone</span>.", "Changing timezone changes which UTC range belongs to a business date."),
        ],
        "<b>Debug order:</b> confirm timezone → confirm business date → count running orders → count unsettled orders → inspect close snapshot.",
    ),
    (
        "5.9 POS shift and cash register",
        "Use this when the cash drawer is closed, shift history is missing, or expected cash does not match.",
        [
            ("1", "StoreCashRegisterPage.vue / POS screens", "Calls <span class='path'>GET /pos/shift/current</span> to decide whether a shift is open.", "A closed shift blocks cash operations by design."),
            ("2", "POST /pos/shift/open", "Records opening float and opens the drawer for the current user/tenant.", "422 means a shift is already open or the float is invalid."),
            ("3", "POST /pos/shift/close", "Closes against counted cash and stores the variance.", "Compare counted, expected and variance in the response."),
            ("4", "GET /pos/shifts", "Lists historical shifts, newest first.", "Empty history: wrong tenant, date range or no closed shifts."),
            ("5", "CashRegisterController", "Daily summary combines opening float, floats added, expenses, sales and expected cash.", "A date filter must be sent in the request; the server does not guess the UI date."),
        ],
        "<b>Expected-cash mismatch:</b> reconcile payments, cash movements, void/refund rows and shift boundaries before changing code.",
    ),
    (
        "5.10 Inventory catalogue, stock and low-stock views",
        "Use this when items are missing, stock looks wrong, or the store panel shows the wrong shelf.",
        [
            ("1", "inventoryApi / inventoryOpsApi", "Loads <span class='path'>GET /api/v1/inventory</span>, item detail, movements and low-stock views.", "Check query params: <span class='path'>outlet_id</span>, <span class='path'>department_id</span>, category, search, page."),
            ("2", "InventoryController", "Applies tenant scope and optional shelf/department filter, then returns paginated items.", "Wrong shelf usually means the request omitted or sent the wrong department id."),
            ("3", "UserDepartment::shelfIdForOrder()", "Backend resolves the stock shelf for the selected outlet rather than trusting a client-supplied shelf.", "If the outlet has no stock department, stock checks cannot resolve."),
            ("4", "InventoryService", "Returns quantities and movement history; stock is the sum of movements, not an editable field.", "Use movements to explain a quantity, not direct DB edits."),
            ("5", "InventoryUpdated event", "Stock changes broadcast so other open panels refresh.", "Refresh manually to distinguish stale UI from wrong data."),
        ],
        "<b>Important:</b> the outlet/department link is data. Fix the link in outlet/department management before debugging the inventory query.",
    ),
    (
        "5.11 Stock adjustment (wastage, consumption, adjustment)",
        "Use this when a stock adjustment cannot be saved or stock does not change.",
        [
            ("1", "StoreStockAdjustPage.vue", "Builds a sheet with type, business date, reason, line items, quantities and SI units, then calls <span class='path'>POST /api/v1/inventory-stock-adjustments</span>.", "Copy the payload; unit and factor mistakes are common."),
            ("2", "StockAdjustmentController@store", "Validates <span class='path'>type</span> as <span class='path'>wastage|consumption|adjustment</span>, business date and unique items.", "422 names the invalid type/date/item."),
            ("3", "Shelf resolution", "Resolves the shelf through <span class='path'>UserDepartment::shelfIdForOrder()</span>.", "A missing shelf produces a domain error even when the item exists."),
            ("4", "DB::transaction", "Creates the adjustment header/lines and posts stock movements through <span class='path'>InventoryService</span>.", "If the header exists but stock did not move, inspect the transaction/logs."),
            ("5", "Audit + broadcast", "Writes the audit trail and dispatches <span class='path'>InventoryUpdated</span>.", "Audit row proves the write; broadcast is a separate concern."),
        ],
        "<b>SI-unit check:</b> the UI may show cartons while the backend stores base units. Verify the conversion factor on the item.",
    ),
    (
        "5.12 Physical stock take",
        "Use this when a count cannot be saved, posted or voided, or counted quantities do not match stock.",
        [
            ("1", "StoreStockCountsPage.vue", "Loads the count sheet and default item scope, then saves counted quantities with <span class='path'>POST /api/v1/inventory-stock-takes</span>.", "The default scope is the selected shelf; confirm the shelf before counting."),
            ("2", "PhysicalStockTakeController@store", "Validates the count date, items and quantities; creates a draft/count record.", "422 means an item/quantity/date is invalid."),
            ("3", "StockTransactionService::postTake()", "Posts the variance between counted and system quantity as stock movements.", "Compare counted, system and variance before posting."),
            ("4", "StockTransactionService::voidTake()", "Voids the take and reverses its movements.", "A voided take must not still contribute to stock."),
            ("5", "Audit + event", "Records who counted/posted/voided and broadcasts inventory changes.", "Use audit history for accountability."),
        ],
        "<b>Do not edit stock directly.</b> Re-post or void the count so movement history remains explainable.",
    ),
    (
        "5.13 Stock transfer",
        "Use this when a transfer cannot be sent, received stock is wrong, or the destination outlet is missing.",
        [
            ("1", "StoreTransfersPage.vue", "Builds source/destination outlets, lines, SI units and costs, then calls <span class='path'>POST /api/v1/inventory-transfers</span>.", "Only outlets with a stock department should appear."),
            ("2", "StockTransferController@store", "Validates source/destination, items, quantities and the <span class='path'>send</span> flag.", "422 identifies the invalid line or outlet."),
            ("3", "postTransfer()", "Deducts from the source shelf and adds to the destination shelf in one transaction.", "If one side moved and the other did not, inspect transaction logs; it should roll back."),
            ("4", "Status lifecycle", "Draft can be edited; sent/completed is stock-affecting; void reverses the movement.", "Check status before trying to edit."),
            ("5", "Audit + broadcast", "Writes the transfer audit and emits <span class='path'>InventoryUpdated</span>.", "Both outlets should refresh after the event."),
        ],
        "<b>Check first:</b> both outlets must have stock departments, and the destination must not be the source.",
    ),
    (
        "5.14 Requisition → purchase order → goods received note",
        "Use this when procurement documents cannot progress or received goods do not increase stock.",
        [
            ("1", "RequisitionListPage.vue", "Creates/submits a requisition via <span class='path'>/purchase-requisitions</span>.", "Approval state controls whether a PO can be raised."),
            ("2", "PurchaseOrderListPage.vue", "Creates a PO via <span class='path'>POST /purchase-orders</span>, then manager/finance approvals use their dedicated endpoints.", "422 = invalid supplier/item/price; 403 = wrong approval level."),
            ("3", "GoodsReceivedNoteListPage.vue", "Posts <span class='path'>POST /goods-received-notes</span> with PO id, received/rejected quantities, unit costs and attachments.", "422 over-delivery means received quantity exceeds the remaining PO quantity."),
            ("4", "GoodsReceivedNoteController@store", "Runs in a transaction: validates the PO is open, resolves the inventory item, records the GRN, increments received quantity and posts stock in.", "Check the GRN, PO received quantity and stock movement together."),
            ("5", "Unit conversion", "Received quantities in an alternate unit are converted to the item base unit before stock-in.", "A missing conversion factor is rejected rather than posting a wrong quantity."),
            ("6", "Recall/void", "Recalling a GRN requires a reason; after the receiving business day only management may recall it.", "403/422 explains whether the day or role blocks the edit."),
            ("7", "Audit + notification", "Writes audit and notifies procurement/receivers.", "A missing stock increase with a successful GRN is a transaction/log investigation."),
        ],
        "<b>Do not create a second GRN to fix a mistake.</b> Recall or void the original so PO received quantities and stock stay aligned.",
    ),
    (
        "5.15 Reports and exports",
        "Use this when a report is empty, totals disagree with operations, or an export/download fails.",
        [
            ("1", "Report pages", "Call <span class='path'>reportApi</span> endpoints under <span class='path'>/api/v1/reports</span> with date range, outlet/department and filters.", "Copy the query string; most report bugs are wrong filters."),
            ("2", "EnsureReportAccess", "Checks the user's report permission and tenant scope before the controller runs.", "403 means the report is not enabled for that role/hotel."),
            ("3", "Report controller/service", "Aggregates operational tables using the hotel timezone and business date rules.", "Compare one source row (order/payment/stock movement) with the report total."),
            ("4", "Export endpoints", "PDF/CSV generation may stream a file rather than JSON.", "Network response type should be blob; a JSON error shown as a download means backend validation failed."),
            ("5", "Caching/queues", "Some reports or notifications are queued; a missing result may still be processing.", "Check queue worker and failed-jobs table."),
        ],
        "<b>Reconciliation:</b> pick one known transaction, trace it to its source table, then compare with the report filter and timezone.",
    ),
    (
        "5.16 Reservations, check-in, folio and checkout",
        "Use this when a booking cannot be created, check-in fails, or a folio/payment is wrong.",
        [
            ("1", "Reservation pages", "Load <span class='path'>GET /reservations</span>, options and folio; create/update via <span class='path'>POST/PUT /reservations</span>.", "Viewing is level 60; writes also require <span class='path'>operate</span>."),
            ("2", "ReservationController@store/update", "Validates guest, room type, dates, occupancy and rate, then checks availability.", "422 = dates/room/occupancy conflict."),
            ("3", "POST /reservations/{id}/check-in", "Validates arrival, room readiness and overrides, then marks the room occupied and the reservation checked in.", "422 means the room is not ready or the booking state is wrong."),
            ("4", "Folio endpoints", "Charges, discounts, adjustments, inclusions, transfers and attachments post to the folio ledger.", "Use the folio ledger, not the reservation total, to explain a guest bill."),
            ("5", "POST /reservations/{id}/check-out", "Checks unsettled folio balance, posts room charges and releases the room.", "A blocked checkout usually has an unpaid folio entry or unresolved credit posting."),
            ("6", "Invoice/payment", "Invoices generate from the folio; payments are recorded against reservation/folio.", "Trace the payment id and folio entry id together."),
        ],
        "<b>Golden rule:</b> the folio ledger is the source of truth for the guest bill. Reservation totals are a summary and can lag after adjustments.",
    ),
    (
        "5.17 Housekeeping, laundry and guest requests",
        "Use this when tasks do not appear, statuses do not move, or laundry charges do not reach the bill.",
        [
            ("1", "Housekeeping pages", "Load <span class='path'>GET /housekeeping-tasks</span>, dashboard and board at level 40.", "Empty board: check date, room, assignee and status filters."),
            ("2", "Task actions", "Create/assign/start/confirm/verify/complete use dedicated endpoints; some require <span class='path'>can:housekeeping.work</span>.", "403 = role/ability; 422 = invalid task transition."),
            ("3", "Laundry orders", "Create/update at <span class='path'>/laundry-orders</span>; cloth types and compositions are separate registries.", "Missing price = cloth type/composition not configured."),
            ("4", "Guest requests", "Guest portal requests use public/guest-token routes and then appear in staff queues.", "Check the guest portal token and tenant before debugging staff views."),
            ("5", "Charges", "Laundry settlement may post to a room folio or a payment record.", "Follow the same folio/payment trace as F&B room billing."),
        ],
        "<b>Check the registry first:</b> a laundry item cannot be priced or billed until its cloth type and composition exist.",
    ),
    (
        "5.18 Messaging, notifications and realtime",
        "Use this when messages do not arrive, notifications are missing, or live boards do not update.",
        [
            ("1", "conversationApi / notificationApi", "Loads conversations, messages and notifications over normal authenticated HTTP.", "If HTTP works but live updates do not, the issue is Echo/Reverb."),
            ("2", "src/plugins/echo.js", "Creates the Echo/Reverb client and subscribes to private/presence channels.", "Browser console shows WebSocket connection and subscription errors."),
            ("3", "POST /broadcasting/auth", "Authorizes private channels with the Sanctum token and channel rules in <span class='path'>routes/channels.php</span>.", "401/403 here means the token or channel membership is wrong."),
            ("4", "Broadcast events", "<span class='path'>OrderUpdated</span> and <span class='path'>InventoryUpdated</span> are <span class='path'>ShouldBroadcastNow</span>.", "Check the event payload and whether the listener is subscribed to that channel."),
            ("5", "Notifications", "Database notifications are written by services; email/SMS may be queued.", "Check the notifications table, queue worker and failed jobs."),
        ],
        "<b>Separate the layers:</b> HTTP data → event dispatch → queue/Reverb → channel auth → client listener. Fix the first broken layer.",
    ),
    (
        "5.19 Owner portal and superadmin hotel switching",
        "Use this when an owner sees the wrong hotel, cannot edit, or a superadmin action is forbidden.",
        [
            ("1", "Owner pages", "The owner selects a hotel; the frontend stores it as <span class='path'>owner_viewing_hotel</span>.", "Check Session Storage before every owner request."),
            ("2", "axios interceptor", "Adds <span class='path'>X-Tenant-ID</span> from <span class='path'>owner_viewing_hotel</span> to every request.", "If the header is missing, the backend uses the owner's own tenant and returns the wrong scope."),
            ("3", "SetTenantContext", "Allows owner/superadmin switching, but marks owners read-only; staff cannot switch tenants.", "403 on write is expected for an owner unless an override is allowed."),
            ("4", "CanOperate", "Blocks owner writes unless the request carries an allowed <span class='path'>override</span>.", "A read works but a write fails: inspect <span class='path'>operate</span>/override, not the endpoint."),
            ("5", "Superadmin", "Superadmin tokens have <span class='path'>*</span> ability and can switch tenants.", "Still verify the selected <span class='path'>X-Tenant-ID</span>; a valid token can point at the wrong hotel."),
        ],
        "<b>Owner rule:</b> owner access is for visibility. Do not treat a read-only 403 as a broken token.",
    ),
]


def build_flow_sections() -> str:
    parts = []
    for title, intro, rows, note in FLOWS:
        parts.append(
            "<section class='major'>"
            f"<h2>{title}</h2>"
            f"<p class='lead'>{intro}</p>"
            f"{flow_table(rows)}"
            f"<div class='note'>{note}</div>"
            "</section>"
        )
    return "".join(parts)


def build_route_catalog(routes: list[dict]) -> tuple[str, int]:
    api_routes = [r for r in routes if r["uri"].startswith("api/v1")]
    grouped: dict[str, list[dict]] = {}
    for route in api_routes:
        parts = route["uri"].split("/")
        slug = parts[2] if len(parts) > 2 and parts[2] else "(root)"
        grouped.setdefault(slug, []).append(route)
    sections = []
    for slug in sorted(grouped):
        rows = sorted(grouped[slug], key=lambda r: (r["uri"], r["method"]))
        body = []
        for route in rows:
            body.append(
                "<tr>"
                f"<td class='method'>{escape(route['method'])}</td>"
                f"<td class='uri'>/{escape(route['uri'])}</td>"
                f"<td class='action'>{escape(short_action(route['action']))}</td>"
                f"<td class='mw'>{escape(short_middleware(route['middleware']))}</td>"
                "</tr>"
            )
        sections.append(
            "<section class='route-module'>"
            f"<h3>{escape(module_label(slug))} <span class='count'>{len(rows)} routes</span></h3>"
            "<table class='routes'>"
            "<colgroup><col style='width:10%'><col style='width:35%'><col style='width:28%'><col style='width:27%'></colgroup>"
            "<thead><tr><th>Method</th><th>URI</th><th>Controller action</th><th>Middleware</th></tr></thead>"
            f"<tbody>{''.join(body)}</tbody></table>"
            "</section>"
        )
    return "".join(sections), len(api_routes)


def build_api_groups(groups: list[str]) -> str:
    if not groups:
        return "<p class='lead'>The API registry could not be read.</p>"
    cells = [f"<span class='chip'>{escape(name)}</span>" for name in groups]
    return "<div class='chips'>" + "".join(cells) + "</div>"


def main() -> None:
    routes = load_routes()
    api_groups = load_api_groups()
    route_catalog, api_route_count = build_route_catalog(routes)

    html_doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MRK Hotels — Frontend to Backend Request Flow Debug Guide</title>
<style>
  @page {{
    size: A4 landscape;
    margin: 14mm 10mm 14mm 10mm;
    @top-left {{ content: "MRK Hotels — Frontend → Backend Request Flow Debug Guide"; font-size: 7.2pt; color: #64748b; }}
    @top-right {{ content: "{DATE} · frontend {FRONTEND_COMMIT} · backend {BACKEND_COMMIT}"; font-size: 7.2pt; color: #64748b; }}
    @bottom-center {{ content: "Page " counter(page) " of " counter(pages); font-size: 7.2pt; color: #94a3b8; }}
  }}
  @page cover {{
    margin: 0;
    @top-left {{ content: none; }}
    @top-right {{ content: none; }}
    @bottom-center {{ content: none; }}
  }}
  * {{ box-sizing: border-box; }}
  html {{ font-size: 8.4pt; }}
  body {{ font-family: "DejaVu Sans", "Noto Sans", sans-serif; color: #1e293b; line-height: 1.42; margin: 0; }}
  .cover {{
    page: cover; height: 100vh; display: flex; flex-direction: column; justify-content: center;
    text-align: center; padding: 0 20mm; color: #fff;
    background: linear-gradient(150deg, #005eb8 0%, #003d77 68%, #001f3f 100%);
  }}
  .cover .logo {{ width: 92px; height: 92px; margin: 0 auto 14pt; background: #fff; border-radius: 50%; padding: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.24); }}
  .cover .logo img {{ width: 100%; height: 100%; display: block; }}
  .cover .kicker {{ font-size: 9pt; letter-spacing: 3px; text-transform: uppercase; color: #bfdbfe; }}
  .cover h1 {{ color: #fff; font-size: 24pt; line-height: 1.16; margin: 10pt 0 8pt; }}
  .cover .subtitle {{ color: #e2e8f0; font-size: 10.2pt; margin: 0 auto; max-width: 210mm; }}
  .cover .rule {{ width: 84px; height: 3px; background: #60a5fa; margin: 14pt auto; border-radius: 2px; }}
  .cover .meta {{ color: #dbeafe; font-size: 8.6pt; line-height: 1.7; }}
  .cover .meta strong {{ color: #fff; }}
  .summary {{ display: flex; gap: 8pt; justify-content: center; margin: 15pt auto 0; max-width: 205mm; }}
  .summary .box {{ flex: 1; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.24); border-radius: 7px; padding: 8pt 6pt; }}
  .summary .num {{ display: block; font-size: 18pt; font-weight: 700; color: #fff; }}
  .summary .label {{ display: block; font-size: 7.2pt; color: #dbeafe; text-transform: uppercase; letter-spacing: .6px; }}
  .section, .major {{ margin-top: 8pt; }}
  .major {{ page-break-before: always; }}
  h2 {{ font-size: 13pt; color: #005eb8; margin: 0 0 6pt; border-bottom: 2px solid #005eb8; padding-bottom: 3pt; page-break-after: avoid; }}
  h3 {{ font-size: 10.2pt; color: #334155; margin: 10pt 0 4pt; page-break-after: avoid; }}
  .lead {{ color: #475569; font-size: 8.2pt; margin: 0 0 7pt; }}
  .note {{ background: #eff6ff; border-left: 4px solid #005eb8; padding: 7pt 9pt; margin: 7pt 0 10pt; border-radius: 0 6px 6px 0; color: #1e3a8a; font-size: 7.9pt; }}
  .note strong {{ color: #0f172a; }}
  table {{ width: 100%; border-collapse: collapse; margin: 0 0 9pt; }}
  thead {{ display: table-header-group; }}
  tr {{ page-break-inside: avoid; }}
  th {{ background: #005eb8; color: #fff; text-align: left; padding: 4.5pt 5pt; font-size: 7.4pt; font-weight: 700; }}
  td {{ border: 1px solid #dbe3ef; padding: 4.5pt 5pt; vertical-align: top; font-size: 7.4pt; }}
  tbody tr:nth-child(even) td {{ background: #f8fafc; }}
  .flow td {{ line-height: 1.38; }}
  .flow .num {{ text-align: center; color: #005eb8; font-weight: 700; }}
  .flow .where {{ font-weight: 700; color: #334155; }}
  .flow .signal {{ color: #475569; }}
  .path {{ font-family: "DejaVu Sans Mono", monospace; font-size: 6.7pt; color: #475569; }}
  .routes td {{ font-size: 6.3pt; padding: 3pt 3.5pt; line-height: 1.28; }}
  .routes th {{ font-size: 6.7pt; padding: 3.5pt; }}
  .routes .method {{ font-weight: 700; color: #005eb8; white-space: nowrap; }}
  .routes .uri {{ font-family: "DejaVu Sans Mono", monospace; font-size: 6pt; }}
  .routes .action {{ font-family: "DejaVu Sans Mono", monospace; font-size: 5.8pt; color: #475569; }}
  .routes .mw {{ font-family: "DejaVu Sans Mono", monospace; font-size: 5.7pt; color: #64748b; }}
  .route-module {{ page-break-inside: auto; }}
  .count {{ font-size: 7pt; color: #64748b; font-weight: 400; }}
  .chips {{ display: flex; flex-wrap: wrap; gap: 4pt; }}
  .chip {{ display: inline-block; background: #eef4fb; border: 1px solid #cbdff4; color: #1e3a8a; border-radius: 999px; padding: 2pt 6pt; font-size: 7pt; }}
  .pipeline {{ display: flex; flex-wrap: wrap; gap: 4pt; align-items: stretch; margin: 8pt 0 12pt; }}
  .pipe {{ flex: 1 1 30mm; background: #f1f5f9; border: 1px solid #cbd5e1; border-top: 3px solid #005eb8; border-radius: 5px; padding: 6pt; min-height: 22mm; }}
  .pipe .n {{ color: #005eb8; font-weight: 700; font-size: 8pt; }}
  .pipe .t {{ display: block; font-weight: 700; font-size: 7.8pt; margin: 2pt 0; color: #0f172a; }}
  .pipe .d {{ display: block; font-size: 6.8pt; color: #475569; }}
  .arrow {{ align-self: center; color: #005eb8; font-weight: 700; font-size: 10pt; }}
  .grid2 {{ display: flex; gap: 10pt; }}
  .grid2 > div {{ flex: 1; }}
  .boxed {{ border: 1px solid #dbe3ef; border-radius: 6px; padding: 7pt 8pt; background: #fff; }}
  .boxed h3 {{ margin-top: 0; }}
  ul.tight {{ margin: 4pt 0 7pt 14pt; padding: 0; }}
  ul.tight li {{ margin-bottom: 3pt; }}
  .small {{ font-size: 7.4pt; color: #475569; }}
  .toc {{ columns: 2; column-gap: 16pt; }}
  .toc div {{ break-inside: avoid; margin-bottom: 3pt; }}
  .toc .n {{ color: #005eb8; font-weight: 700; display: inline-block; width: 12mm; }}
  .footer-note {{ color: #64748b; font-size: 7.2pt; margin-top: 6pt; }}
  .good {{ color: #166534; font-weight: 700; }}
  .bad {{ color: #b91c1c; font-weight: 700; }}
</style>
</head>
<body>

<section class="cover">
  <div class="logo"><img src="MRK_logo.png" alt="MRK Hotels"></div>
  <div class="kicker">MRK Hotels · Engineering Reference</div>
  <h1>Frontend → Backend<br>Request Flow &amp; Debug Guide</h1>
  <div class="rule"></div>
  <p class="subtitle">A single reference for tracing every Vue screen through Axios, Laravel middleware, controllers, services, database transactions, audit logs and real-time events — with the concrete checks to run when something goes wrong.</p>
  <div class="summary">
    <div class="box"><span class="num">{api_route_count}</span><span class="label">API v1 routes catalogued</span></div>
    <div class="box"><span class="num">{len(FLOWS)}</span><span class="label">End-to-end flows explained</span></div>
    <div class="box"><span class="num">{len(api_groups)}</span><span class="label">Frontend API groups</span></div>
    <div class="box"><span class="num">10</span><span class="label">Debug checkpoints</span></div>
  </div>
  <div class="meta" style="margin-top:14pt;">
    <strong>Prepared:</strong> {DATE} &nbsp;·&nbsp; <strong>Frontend:</strong> {FRONTEND_COMMIT} &nbsp;·&nbsp; <strong>Backend:</strong> {BACKEND_COMMIT}<br>
    <strong>Scope:</strong> staff application, cashier/POS, inventory/procurement, reservations/folios, housekeeping/laundry, messaging, owner/superadmin and guest/public API surfaces.
  </div>
</section>

<section class="major">
  <h2>1. How to use this guide</h2>
  <p class="lead">Start from the screen that failed, not from the database. The goal is to find the first layer where the request or response stops matching expectations.</p>
  <div class="grid2">
    <div class="boxed">
      <h3>If a button or page fails</h3>
      <ul class="tight">
        <li>Open DevTools → Network, preserve the log, reproduce once.</li>
        <li>Find the red request. Copy method, full URL, headers, body, status and response.</li>
        <li>Match it to a flow in section 5 and an endpoint in section 8.</li>
        <li>Check token, tenant, role and active outlet before reading backend code.</li>
        <li>If the response is 500, go to the Laravel log and the controller named in the catalogue.</li>
      </ul>
    </div>
    <div class="boxed">
      <h3>If data is wrong but the request succeeds</h3>
      <ul class="tight">
        <li>Confirm the request filters: date, outlet/department, status, pagination.</li>
        <li>Compare one known row with its source table or ledger.</li>
        <li>Check whether the screen is stale: reload before blaming the API.</li>
        <li>For stock/folio totals, trace the movement or ledger entry, not the summary.</li>
        <li>For live boards, test HTTP refresh first; then test Echo/Reverb.</li>
      </ul>
    </div>
  </div>
  <div class="note"><strong>Vocabulary:</strong> “frontend” means the Vue app in <span class="path">mrk-hotels-frontend</span>. “Backend” means the Laravel API in <span class="path">mrk-hotels-api</span>. “Tenant” means one hotel. “Outlet” means a selling point or store with its own stock shelf. “Business date” is the hotel-local operating day, not necessarily the server date.</div>
  <h3>Contents</h3>
  <div class="toc">
    <div><span class="n">2</span>The request pipeline at a glance</div>
    <div><span class="n">3</span>Step-by-step lifecycle</div>
    <div><span class="n">4</span>Authentication, tenant and permissions</div>
    <div><span class="n">5</span>Feature flow walkthroughs (5.1–5.19)</div>
    <div><span class="n">6</span>Error response map</div>
    <div><span class="n">7</span>Debugging playbook</div>
    <div><span class="n">8</span>Complete API v1 route catalogue</div>
    <div><span class="n">A</span>Frontend API module map</div>
    <div><span class="n">B</span>Middleware glossary</div>
    <div><span class="n">C</span>Environment, commands and verification</div>
  </div>
</section>

<section class="major">
  <h2>2. The request pipeline at a glance</h2>
  <p class="lead">Every authenticated staff request follows this path. A failure at any box produces a different kind of symptom.</p>
  <div class="pipeline">
    <div class="pipe"><span class="n">01</span><span class="t">Vue screen</span><span class="d">Page/component state, form validation, selected outlet/date.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">02</span><span class="t">API module</span><span class="d"><span class="path">src/api/index.js</span> method builds URL, params and body.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">03</span><span class="t">Axios</span><span class="d"><span class="path">src/api/axios.js</span> adds base URL, token, tenant, language.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">04</span><span class="t">HTTP</span><span class="d">Network request to <span class="path">/api/v1/...</span> with JSON or FormData.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">05</span><span class="t">Laravel route</span><span class="d"><span class="path">routes/api.php</span> matches method + URI to a controller action.</span></div>
  </div>
  <div class="pipeline">
    <div class="pipe"><span class="n">06</span><span class="t">Middleware</span><span class="d">auth, tenant, features, trust, throttle, level, operate, report/POS gates.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">07</span><span class="t">Controller</span><span class="d">Validation, authorization, domain checks, transaction boundaries.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">08</span><span class="t">Service / model</span><span class="d">Business rules, stock posting, folio posting, number generation.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">09</span><span class="t">Database</span><span class="d">Tenant-scoped reads/writes inside a transaction where required.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">10</span><span class="t">Audit + event</span><span class="d">Audit row, notification, queued job, broadcast event.</span></div>
  </div>
  <div class="pipeline">
    <div class="pipe"><span class="n">11</span><span class="t">JSON response</span><span class="d">Resource/paginator payload with message, data, errors or meta.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">12</span><span class="t">Axios interceptor</span><span class="d">Flattens pagination; clears token and redirects on 401.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">13</span><span class="t">UI update</span><span class="d">Toast, table refresh, modal close, navigation, optimistic state.</span></div>
    <div class="arrow">→</div>
    <div class="pipe"><span class="n">14</span><span class="t">Realtime</span><span class="d">Echo receives a broadcast and refreshes other open screens.</span></div>
  </div>
  <div class="note"><strong>Key rule:</strong> a successful HTTP status only means the controller returned a response. It does not prove the business result is correct. For money, stock and folios, always verify the ledger/movement row and the audit trail.</div>
</section>

<section class="major">
  <h2>3. Step-by-step lifecycle</h2>
  <p class="lead">The concrete sequence behind one request, with the place to look when each step fails.</p>
  <h3>3.1 Navigation and route guard</h3>
  <p>The Vue router checks whether the destination requires authentication, a module, or a role. If the route is protected, the guard reads <span class="path">auth_token</span> from <span class="path">sessionStorage</span>, loads the profile if needed, and redirects guests to <span class="path">/login</span>. A valid token is not enough: the user also needs the route's role/module permission. <b>Look here</b> when the screen never renders or redirects before any API call appears in Network.</p>
  <h3>3.2 User action and page state</h3>
  <p>The component validates the form, resolves the active outlet/date, and calls a method from an API module. Most “the API is broken” reports start with a missing required value here: no outlet, no business date, no table, no shelf, no customer, no shift. <b>Look here</b> when the request body is missing a field that the backend then rejects with 422.</p>
  <h3>3.3 API module and URL construction</h3>
  <p><span class="path">src/api/index.js</span> groups calls by domain (for example <span class="path">orderApi</span>, <span class="path">inventoryApi</span>, <span class="path">reservationApi</span>). The module supplies the path under <span class="path">/v1</span>, query params and body. The shared Axios instance already has the <span class="path">/api</span> base, so a correct URL is <span class="path">VITE_API_URL + /v1/...</span>. A duplicated <span class="path">/api/api</span> or a missing <span class="path">/v1</span> is a frontend URL bug, not a backend bug.</p>
  <h3>3.4 Axios request interceptor</h3>
  <p>Before the request leaves the browser, the interceptor adds <span class="path">Authorization: Bearer &lt;auth_token&gt;</span>, optionally <span class="path">X-Tenant-ID</span> for owner hotel switching, and <span class="path">Accept-Language</span> from <span class="path">localStorage.locale</span>. For <span class="path">FormData</span>, it removes <span class="path">Content-Type</span> so the browser can set the multipart boundary. <b>Look here</b> when the request works in an API client but fails in the app because a header is missing or wrong.</p>
  <h3>3.5 Network and response</h3>
  <p>Check the request URL, method, status, request headers, response headers and body. Laravel validation errors normally return 422 with an <span class="path">errors</span> object; auth errors return 401; authorization/tenant errors return 403; missing records/routes return 404; conflicts return 409; throttling returns 429. A 500 means the request reached the backend but an exception escaped.</p>
  <h3>3.6 Laravel route matching</h3>
  <p><span class="path">routes/api.php</span> matches the method and URI. Route order matters: fixed paths such as <span class="path">/orders/summary</span> and <span class="path">/reservations/options</span> are registered before wildcard <span class="path">{{id}}</span> routes. If a fixed path is treated as an id, or the route is missing from the catalogue, verify the route definition and run <span class="path">php artisan route:list --path=api/v1</span>.</p>
  <h3>3.7 Middleware gates</h3>
  <p>The authenticated group runs <span class="path">auth:sanctum</span>, <span class="path">tenant</span>, <span class="path">features</span>, <span class="path">trust</span> and <span class="path">throttle:api</span>. Individual routes add <span class="path">level:N</span>, <span class="path">operate</span>, <span class="path">reports</span>, <span class="path">pos-inventory</span>, <span class="path">pos-reports</span> and ability checks such as <span class="path">outlets.manage</span> or <span class="path">housekeeping.work</span>. <b>Look here</b> for a 403 even though the same user can open other screens.</p>
  <h3>3.8 Controller validation and authorization</h3>
  <p>The controller validates the payload with Laravel validation, then performs domain checks that validation cannot express: is the order frozen, is the PO still open, does the room have an active reservation, is the outlet's shelf resolvable, is the credit account active, has the business day ended? These checks usually abort with 422 or 403 and a readable message.</p>
  <h3>3.9 Transaction and domain write</h3>
  <p>Money, stock, folio and procurement operations run inside <span class="path">DB::transaction</span>. A failure must roll back the whole operation, not leave a header without lines or stock without a document. Use the audit row and the related movement/ledger row to prove what committed. If one exists without the other, treat it as a transaction or service bug.</p>
  <h3>3.10 Response shaping and UI update</h3>
  <p>Controllers return resources or explicit JSON. The Axios response interceptor flattens Laravel pagination metadata onto the payload, so pages read <span class="path">data</span>, <span class="path">current_page</span>, <span class="path">last_page</span> and so on. The component then updates state, shows a toast, closes a modal or refreshes a list. <b>Look here</b> when the response is correct but the screen does not change.</p>
  <h3>3.11 Realtime follow-up</h3>
  <p>After commit, some actions dispatch broadcast events. Echo authorizes private channels through <span class="path">POST /broadcasting/auth</span>, then listens. Realtime is a convenience layer: the HTTP response should already contain the authoritative result. If HTTP is right and the board is stale, debug Echo/Reverb; do not change the order/inventory controller.</p>
</section>

<section class="major">
  <h2>4. Authentication, tenant and permissions</h2>
  <h3>4.1 What the browser stores</h3>
  <table>
    <colgroup><col style="width:22%"><col style="width:18%"><col style="width:60%"></colgroup>
    <thead><tr><th>Value</th><th>Storage</th><th>Purpose and debug note</th></tr></thead>
    <tbody>
      <tr><td><span class="path">auth_token</span></td><td>sessionStorage</td><td>Sanctum bearer token. Cleared on logout or 401. A new tab usually needs a new login.</td></tr>
      <tr><td><span class="path">owner_viewing_hotel</span></td><td>sessionStorage</td><td>Tenant id used by the Axios interceptor as <span class="path">X-Tenant-ID</span> for owner switching. Wrong hotel = wrong header.</td></tr>
      <tr><td><span class="path">active_outlet</span></td><td>sessionStorage</td><td>Unlocked cashier/store outlet. Feature calls pass its id as a request field, not a global header.</td></tr>
      <tr><td><span class="path">device_key</span></td><td>localStorage</td><td>Stable trusted-device identity. Clearing site data makes the browser a new device.</td></tr>
      <tr><td><span class="path">locale</span></td><td>localStorage</td><td>Sent as <span class="path">Accept-Language</span> so menu/API text follows the UI language.</td></tr>
    </tbody>
  </table>
  <h3>4.2 Headers on every authenticated request</h3>
  <table>
    <colgroup><col style="width:26%"><col style="width:32%"><col style="width:42%"></colgroup>
    <thead><tr><th>Header</th><th>Source</th><th>What it controls</th></tr></thead>
    <tbody>
      <tr><td><span class="path">Authorization: Bearer …</span></td><td><span class="path">auth_token</span></td><td>Sanctum identity. Missing/expired → 401.</td></tr>
      <tr><td><span class="path">X-Tenant-ID</span></td><td><span class="path">owner_viewing_hotel</span></td><td>Owner/superadmin hotel switching. Staff cannot use it to escape their tenant.</td></tr>
      <tr><td><span class="path">Accept-Language</span></td><td><span class="path">locale</span></td><td>Localized menu/response content. Not an authorization header.</td></tr>
      <tr><td><span class="path">Content-Type</span></td><td>Axios or browser</td><td>JSON by default; removed for <span class="path">FormData</span> uploads so the boundary is correct.</td></tr>
      <tr><td><span class="path">Accept: application/json</span></td><td>Axios default</td><td>Makes Laravel return JSON errors instead of an HTML redirect/page.</td></tr>
    </tbody>
  </table>
  <h3>4.3 Tenant resolution and isolation</h3>
  <ul class="tight">
    <li><b>Staff:</b> locked to their own <span class="path">tenant_id</span>. Sending another tenant header does not grant access.</li>
    <li><b>Owner:</b> may switch between owned hotels using <span class="path">X-Tenant-ID</span>, but is treated as read-only. Writes require <span class="path">operate</span> and an allowed override.</li>
    <li><b>Superadmin:</b> may switch tenant context and has broad ability, but the selected <span class="path">X-Tenant-ID</span> still determines which hotel's data is read.</li>
    <li><b>Inactive/suspended tenant:</b> 403. <b>Missing/unresolvable tenant:</b> 404. <b>No tenant context:</b> 422 in flows that explicitly require it.</li>
  </ul>
  <h3>4.4 Role levels and gates</h3>
  <table>
    <colgroup><col style="width:22%"><col style="width:18%"><col style="width:60%"></colgroup>
    <thead><tr><th>Gate</th><th>Typical level</th><th>Meaning</th></tr></thead>
    <tbody>
      <tr><td>Staff read</td><td>20</td><td>Outlets, menu, orders read, cashier reads.</td></tr>
      <tr><td>Operational write</td><td>30–50</td><td>Cashier/POS, store/inventory, procurement documents.</td></tr>
      <tr><td>Front desk / management</td><td>60–70</td><td>Reservations, folio, outlet management, some approvals.</td></tr>
      <tr><td>Senior management</td><td>80</td><td>Voids, overrides, deletions, high-risk approvals.</td></tr>
      <tr><td>Administrator</td><td>90+</td><td>Imports, tenant-level administration, sensitive settings.</td></tr>
      <tr><td><span class="path">operate</span></td><td>—</td><td>Blocks owner read-only sessions unless an override is allowed.</td></tr>
      <tr><td><span class="path">features</span></td><td>—</td><td>Feature flags/modules enabled for the tenant.</td></tr>
      <tr><td><span class="path">trust</span></td><td>—</td><td>Trusted-device/session policy.</td></tr>
      <tr><td><span class="path">reports</span></td><td>—</td><td>Report-specific access.</td></tr>
      <tr><td><span class="path">pos-inventory</span> / <span class="path">pos-reports</span></td><td>—</td><td>POS access to inventory/report surfaces.</td></tr>
    </tbody>
  </table>
  <div class="note"><strong>401 vs 403:</strong> 401 means “we do not know who you are” (missing/expired token). 403 means “we know who you are, but this tenant/role/feature/device may not do this.” Do not “fix” a 403 by clearing the token.</div>
</section>

{build_flow_sections()}

<section class="major">
  <h2>6. Error response map</h2>
  <p class="lead">Read the status first, then the message and validation keys. The same status can have different fixes.</p>
  <table>
    <colgroup><col style="width:9%"><col style="width:25%"><col style="width:38%"><col style="width:28%"></colgroup>
    <thead><tr><th>Status</th><th>Typical meaning</th><th>Where to look</th><th>First fix to try</th></tr></thead>
    <tbody>
      <tr><td><b>200/201</b></td><td>Request accepted; business result may still be wrong.</td><td>Response payload, audit row, movement/ledger row.</td><td>Verify the specific record, not just the toast.</td></tr>
      <tr><td><b>401</b></td><td>Missing, expired or invalid Sanctum token.</td><td>Session Storage, <span class="path">/auth/me</span>, token expiry.</td><td>Log in again; confirm the Authorization header exists.</td></tr>
      <tr><td><b>403</b></td><td>Authenticated but forbidden by role, tenant, feature, trust, owner read-only or ability.</td><td>Middleware, user role level, feature flags, tenant status, <span class="path">operate</span>.</td><td>Do not clear the token. Check the exact gate named in the message.</td></tr>
      <tr><td><b>404</b></td><td>Route not found, tenant not found, or record not in this tenant.</td><td><span class="path">route:list</span>, URL path, tenant scope, deleted record.</td><td>Confirm method/URI and that the record belongs to the active tenant.</td></tr>
      <tr><td><b>409</b></td><td>Conflict: ambiguous login email, already-closed day, duplicate resource.</td><td>Auth ambiguous flag, day-close history, unique keys.</td><td>Resolve the existing resource; do not retry blindly.</td></tr>
      <tr><td><b>419</b></td><td>CSRF/session page expired (more common with cookie/session auth than bearer API).</td><td>Session/cookie config, proxy, Sanctum SPA setup.</td><td>Refresh session; confirm the API uses the intended auth mode.</td></tr>
      <tr><td><b>422</b></td><td>Validation failed or a domain rule aborted the action.</td><td><span class="path">errors</span> object, controller abort message, business date/stock/folio state.</td><td>Fix the named field or state; the request reached the domain.</td></tr>
      <tr><td><b>429</b></td><td>Rate limit hit.</td><td><span class="path">throttle:auth</span>, <span class="path">throttle:api</span>, access-code 20/min, public webhooks.</td><td>Wait; do not loop retries. Check for duplicate submit handlers.</td></tr>
      <tr><td><b>500</b></td><td>Unhandled exception, missing config, DB/queue/storage failure.</td><td><span class="path">storage/logs/laravel.log</span>, failed jobs, storage permissions, DB connection.</td><td>Use the stack trace; identify the controller/service line, then reproduce.</td></tr>
      <tr><td><b>503</b></td><td>Service unavailable: maintenance, queue/broadcast dependency, upstream integration.</td><td>Deploy status, Reverb/queue workers, external provider.</td><td>Check service health before changing application code.</td></tr>
    </tbody>
  </table>
  <h3>Common response shapes</h3>
  <table class="small">
    <colgroup><col style="width:25%"><col style="width:75%"></colgroup>
    <thead><tr><th>Shape</th><th>Example / meaning</th></tr></thead>
    <tbody>
      <tr><td>Success message</td><td><span class="path">{{ "message": "Order marked as paid.", "order": {{ ... }}, "payment": {{ ... }} }}</span></td></tr>
      <tr><td>Validation error</td><td><span class="path">{{ "message": "The given data was invalid.", "errors": {{ "items.0.quantity": ["..."] }} }}</span></td></tr>
      <tr><td>Paginated list</td><td><span class="path">{{ "data": [...], "meta": {{ "current_page": 1, "last_page": 3, "total": 42 }} }}</span> — Axios flattens meta onto the payload.</td></tr>
      <tr><td>Ambiguous login</td><td><span class="path">{{ "message": "...", "ambiguous": true }}</span> with HTTP 409; ask for the hotel/property.</td></tr>
      <tr><td>Day close conflict</td><td><span class="path">{{ "message": "This F&B business day is already closed.", "day_close": {{ ... }} }}</span> with HTTP 409.</td></tr>
    </tbody>
  </table>
</section>

<section class="major">
  <h2>7. Debugging playbook</h2>
  <p class="lead">A repeatable sequence that avoids guessing. Stop at the first checkpoint that does not match.</p>
  <table>
    <colgroup><col style="width:6%"><col style="width:22%"><col style="width:44%"><col style="width:28%"></colgroup>
    <thead><tr><th>#</th><th>Checkpoint</th><th>What to capture / verify</th><th>What it proves</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Reproduce once</td><td>DevTools Network with “Preserve log”; one user action, one request. Note the exact screen, outlet, date and user.</td><td>The failing request is identified, not a later side effect.</td></tr>
      <tr><td>2</td><td>Read the request</td><td>Method, full URL, status, request headers, query, JSON body or FormData fields.</td><td>Frontend sent what the backend expects.</td></tr>
      <tr><td>3</td><td>Read the response</td><td>Status, <span class="path">message</span>, <span class="path">errors</span>, data/meta. Do not stop at “it failed”.</td><td>The backend named the failing rule or field.</td></tr>
      <tr><td>4</td><td>Check session context</td><td><span class="path">auth_token</span>, <span class="path">owner_viewing_hotel</span>, <span class="path">active_outlet</span>, <span class="path">device_key</span>, <span class="path">locale</span>.</td><td>The right user, hotel and outlet are in play.</td></tr>
      <tr><td>5</td><td>Confirm the route</td><td>Compare the URL with section 8 and <span class="path">php artisan route:list --path=api/v1</span>.</td><td>The request is hitting an existing action, not a typo/404.</td></tr>
      <tr><td>6</td><td>Replay outside Vue</td><td>Use curl/Postman with the same token, tenant and body. Never paste production secrets into shared logs.</td><td>Separates frontend state bugs from backend/domain bugs.</td></tr>
      <tr><td>7</td><td>Read the backend log</td><td><span class="path">storage/logs/laravel.log</span>, failed jobs, web server log. Search the request timestamp and controller.</td><td>The stack trace or domain abort behind a 500/422.</td></tr>
      <tr><td>8</td><td>Inspect the committed records</td><td>Audit row, order/payment, stock movement, GRN/PO, folio entry. Check tenant id and timestamps.</td><td>The transaction actually wrote the expected business result.</td></tr>
      <tr><td>9</td><td>Test realtime separately</td><td>Refresh the screen over HTTP. If correct after refresh, inspect Echo/Reverb/channel auth, not the controller.</td><td>The data is right; only the live update is stale.</td></tr>
      <tr><td>10</td><td>Record the cause</td><td>Add a regression test at the closest layer: component, API contract, controller feature test or service test.</td><td>The same failure does not return silently.</td></tr>
    </tbody>
  </table>
  <h3>Replay template</h3>
  <p class="small">Use the real base URL from <span class="path">VITE_API_URL</span>. If it is <span class="path">http://localhost:8000/api</span>, the endpoint below becomes <span class="path">http://localhost:8000/api/v1/orders</span>.</p>
  <pre class="code">curl -i -X POST "$API_BASE/v1/orders" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Accept: application/json" \\
  -H "Content-Type: application/json" \\
  -H "Accept-Language: en" \\
  -H "X-Tenant-ID: $TENANT_ID" \\
  -d '{{"outlet_id":"...","items":[{{"item_id":"...","quantity":1}}]}}'</pre>
  <div class="note"><strong>Do not guess the tenant:</strong> use the tenant id from the authenticated user/profile, not an arbitrary hotel id. For staff, the backend ignores attempts to switch; for owners/superadmins, the wrong <span class="path">X-Tenant-ID</span> silently reads the wrong hotel.</div>
  <h3>Where to look by symptom</h3>
  <table class="small">
    <colgroup><col style="width:34%"><col style="width:66%"></colgroup>
    <thead><tr><th>Symptom</th><th>First place to look</th></tr></thead>
    <tbody>
      <tr><td>Redirected to login immediately</td><td>Token expiry, <span class="path">/auth/me</span> failure, tenant inactive, Axios 401 handler.</td></tr>
      <tr><td>Screen opens but is empty</td><td>Request query filters, outlet/date, pagination, response <span class="path">data</span>, tenant scope.</td></tr>
      <tr><td>Button does nothing</td><td>Form validation, disabled state, missing active outlet/date, JavaScript console error.</td></tr>
      <tr><td>403 on only one action</td><td>Route <span class="path">level</span>, <span class="path">operate</span>, feature flag, ability, owner read-only.</td></tr>
      <tr><td>422 on a valid-looking form</td><td>Read <span class="path">errors</span>; check unit conversion, business date, stock shelf, state transition.</td></tr>
      <tr><td>Saved but list unchanged</td><td>Response handling, list refresh, pagination/filter, stale realtime, cached store.</td></tr>
      <tr><td>Order paid but no payment row</td><td>Transaction rollback, payment service, DB connection, audit/logs.</td></tr>
      <tr><td>GRN saved but stock unchanged</td><td>GRN transaction, resolved inventory item, unit conversion, <span class="path">InventoryService::adjustStock</span>.</td></tr>
      <tr><td>Kitchen board stale</td><td>HTTP refresh first; then Echo connection, <span class="path">/broadcasting/auth</span>, channel name, event listener.</td></tr>
      <tr><td>Report total differs</td><td>Timezone/business date, outlet/department filter, source ledger/movement, queued report.</td></tr>
    </tbody>
  </table>
</section>

<section class="major">
  <h2>8. Complete API v1 route catalogue</h2>
  <p class="lead">All <b>{api_route_count}</b> routes whose URI starts with <span class="path">api/v1</span>, grouped by the first path segment. The catalogue is generated from <span class="path">php artisan route:list --json</span>, so it reflects the backend commit used for this guide. Public routes appear alongside authenticated routes; always read the middleware column.</p>
  <div class="note"><strong>How to read the middleware column:</strong> <span class="path">auth:sanctum</span> = token required; <span class="path">tenant</span> = tenant context; <span class="path">features</span> = feature enabled; <span class="path">trust</span> = trusted session/device; <span class="path">throttle:*</span> = rate limit; <span class="path">level:N</span> = minimum role level; <span class="path">operate</span> = owner write gate; <span class="path">reports</span> / <span class="path">pos-inventory</span> / <span class="path">pos-reports</span> = module-specific gates. A route with no auth middleware is public or webhook-protected by another mechanism.</div>
  {route_catalog}
</section>

<section class="major">
  <h2>Appendix A. Frontend API module map</h2>
  <p class="lead">The shared API registry exports these groups from <span class="path">src/api/index.js</span>. Use the group name to find the frontend caller, then use section 8 to find the backend route.</p>
  {build_api_groups(api_groups)}
  <div class="note"><strong>Search tip:</strong> from the frontend repository, search for the API group (for example <span class="path">orderApi</span>) to find every screen that uses it. From the backend repository, search the URI or controller action from section 8.</div>
</section>

<section class="major">
  <h2>Appendix B. Middleware glossary</h2>
  <table>
    <colgroup><col style="width:24%"><col style="width:76%"></colgroup>
    <thead><tr><th>Middleware</th><th>What it enforces / debug meaning</th></tr></thead>
    <tbody>
      <tr><td><span class="path">auth:sanctum</span></td><td>Requires a valid bearer token. Failure → 401.</td></tr>
      <tr><td><span class="path">tenant</span></td><td>Resolves and locks tenant context; handles owner/superadmin switching; rejects inactive tenants. Failure → 403/404.</td></tr>
      <tr><td><span class="path">features</span></td><td>Checks the tenant's enabled modules/features. A valid user can still get 403 when the hotel lacks the module.</td></tr>
      <tr><td><span class="path">trust</span></td><td>Enforces trusted-device/session policy for sensitive access.</td></tr>
      <tr><td><span class="path">throttle:api</span></td><td>General API rate limit. Duplicate submit handlers often show up as 429 here.</td></tr>
      <tr><td><span class="path">throttle:auth</span></td><td>Login/device/PIN rate limit. Repeated retries lock the user out temporarily.</td></tr>
      <tr><td><span class="path">level:N</span></td><td>Minimum numeric role level. Compare with the user's role in the profile/permissions response.</td></tr>
      <tr><td><span class="path">operate</span></td><td>Owner write gate. Owners are read-only unless an allowed override is present; superadmin passes.</td></tr>
      <tr><td><span class="path">reports</span></td><td>Report-specific access. A report can be visible in the menu but forbidden by this gate.</td></tr>
      <tr><td><span class="path">pos-inventory</span></td><td>Allows POS surfaces to access inventory data without granting full store management.</td></tr>
      <tr><td><span class="path">pos-reports</span></td><td>Allows POS-specific reporting.</td></tr>
      <tr><td><span class="path">can:outlets.manage</span></td><td>Outlet management ability, used with level 70+ for resets/CRUD.</td></tr>
      <tr><td><span class="path">can:housekeeping.work</span></td><td>Housekeeping work ability for task start/update/delete.</td></tr>
      <tr><td><span class="path">bot</span></td><td>Guest portal bot protection; usually paired with public throttling.</td></tr>
      <tr><td><span class="path">throttle:public</span> / <span class="path">throttle:webhook</span></td><td>Public booking and integration webhook protection. A 429 from a provider usually means retry/backoff, not invalid data.</td></tr>
    </tbody>
  </table>
</section>

<section class="major">
  <h2>Appendix C. Environment, commands and verification</h2>
  <div class="grid2">
    <div class="boxed">
      <h3>Frontend</h3>
      <ul class="tight">
        <li><span class="path">VITE_API_URL</span> must include <span class="path">/api</span>, e.g. <span class="path">https://api.example.com/api</span>.</li>
        <li><span class="path">VITE_REVERB_*</span> config drives Echo/Reverb. A wrong host/key breaks only realtime.</li>
        <li><span class="path">npm run dev</span> for local development; <span class="path">npx vite build</span> for production build.</li>
        <li>Netlify publishes <span class="path">dist</span> with SPA fallback; API calls still go to <span class="path">VITE_API_URL</span>.</li>
      </ul>
    </div>
    <div class="boxed">
      <h3>Backend</h3>
      <ul class="tight">
        <li><span class="path">php artisan route:list --path=api/v1</span> confirms the route exists.</li>
        <li><span class="path">tail -f storage/logs/laravel.log</span> for the exception behind a 500/domain abort.</li>
        <li><span class="path">php artisan queue:work</span> for queued notifications/reports; check <span class="path">failed_jobs</span>.</li>
        <li><span class="path">php artisan config:clear</span> after environment changes; confirm the active <span class="path">.env</span>.</li>
      </ul>
    </div>
  </div>
  <h3>Useful commands</h3>
  <pre class="code"># Backend route inventory
php artisan route:list --path=api/v1

# Backend tests for one flow
php artisan test --filter=OrderTest

# Frontend tests for one spec
npx vitest run src/__tests__/cashier-gate.spec.js

# Frontend production build
npx vite build

# Frontend lint on changed files
npx eslint src/path/to/File.vue
npx oxlint src/path/to/File.vue</pre>
  <h3>Verification checklist before calling a fix done</h3>
  <table class="small">
    <colgroup><col style="width:6%"><col style="width:44%"><col style="width:50%"></colgroup>
    <thead><tr><th>#</th><th>Check</th><th>Evidence</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>The failing request now returns the expected status and payload.</td><td>Network screenshot/response copied into the issue.</td></tr>
      <tr><td>2</td><td>The UI reflects the result without a manual hard refresh.</td><td>Reload the screen; the same state appears.</td></tr>
      <tr><td>3</td><td>The business record is correct.</td><td>Order/payment, stock movement, GRN/PO, folio or audit row.</td></tr>
      <tr><td>4</td><td>Permissions still hold for the intended role and tenant.</td><td>Test as the affected user, not only as superadmin.</td></tr>
      <tr><td>5</td><td>Realtime updates still arrive (if the flow uses them).</td><td>Second browser/session receives the change; no console errors.</td></tr>
      <tr><td>6</td><td>A regression test covers the failure.</td><td>Focused Vitest or PHPUnit test passes.</td></tr>
    </tbody>
  </table>
  <div class="note"><strong>Scope note:</strong> this guide documents the application as of frontend <span class="path">{FRONTEND_COMMIT}</span> and backend <span class="path">{BACKEND_COMMIT}</span>. The route catalogue is generated from the backend route list at build time; if a route is added later, rebuild this PDF so the catalogue stays accurate.</div>
</section>

</body>
</html>
"""
    HTML(string=html_doc, base_url=str(HERE)).write_pdf(str(OUT))
    print(f"Wrote {OUT} ({api_route_count} API v1 routes, {len(FLOWS)} flows)")


if __name__ == "__main__":
    main()
