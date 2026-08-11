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
  // Hotel KPIs landing page for staff.
  { path: '', name: 'hotel-dashboard', component: () => import('@/pages/dashboards/HotelDashboard.vue'), meta: { module: 'dashboard' } },
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
  // Laundry order management.
  { path: 'laundry', name: 'hotel-laundry', component: () => import('@/pages/laundry/LaundryListPage.vue'), meta: { module: 'laundry' } },
  // Guest fun game activities.
  { path: 'fun-games', name: 'hotel-fun-games', component: () => import('@/pages/fungames/FunGameListPage.vue'), meta: { module: 'fun-games' } },
  // Inventory items and stock adjustments.
  { path: 'inventory', name: 'hotel-inventory', component: () => import('@/pages/inventory/InventoryListPage.vue'), meta: { module: 'inventory' } },
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
  { path: 'reports', name: 'hotel-reports', component: () => import('@/pages/reports/ReportPage.vue'), meta: { module: 'reports' } },
  // Accounting reports.
  { path: 'accounting', name: 'hotel-accounting', component: () => import('@/pages/accounting/AccountingPage.vue'), meta: { module: 'accounting' } },
  // Current user's own profile.
  { path: 'profile', name: 'hotel-profile', component: () => import('@/pages/profile/ProfilePage.vue'), meta: { module: 'profile' } },
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
      // Superadmin's own profile.
      {
        path: 'profile',
        name: 'superadmin-profile',
        component: () => import('@/pages/superadmin/ProfilePage.vue'),
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
const dashboardMap = {
  superadmin: '/superadmin',
  owner: '/owner',
  hotel_admin: '/app',
  manager: '/app',
  accountant: '/app',
  receptionist: '/app',
  procurement_officer: '/app',
  housekeeping: '/app',
  kitchen: '/app',
  waiter: '/app',
  bartender: '/app',
  staff: '/app',
}

/**
 * Global navigation guard: enforces auth, guest-only pages, role checks and
 * per-module access for the /app panel.
 * @param {object} to - Target route being navigated to.
 * @returns {object|undefined} Redirect location, or nothing to allow the nav.
 */
router.beforeEach(async (to) => {
  const token = localStorage.getItem('auth_token')
  const authStore = useAuthStore()

  // Unauthenticated users are sent to login, remembering where they came from.
  if (to.meta.requiresAuth && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Signed-in users can't visit guest-only pages; send them to their dashboard.
  if (to.meta.guest && token) {
    return dashboardMap[authStore.user?.user_role] || { path: '/app' }
  }

  if (token && (to.meta.role || to.meta.module)) {
    // Permissions come from /me, so make sure they are loaded before any
    // role/module check (a fresh login leaves them empty until fetched).
    if (!authStore.user || !authStore.permissions.length) {
      try {
        await authStore.fetchProfile()
      } catch {
        return { name: 'login' }
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
  }
})

export default router
