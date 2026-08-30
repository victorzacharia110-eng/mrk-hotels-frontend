// Access matrix for the hotel (/app) panel.
//
// Each module lists the roles allowed to see it. An empty `roles` array means
// every signed-in staff member can see it (dashboard, profile). `permission`
// is an optional extra gate: the role must also hold that backend permission.
//
// The coarse "minimum level" model was the reason housekeeping could see F&B
// orders and receptionists could see procurement pages; explicit role lists
// keep each panel to what its staff actually need.
export const MODULES = [
  // Landing dashboard, visible to all staff.
  { key: 'dashboard', to: '/app', icon: 'fas fa-gauge-high', labelKey: 'nav.dashboard', roles: [] },
  // Read-only operational overview for management.
  { key: 'overview', to: '/app/overview', icon: 'fas fa-chart-simple', labelKey: 'overview.title', roles: ['hotel_admin', 'manager'] },
  // Reservations management.
  { key: 'reservations', to: '/app/reservations', icon: 'fas fa-calendar-check', labelKey: 'nav.reservations', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Room directory and statuses.
  { key: 'rooms', to: '/app/rooms', icon: 'fas fa-bed', labelKey: 'nav.rooms', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Guest registry.
  { key: 'guests', to: '/app/guests', icon: 'fas fa-users', labelKey: 'nav.guests', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Payment capture and confirmation.
  { key: 'payments', to: '/app/payments', icon: 'fas fa-money-bill-wave', labelKey: 'nav.payments', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Public booking requisitions inbox.
  { key: 'booking-requisitions', to: '/app/booking-requisitions', icon: 'fas fa-envelope-open-text', labelKey: 'bookingRequisitions.title', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Night audit — day close for receptionists.
  { key: 'night-audit', to: '/app/night-audit', icon: 'fas fa-moon', labelKey: 'nav.nightAudit', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Channel distribution — auto stop-sell and channel logs.
  { key: 'distribution', to: '/app/distribution/channel-logs', icon: 'fas fa-share-nodes', labelKey: 'nav.distribution', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Activity log report — daily/weekly/monthly staff activity.
  { key: 'activity-log-report', to: '/app/activity-log-report', icon: 'fas fa-clock-rotate-left', labelKey: 'nav.activityLogReport', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Housekeeping task board.
  { key: 'housekeeping', to: '/app/housekeeping', icon: 'fas fa-broom', labelKey: 'nav.housekeeping', roles: ['hotel_admin', 'manager', 'housekeeping'] },
  // Food & beverage orders for the service teams.
  { key: 'orders', to: '/app/orders', icon: 'fas fa-utensils', labelKey: 'nav.orders', roles: ['hotel_admin', 'manager', 'kitchen', 'waiter', 'bartender', 'staff'] },
  // Single-click kitchen board for the cooks.
  { key: 'kitchen-board', to: '/app/kitchen', icon: 'fas fa-fire-burner', labelKey: 'nav.kitchenBoard', roles: ['kitchen'] },
  // Touch-POS order pad (restaurant/bar toggle) for the service teams.
  { key: 'take-order', to: '/app/take-order', icon: 'fas fa-cash-register', labelKey: 'nav.takeOrder', roles: ['hotel_admin', 'manager', 'waiter', 'bartender', 'staff'] },
  // Staff issue reporting, open to everyone.
  { key: 'issue-reports', to: '/app/issue-reports', icon: 'fas fa-flag', labelKey: 'nav.issueReports', roles: [] },
  // Staff messaging/calls, open to everyone.
  { key: 'messages', to: '/app/messages', icon: 'fas fa-comments', labelKey: 'nav.messages', roles: [] },
  // Ephemeral staff statuses, open to everyone.
  { key: 'statuses', to: '/app/statuses', icon: 'fas fa-circle-dot', labelKey: 'nav.statuses', roles: [] },
  // Menu item management.
  { key: 'menu', to: '/app/menu', icon: 'fas fa-book-open', labelKey: 'nav.menu', roles: ['hotel_admin', 'manager', 'kitchen'] },
  // POS outlets (restaurant/bar) cashiers work from.
  { key: 'outlets', to: '/app/outlets', icon: 'fas fa-store', labelKey: 'nav.outlets', roles: ['hotel_admin', 'manager'] },
  // Laundry orders; additionally gated by the manage_laundry permission.
  { key: 'laundry', to: '/app/laundry', icon: 'fas fa-jug-detergent', labelKey: 'laundry.title', roles: ['hotel_admin', 'manager', 'housekeeping'], permission: 'manage_laundry' },
  // Guest fun-game activities.
  { key: 'fun-games', to: '/app/fun-games', icon: 'fas fa-gamepad', labelKey: 'funGames.title', roles: ['hotel_admin', 'manager', 'housekeeping'] },
  // Inventory stock management.
  { key: 'inventory', to: '/app/inventory', icon: 'fas fa-boxes-stacked', labelKey: 'nav.inventory', roles: ['hotel_admin', 'manager', 'procurement_officer'] },
  // Inventory departments.
  { key: 'departments', to: '/app/departments', icon: 'fas fa-building', labelKey: 'nav.departments', roles: ['hotel_admin', 'manager', 'procurement_officer'] },
  // Supplier records.
  { key: 'suppliers', to: '/app/suppliers', icon: 'fas fa-truck', labelKey: 'nav.suppliers', roles: ['hotel_admin', 'manager', 'procurement_officer'] },
  // Purchase requisitions.
  { key: 'requisitions', to: '/app/requisitions', icon: 'fas fa-file-signature', labelKey: 'nav.requisitions', roles: ['hotel_admin', 'manager', 'procurement_officer'] },
  // Purchase orders (accountant can view/approve payments side).
  { key: 'purchase-orders', to: '/app/purchase-orders', icon: 'fas fa-file-invoice', labelKey: 'nav.purchaseOrders', roles: ['hotel_admin', 'manager', 'accountant', 'procurement_officer'] },
  // Goods received notes.
  { key: 'goods-received', to: '/app/goods-received', icon: 'fas fa-clipboard-check', labelKey: 'nav.goodsReceived', roles: ['hotel_admin', 'manager', 'procurement_officer'] },
  // Staff/user management.
  { key: 'staff', to: '/app/staff', icon: 'fas fa-user-tie', labelKey: 'nav.staff', roles: ['hotel_admin', 'manager'] },
  // Business reporting.
  { key: 'reports', to: '/app/reports', icon: 'fas fa-chart-line', labelKey: 'nav.reports', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Accounting reports.
  { key: 'accounting', to: '/app/accounting', icon: 'fas fa-scale-balanced', labelKey: 'accounting.title', roles: ['hotel_admin', 'manager', 'accountant'] },
  // Personal profile, visible to all staff.
  { key: 'profile', to: '/app/profile', icon: 'fas fa-user-circle', labelKey: 'nav.profile', roles: [] },
  // Booking.com channel manager integration.
  { key: 'integrations/booking-com', to: '/app/integrations/booking-com', icon: 'fas fa-plug', labelKey: 'nav.bookingCom', roles: ['hotel_admin', 'manager'] },
  // QuickBooks Online accounting integration.
  { key: 'integrations/quickbooks', to: '/app/integrations/quickbooks', icon: 'fas fa-calculator', labelKey: 'nav.quickbooks', roles: ['hotel_admin', 'manager'] },
  // Xero accounting integration.
  { key: 'integrations/xero', to: '/app/integrations/xero', icon: 'fas fa-chart-line', labelKey: 'nav.xero', roles: ['hotel_admin', 'manager'] },
  // Check-in override approvals.
  { key: 'overrides', to: '/app/overrides', icon: 'fas fa-user-shield', labelKey: 'nav.overrideApprovals', roles: ['hotel_admin', 'manager', 'receptionist'] },
  // Bulk data import (CSV) — administrators only, since commits write records.
  { key: 'imports', to: '/app/import', icon: 'fas fa-file-import', labelKey: 'nav.importData', roles: ['hotel_admin'] },
]

/**
 * Looks up a module config by its key.
 * @param {string} key - Module key, e.g. 'reservations'.
 * @returns {object|undefined} The matching module config.
 */
export function moduleByKey(key) {
  return MODULES.find((m) => m.key === key)
}

/**
 * Looks up a module config by its route path.
 * @param {string} path - Route path, e.g. '/app/reservations'.
 * @returns {object|undefined} The matching module config.
 */
export function moduleByPath(path) {
  return MODULES.find((m) => m.to === path)
}
