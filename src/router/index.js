/**
 * Application router.
 *
 * Three areas: the public storefront + staff panel (StoreLayout; /app
 * children are module-guarded via config/modules), the superadmin panel
 * (/superadmin, role-guarded) and the owner panel (/owner, role-guarded).
 * Every page is lazy-loaded through dynamic imports. Route meta fields:
 * `requiresAuth` (login needed), `guest` (only while logged out), `role`
 * (single role allowed) and `module` (key into the /app access matrix). The
 * error handler reloads the tab once when a deploy invalidates old chunks.
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { moduleByKey } from '@/config/modules'

// Child routes under /app: every page of a hotel's staff panel.
const hotelChildren = [
  // Staff landing page; the component picked depends on the role.
  { path: '', name: 'hotel-dashboard', component: () => import('@/pages/dashboards/HotelDashboard.vue'), meta: { module: 'dashboard' } },
  // Order-taking landing page for waiters and bartenders.
  { path: 'take-order', name: 'hotel-take-order', component: () => import('@/pages/dashboards/OrderTakerDashboard.vue'), meta: { module: 'orders' } },
  // Single-click kitchen board (one tap per dish to mark it ready/served).
  { path: 'kitchen', name: 'hotel-kitchen', component: () => import('@/pages/kitchen/KitchenBoardPage.vue'), meta: { module: 'orders' } },
  // Operational overview read-only for management.
  { path: 'overview', name: 'hotel-overview', component: () => import('@/pages/overview/AdminOverviewPage.vue'), meta: { module: 'overview' } },
  // Manage guest reservations.
  { path: 'reservations', name: 'hotel-reservations', component: () => import('@/pages/reservations/ReservationListPage.vue'), meta: { module: 'reservations' } },
  // Manage rooms and their statuses.
  { path: 'rooms', name: 'hotel-rooms', component: () => import('@/pages/rooms/RoomListPage.vue'), meta: { module: 'rooms' } },
  // Manage guest records.
  { path: 'guests', name: 'hotel-guests', component: () => import('@/pages/guests/GuestListPage.vue'), meta: { module: 'guests' } },
  // List and confirm payments.
  { path: 'payments', name: 'hotel-payments', component: () => import('@/pages/payments/PaymentListPage.vue'), meta: { module: 'payments' } },
  // Respond to public booking requisitions.
  { path: 'booking-requisitions', name: 'hotel-booking-requisitions', component: () => import('@/pages/booking/BookingRequisitionListPage.vue'), meta: { module: 'booking-requisitions' } },
  // Night audit — day close for receptionists.
  { path: 'night-audit', name: 'hotel-night-audit', component: () => import('@/pages/reception/NightAuditPage.vue'), meta: { module: 'night-audit' } },
  // Night audit log — audit trail of night-audit actions.
  { path: 'night-audit/logs', name: 'hotel-night-audit-logs', component: () => import('@/pages/reception/NightAuditLogPage.vue'), meta: { module: 'night-audit' } },
  // Night audit insert transaction — manual transaction before day close.
  { path: 'night-audit/transactions', name: 'hotel-night-audit-transactions', component: () => import('@/pages/reception/InsertTransactionPage.vue'), meta: { module: 'night-audit' } },
  // Activity log report — daily/weekly/monthly staff activity.
  { path: 'activity-log-report', name: 'hotel-activity-log-report', component: () => import('@/pages/reception/ActivityLogReportPage.vue'), meta: { module: 'activity-log-report' } },
  // Channel logs — stop-sell schedule changes and channel activity.
  { path: 'distribution/channel-logs', name: 'hotel-distribution-channel-logs', component: () => import('@/pages/reception/ChannelLogsPage.vue'), meta: { module: 'distribution' } },
  // Housekeeping task board.
  { path: 'housekeeping', name: 'hotel-housekeeping', component: () => import('@/pages/housekeeping/HousekeepingPage.vue'), meta: { module: 'housekeeping' } },
  // F&B orders for kitchen and wait staff.
  { path: 'orders', name: 'hotel-orders', component: () => import('@/pages/orders/OrderListPage.vue'), meta: { module: 'orders' } },
  // Staff issue reports.
  { path: 'issue-reports', name: 'hotel-issue-reports', component: () => import('@/pages/issuereports/IssueReportListPage.vue'), meta: { module: 'issue-reports' } },
  // Staff chat, calls and messages.
  { path: 'messages', name: 'hotel-messages', component: () => import('@/pages/messages/MessagesPage.vue'), meta: { module: 'messages' } },
  // Ephemeral staff status updates.
  { path: 'statuses', name: 'hotel-statuses', component: () => import('@/pages/statuses/StatusesPage.vue'), meta: { module: 'statuses' } },
  // Menu item management.
  { path: 'menu', name: 'hotel-menu', component: () => import('@/pages/menu/MenuListPage.vue'), meta: { module: 'menu' } },
  // POS outlets (restaurant/bar) cashiers pick from after login.
  { path: 'outlets', name: 'hotel-outlets', component: () => import('@/pages/outlets/OutletManagePage.vue'), meta: { module: 'outlets' } },
  // Till printer connection (Web Serial ESC/POS thermal printing).
  { path: 'printer', name: 'hotel-printer', component: () => import('@/pages/printer/PrinterSettingsPage.vue'), meta: { module: 'printer' } },
  // Laundry order management.
  { path: 'laundry', name: 'hotel-laundry', component: () => import('@/pages/laundry/LaundryListPage.vue'), meta: { module: 'laundry' } },
  // Guest fun game activities.
  { path: 'fun-games', name: 'hotel-fun-games', component: () => import('@/pages/fungames/FunGameListPage.vue'), meta: { module: 'fun-games' } },
  // Inventory items and stock adjustments.
  { path: 'inventory', name: 'hotel-inventory', component: () => import('@/pages/inventory/InventoryListPage.vue'), meta: { module: 'inventory' } },
  // Inventory departments.
  { path: 'departments', name: 'hotel-departments', component: () => import('@/pages/inventory/DepartmentListPage.vue'), meta: { module: 'departments' } },
  // Supplier records.
  { path: 'suppliers', name: 'hotel-suppliers', component: () => import('@/pages/suppliers/SupplierListPage.vue'), meta: { module: 'suppliers' } },
  // Purchase requisitions workflow.
  { path: 'requisitions', name: 'hotel-requisitions', component: () => import('@/pages/procurement/RequisitionListPage.vue'), meta: { module: 'requisitions' } },
  // Purchase orders workflow.
  { path: 'purchase-orders', name: 'hotel-purchase-orders', component: () => import('@/pages/procurement/PurchaseOrderListPage.vue'), meta: { module: 'purchase-orders' } },
  // Goods received notes.
  { path: 'goods-received', name: 'hotel-goods-received', component: () => import('@/pages/procurement/GoodsReceivedNoteListPage.vue'), meta: { module: 'goods-received' } },
  // Staff/user management.
  { path: 'staff', name: 'hotel-staff', component: () => import('@/pages/staff/StaffListPage.vue'), meta: { module: 'staff' } },
  // Business reports.
  { path: 'reports', name: 'hotel-reports', component: () => import('@/pages/reports/ReportBrowserPage.vue'), meta: { module: 'reports' } },
  // Accounting reports.
  { path: 'accounting', name: 'hotel-accounting', component: () => import('@/pages/accounting/AccountingPage.vue'), meta: { module: 'accounting' } },
  // Current user's own profile.
  { path: 'profile', name: 'hotel-profile', component: () => import('@/pages/profile/ProfilePage.vue'), meta: { module: 'profile' } },
  // Booking.com channel manager integration.
  { path: 'integrations/booking-com', name: 'booking-com', component: () => import('@/pages/integrations/BookingComPage.vue'), meta: { module: 'integrations/booking-com', title: 'Booking.com Integration' } },
  // QuickBooks Online accounting integration.
  { path: 'integrations/quickbooks', name: 'quickbooks', component: () => import('@/pages/integrations/QuickBooksPage.vue'), meta: { module: 'integrations/quickbooks', title: 'QuickBooks Integration' } },
  // Xero accounting integration.
  { path: 'integrations/xero', name: 'xero', component: () => import('@/pages/integrations/XeroPage.vue'), meta: { module: 'integrations/xero', title: 'Xero Integration' } },
  // Check-in override approvals (manager).
  { path: 'overrides', name: 'override-approvals', component: () => import('@/pages/overrides/OverrideApprovalsPage.vue'), meta: { title: 'Override Approvals' } },
  // Bulk data import (CSV dry-run then commit) — hotel admins.
  { path: 'import', name: 'hotel-import', component: () => import('@/pages/imports/ImportPage.vue'), meta: { module: 'imports' } },
]

const routes = [
  // Public storefront + the authenticated staff panel under /app.
  {
    path: '/',
    component: () => import('@/layouts/StoreLayout.vue'),
    children: [
      // Public landing page listing all hotels.
      {
        path: '',
        name: 'public-home',
        component: () => import('@/pages/public/HotelDirectoryPage.vue'),
      },
      // Public single-hotel detail page.
      {
        path: 'hotels/:id',
        name: 'public-hotel',
        component: () => import('@/pages/public/HotelDetailPage.vue'),
      },
      // Public booking form.
      {
        path: 'booking',
        name: 'public-booking',
        component: () => import('@/pages/public/BookingPage.vue'),
      },
      // Guest self-service portal (authenticated by booking reference + phone).
      {
        path: 'guest/login',
        name: 'guest-login',
        component: () => import('@/pages/guest/GuestLoginPage.vue'),
        meta: { guest: true },
      },
      {
        path: 'guest/booking',
        name: 'guest-booking',
        component: () => import('@/pages/guest/GuestBookingPage.vue'),
        meta: { requiresGuestAuth: true },
      },
      {
        path: 'guest/folio',
        name: 'guest-folio',
        component: () => import('@/pages/guest/GuestFolioPage.vue'),
        meta: { requiresGuestAuth: true },
      },
      {
        path: 'guest/requests',
        name: 'guest-requests',
        component: () => import('@/pages/guest/GuestRequestsPage.vue'),
        meta: { requiresGuestAuth: true },
      },
      // Mount point for the authenticated hotel staff panel.
      {
        path: 'app',
        meta: { requiresAuth: true },
        children: hotelChildren,
      },
    ],
  },
  // Login page, only reachable while logged out.
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/auth/LoginPage.vue'),
    meta: { guest: true },
  },
  // Self-service registration (public, plan selected from pricing page).
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/auth/RegisterPage.vue'),
    meta: { guest: true },
  },
  // Marketing pages (pricing, customer auth) — TSCL branded layout.
  {
    path: '/portal',
    component: () => import('@/layouts/MarketingLayout.vue'),
    children: [
      { path: 'login', name: 'portal-login', component: () => import('@/pages/portal/PortalLoginPage.vue'), meta: { guest: true } },
      { path: 'register', name: 'portal-register', component: () => import('@/pages/auth/RegisterPage.vue'), meta: { guest: true } },
      { path: 'pricing', name: 'portal-pricing', component: () => import('@/pages/public/PricingPage.vue') },
      { path: 'forgot-password', name: 'portal-forgot-password', component: () => import('@/pages/portal/ForgotPasswordPage.vue'), meta: { guest: true } },
      { path: 'reset-password', name: 'portal-reset-password', component: () => import('@/pages/portal/ResetPasswordPage.vue'), meta: { guest: true } },
    ],
  },
  // Customer portal (superadmin-style panel for self-service customers).
  {
    path: '/portal',
    component: () => import('@/layouts/CustomerLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'portal-dashboard', component: () => import('@/pages/portal/PortalDashboard.vue') },
      { path: 'hotel', name: 'portal-hotel', component: () => import('@/pages/portal/PortalHotelPage.vue') },
      { path: 'subscription', name: 'portal-subscription', component: () => import('@/pages/portal/PortalSubscriptionPage.vue') },
      { path: 'staff', name: 'portal-staff', component: () => import('@/pages/portal/PortalStaffPage.vue') },
      { path: 'payments', name: 'portal-payments', component: () => import('@/pages/portal/PortalPaymentsPage.vue') },
      { path: 'profile', name: 'portal-profile', component: () => import('@/pages/portal/PortalProfilePage.vue') },
      { path: 'notifications', name: 'portal-notifications', component: () => import('@/pages/portal/PortalNotificationsPage.vue') },
    ],
  },
  // Superadmin-only platform management area.
  {
    path: '/superadmin',
    component: () => import('@/layouts/SuperadminLayout.vue'),
    meta: { requiresAuth: true, role: 'superadmin' },
    children: [
      // Platform-wide KPIs.
      {
        path: '',
        name: 'superadmin-dashboard',
        component: () => import('@/pages/superadmin/SuperadminDashboard.vue'),
      },
      // Manage registered tenant hotels.
      {
        path: 'tenants',
        name: 'superadmin-tenants',
        component: () => import('@/pages/superadmin/TenantListPage.vue'),
      },
      // Detail view of a single tenant.
      {
        path: 'tenants/:id',
        name: 'superadmin-tenant-detail',
        component: () => import('@/pages/superadmin/TenantDetailPage.vue'),
      },
      // Superadmin reports.
      {
        path: 'reports',
        name: 'superadmin-reports',
        component: () => import('@/pages/superadmin/ReportsPage.vue'),
      },
      // Superadmin plans & features management.
      {
        path: 'plans',
        name: 'superadmin-plans',
        component: () => import('@/pages/superadmin/PlansPage.vue'),
      },
      // Superadmin integration health dashboard.
      {
        path: 'integrations',
        name: 'superadmin-integrations',
        component: () => import('@/pages/superadmin/IntegrationDashboardPage.vue'),
      },
      // Superadmin's own profile.
      {
        path: 'profile',
        name: 'superadmin-profile',
        component: () => import('@/pages/superadmin/ProfilePage.vue'),
      },
    ],
  },
  // Cashier POS panel: outlet-gated ordering, summary and item lookup (role-guarded).
  {
    path: '/cashier',
    component: () => import('@/layouts/CashierLayout.vue'),
    meta: { requiresAuth: true, role: 'cashier' },
    children: [
      // Dine In floor map with running-order timers.
      {
        path: '',
        redirect: { name: 'cashier-dine-in' },
      },
      {
        path: 'dine-in',
        name: 'cashier-dine-in',
        component: () => import('@/pages/cashier/CashierDineInPage.vue'),
        meta: { titleKey: 'cashier.nav.dineIn' },
      },
      {
        path: 'waiter-assignment',
        name: 'cashier-waiter-assignment',
        component: () => import('@/pages/cashier/CashierWaiterAssignmentPage.vue'),
        meta: { titleKey: 'cashier.nav.waiterAssignment' },
      },
      {
        path: 'take-away',
        name: 'cashier-take-away',
        component: () => import('@/pages/cashier/CashierTakeAwayPage.vue'),
        meta: { titleKey: 'cashier.nav.takeAway' },
      },
      {
        path: 'room-service',
        name: 'cashier-room-service',
        component: () => import('@/pages/cashier/CashierRoomServicePage.vue'),
        meta: { titleKey: 'cashier.nav.roomService' },
      },
      {
        path: 'delivery',
        name: 'cashier-delivery',
        component: () => import('@/pages/cashier/CashierDeliveryPage.vue'),
        meta: { titleKey: 'cashier.nav.delivery' },
      },
      {
        path: 'no-charge',
        name: 'cashier-no-charge',
        component: () => import('@/pages/cashier/CashierNoChargePage.vue'),
        meta: { titleKey: 'cashier.nav.noCharge' },
      },
      {
        path: 'order-summary',
        name: 'cashier-order-summary',
        component: () => import('@/pages/cashier/CashierOrderSummaryPage.vue'),
        meta: { titleKey: 'cashier.nav.orderSummary' },
      },
      {
        path: 'printer',
        name: 'cashier-printer',
        component: () => import('@/pages/printer/PrinterSettingsPage.vue'),
        meta: { titleKey: 'cashier.nav.printer' },
      },
      {
        path: 'item-lookup',
        name: 'cashier-item-lookup',
        component: () => import('@/pages/cashier/CashierItemLookupPage.vue'),
        meta: { titleKey: 'cashier.nav.itemLookup' },
      },
      {
        path: 'ingredients',
        name: 'cashier-ingredients',
        component: () => import('@/pages/cashier/CashierIngredientsPage.vue'),
        meta: { titleKey: 'cashier.nav.ingredients' },
      },
    ],
  },
  // Store manager panel: inventory, suppliers and procurement (role-guarded).
  {
    path: '/store-manager',
    component: () => import('@/layouts/StoreManagerLayout.vue'),
    meta: { requiresAuth: true, role: 'store_manager' },
    children: [
      // Stock KPIs, low-stock alerts and pending approvals.
      {
        path: '',
        name: 'store-dashboard',
        component: () => import('@/pages/store/StoreDashboardPage.vue'),
        meta: { titleKey: 'storeManager.nav.dashboard' },
      },
      // Stock item management with adjustments.
      {
        path: 'inventory',
        name: 'store-inventory',
        component: () => import('@/pages/store/StoreInventoryPage.vue'),
        meta: { titleKey: 'storeManager.nav.inventory' },
      },
      // Supplier directory.
      {
        path: 'suppliers',
        name: 'store-suppliers',
        component: () => import('@/pages/store/StoreSuppliersPage.vue'),
        meta: { titleKey: 'storeManager.nav.suppliers' },
      },
      // Purchase requisition workflow.
      {
        path: 'requisitions',
        name: 'store-requisitions',
        component: () => import('@/pages/store/StoreRequisitionsPage.vue'),
        meta: { titleKey: 'storeManager.nav.requisitions' },
      },
      // Purchase orders with approval flow.
      {
        path: 'purchase-orders',
        name: 'store-purchase-orders',
        component: () => import('@/pages/store/StorePurchaseOrdersPage.vue'),
        meta: { titleKey: 'storeManager.nav.purchaseOrders' },
      },
      // Goods received notes.
      {
        path: 'goods-received',
        name: 'store-goods-received',
        component: () => import('@/pages/store/StoreGoodsReceivedPage.vue'),
        meta: { titleKey: 'storeManager.nav.goodsReceived' },
      },
      // Department indents (item requests from departments).
      {
        path: 'indents',
        name: 'store-indents',
        component: () => import('@/pages/store/StoreIndentsPage.vue'),
        meta: { titleKey: 'storeManager.nav.indents' },
      },
      // Market lists (buyer's shopping list).
      {
        path: 'market-lists',
        name: 'store-market-lists',
        component: () => import('@/pages/store/StoreMarketListsPage.vue'),
        meta: { titleKey: 'storeManager.nav.marketLists' },
      },
      // Production runs from BOM recipes.
      {
        path: 'production',
        name: 'store-production',
        component: () => import('@/pages/store/StoreProductionPage.vue'),
        meta: { titleKey: 'storeManager.nav.production' },
      },
      // Returns to suppliers.
      {
        path: 'goods-returns',
        name: 'store-goods-returns',
        component: () => import('@/pages/store/StoreGoodsReturnsPage.vue'),
        meta: { titleKey: 'storeManager.nav.goodsReturns' },
      },
      // Internal messaging (shared staff page).
      {
        path: 'messages',
        name: 'store-messages',
        component: () => import('@/pages/messages/MessagesPage.vue'),
        meta: { titleKey: 'storeManager.nav.messages' },
      },
      // Inventory categories.
      {
        path: 'categories',
        name: 'store-categories',
        component: () => import('@/pages/store/StoreCategoriesPage.vue'),
        meta: { titleKey: 'storeManager.nav.categories' },
      },
      // Store customer database.
      {
        path: 'customers',
        name: 'store-customers',
        component: () => import('@/pages/store/StoreCustomersPage.vue'),
        meta: { titleKey: 'storeManager.nav.customers' },
      },
      // Date-range sales/inventory/expense reports.
      {
        path: 'reports',
        name: 'store-reports',
        component: () => import('@/pages/store/StoreReportsPage.vue'),
        meta: { titleKey: 'storeManager.nav.reports' },
      },
      // Full stock movement audit trail.
      {
        path: 'stock-movements',
        name: 'store-movements',
        component: () => import('@/pages/store/StoreMovementsPage.vue'),
        meta: { titleKey: 'storeManager.nav.movements' },
      },
      // Store expense tracking.
      {
        path: 'expenses',
        name: 'store-expenses',
        component: () => import('@/pages/store/StoreExpensesPage.vue'),
        meta: { titleKey: 'storeManager.nav.expenses' },
      },
      // Cash register drawer and shift history.
      {
        path: 'cash-register',
        name: 'store-cash-register',
        component: () => import('@/pages/store/StoreCashRegisterPage.vue'),
        meta: { titleKey: 'storeManager.nav.cashRegister' },
      },
      // Discount codes.
      {
        path: 'discounts',
        name: 'store-discounts',
        component: () => import('@/pages/store/StoreDiscountsPage.vue'),
        meta: { titleKey: 'storeManager.nav.discounts' },
      },
      // Stock transfers between locations.
      {
        path: 'transfers',
        name: 'store-transfers',
        component: () => import('@/pages/store/StoreTransfersPage.vue'),
        meta: { titleKey: 'storeManager.nav.transfers' },
      },
      // Physical stock counts.
      {
        path: 'stock-counts',
        name: 'store-stock-counts',
        component: () => import('@/pages/store/StoreStockCountsPage.vue'),
        meta: { titleKey: 'storeManager.nav.stockCounts' },
      },
      // Dedicated low-stock alert list.
      {
        path: 'low-stock',
        name: 'store-low-stock',
        component: () => import('@/pages/store/StoreLowStockPage.vue'),
        meta: { titleKey: 'storeManager.nav.lowStock' },
      },
      // Store, receipt, printer and tax settings.
      {
        path: 'settings',
        name: 'store-settings',
        component: () => import('@/pages/store/StoreSettingsPage.vue'),
        meta: { titleKey: 'storeManager.nav.settings' },
      },
      // Store activity audit log.
      {
        path: 'activity-log',
        name: 'store-activity',
        component: () => import('@/pages/store/StoreActivityLogPage.vue'),
        meta: { titleKey: 'storeManager.nav.activityLog' },
      },
      // Dedicated stock adjustment workbench (client menu group: Inventory).
      {
        path: 'stock-adjust',
        name: 'store-stock-adjust',
        component: () => import('@/pages/store/StoreStockAdjustPage.vue'),
        meta: { titleKey: 'storeManager.nav.stockAdjust' },
      },
      // The store manager's own account: personal info and password.
      {
        path: 'profile',
        name: 'store-profile',
        component: () => import('@/pages/superadmin/ProfilePage.vue'),
        meta: { titleKey: 'storeManager.nav.profile' },
      },
    ],
  },
  // Owner-only area: their hotels and per-hotel analytics.
  {
    path: '/owner',
    component: () => import('@/layouts/OwnerLayout.vue'),
    meta: { requiresAuth: true, role: 'owner' },
    children: [
      // Owner dashboard listing their hotels.
      {
        path: '',
        name: 'owner-dashboard',
        component: () => import('@/pages/owner/OwnerDashboard.vue'),
      },
      // Analytics for one owned hotel.
      {
        path: 'hotels/:id',
        name: 'owner-hotel-detail',
        component: () => import('@/pages/owner/OwnerHotelDetail.vue'),
      },
      // The owner's own account: personal info and password.
      {
        path: 'profile',
        name: 'owner-profile',
        component: () => import('@/pages/owner/ProfilePage.vue'),
      },
    ],
  },
  // Any unknown URL falls back to the public home page.
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Every navigation starts scrolled to the top of the new page.
  scrollBehavior() {
    return { top: 0 }
  },
})

// After a deploy the old chunk URLs 404; reload once to fetch the new build.
router.onError((error) => {
  const isChunkError =
    /dynamically imported module|Failed to fetch dynamically imported|error loading dynamically/i.test(error?.message || '')

  if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
    sessionStorage.setItem('chunk_reload', '1')
    window.location.reload()
  }
})

// Where each role lands after login and where they get bounced when denied.
export const dashboardMap = {
  superadmin: '/superadmin',
  owner: '/owner',
  hotel_admin: '/app',
  manager: '/app',
  accountant: '/app',
  receptionist: '/app',
  store_manager: '/store-manager',
  procurement_officer: '/app',
  housekeeping: '/app',
  kitchen: '/app/kitchen',
  waiter: '/app/take-order',
  bartender: '/app/take-order',
  cashier: '/cashier',
  staff: '/app',
}

/**
 * Global navigation guard: enforces auth, guest-only pages, role checks and
 * per-module access for the /app panel.
 * @param {object} to - Target route being navigated to.
 * @returns {object|undefined} Redirect location, or nothing to allow the nav.
 */
router.beforeEach(async (to) => {
  const token = sessionStorage.getItem('auth_token')
  const guestToken = sessionStorage.getItem('guest_token')
  const authStore = useAuthStore()

  // Guest portal pages require guest_token.
  if (to.meta.requiresGuestAuth && !guestToken) {
    return { name: 'guest-login' }
  }

  // Unauthenticated users are sent to login, remembering where they came from.
  if (to.meta.requiresAuth && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Signed-in users can't visit guest-only pages; send them to their dashboard.
  if (to.meta.guest && token) {
    // Role-based redirect takes priority (superadmin, owner always go to their panels).
    const role = authStore.user?.user_role
    if (role && dashboardMap[role]) return dashboardMap[role]
    // Self-service customers (registered via portal) go to /portal panel.
    if (authStore.user?.tenant?.self_service) return '/portal'
    return { path: '/app' }
  }

  if (token && (to.meta.role || to.meta.module)) {
    // Permissions come from /me, so make sure they are loaded before any
    // role/module check (a fresh login leaves them empty until fetched).
    if (!authStore.user || !authStore.permissions.length) {
      // Fresh page loads reset the store, so the profile is fetched here. A
      // single transient failure (5xx/network) must not log the user out, so
      // retry a few times and only fall back to login on a genuine 401/403.
      let profileFailed = false
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await authStore.fetchProfile()
          profileFailed = false
          break
        } catch (err) {
          profileFailed = true
          if (err?.response?.status === 401 || err?.response?.status === 403 || !authStore.isAuthenticated) break
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
      if (profileFailed) {
        if (!authStore.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
        // Session is still valid — allow the page to mount and let its own
        // requests surface any real problem instead of bouncing to login.
        return undefined
      }
    }

    // Role-guarded pages reject the wrong role back to that role's dashboard.
    if (to.meta.role && to.meta.role !== authStore.user?.user_role) {
      return dashboardMap[authStore.user?.user_role] || '/'
    }

    // Owners must pick a hotel from their dashboard before opening a panel.
    if (authStore.user?.user_role === 'owner' && to.path.startsWith('/app')
      && !sessionStorage.getItem('owner_viewing_hotel')) {
      return { path: '/owner' }
    }

    // Module-guarded pages check the module's role/permission allow-list.
    const module = to.meta.module ? moduleByKey(to.meta.module) : null
    if (module && !authStore.canAccess(module)) {
      return authStore.isSuperadmin ? '/superadmin' : '/app'
    }

    // Order takers (waiter/bartender) have no business on the stay-view
    // dashboard — their landing page is the order pad; bounce them there.
    if (to.path === '/app' && ['waiter', 'bartender'].includes(authStore.user?.user_role)) {
      return '/app/take-order'
    }

    // Kitchen staff get bounced to their single-click cooking board.
    if (to.path === '/app' && authStore.user?.user_role === 'kitchen') {
      return '/app/kitchen'
    }
  }
})

export default router
