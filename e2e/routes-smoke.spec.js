/**
 * Route-smoke tour: visits EVERY registered route under every role area and
 * asserts the page mounts cleanly — no uncaught error, a real redirect away
 * from login, the area's layout shell visible and non-blank content.
 *
 * Because each area signs in once and shares a page (serial mode), the whole
 * tour runs in a couple of minutes despite covering ~100 routes.
 */
import { test, expect } from '@playwright/test'
import { signIn, trackPageErrors, expectMounted, hotelId } from './helpers'

const APP_ROUTES = [
  '', 'overview', 'reservations', 'rooms', 'guests', 'payments', 'booking-requisitions',
  'night-audit', 'night-audit/logs', 'night-audit/transactions', 'activity-log-report',
  'distribution/channel-logs', 'housekeeping', 'orders', 'take-order', 'issue-reports',
  'messages', 'statuses', 'menu', 'laundry', 'fun-games', 'inventory', 'departments',
  'suppliers', 'requisitions', 'purchase-orders', 'goods-received', 'staff', 'reports',
  'accounting', 'profile', 'integrations/booking-com', 'integrations/quickbooks',
  'integrations/xero', 'overrides', 'import',
]
const STORE_ROUTES = [
  '', 'inventory', 'suppliers', 'requisitions', 'purchase-orders', 'goods-received',
  'indents', 'market-lists', 'production', 'goods-returns', 'messages',
  'categories', 'customers', 'reports', 'stock-movements', 'expenses', 'cash-register',
  'discounts', 'transfers', 'stock-counts', 'low-stock', 'settings', 'activity-log',
  'stock-adjust', 'profile',
]
const CASHIER_ROUTES = ['dine-in', 'waiter-assignment', 'take-away', 'room-service', 'delivery', 'no-charge', 'order-summary', 'item-lookup', 'ingredients']
const SUPERADMIN_ROUTES = ['', 'tenants', 'tenants/@id', 'reports', 'plans', 'integrations', 'profile']
const OWNER_ROUTES = ['', 'profile', 'hotels/@id']
const PUBLIC_ROUTES = ['/', '/booking', '/hotels/@id', '/login', '/register', '/portal/pricing', '/portal/login', '/portal/register', '/portal/forgot-password', '/portal/reset-password', '/guest/login']

/** Runs one route through the smoke assertions. If the tour's stale session
 *  gets bounced to login mid-way (a known race after ~a dozen navigations),
 *  re-authenticate and retry the route once before failing. */
async function smokeRoute(page, errors, path, shell, creds) {
  await page.goto(path)
  await page.waitForTimeout(900)
  if (creds && /\/(login|portal\/login)(\?|$)/.test(page.url())) {
    await signIn(page, creds)
    await page.goto(path)
    await page.waitForTimeout(900)
  }
  await expectMounted(page, errors, shell)
}

test.describe('public routes', () => {
  let id

  test.beforeAll(async ({ request }) => {
    id = await hotelId(request)
  })

  for (const route of PUBLIC_ROUTES) {
    test(`mounts ${route}`, async ({ page }) => {
      const errors = trackPageErrors(page)
      await smokeRoute(page, errors, route.replace('@id', id), 'body')
    })
  }

  test('guest portal pages redirect to guest login', async ({ page }) => {
    await page.goto('/guest/booking')
    await expect(page).toHaveURL(/\/guest\/login/)
    await page.goto('/guest/folio')
    await expect(page).toHaveURL(/\/guest\/login/)
  })
})

test.describe('app area (hotel admin)', () => {
  test.describe.configure({ mode: 'serial' })
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page, { email: 'admin' })
  })

  for (const route of APP_ROUTES) {
    test(`mounts /app/${route || ''}`, async () => {
      const errors = trackPageErrors(page)
      await smokeRoute(page, errors, `/app/${route}`, '.store-layout', { email: 'admin' })
    })
  }
})

test.describe('kitchen board', () => {
  test.describe.configure({ mode: 'serial' })
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page, { email: 'kitchen' })
  })

  test('mounts /app/kitchen', async () => {
    const errors = trackPageErrors(page)
    await smokeRoute(page, errors, '/app/kitchen', '.store-layout', { email: 'kitchen' })
  })
})

test.describe('superadmin area', () => {
  test.describe.configure({ mode: 'serial' })
  let page
  let id

  test.beforeAll(async ({ browser, request }) => {
    page = await browser.newPage()
    id = await hotelId(request)
    await signIn(page, { email: 'superadmin' })
  })

  for (const route of SUPERADMIN_ROUTES) {
    test(`mounts /superadmin/${route || ''}`, async () => {
      const errors = trackPageErrors(page)
      await smokeRoute(page, errors, `/superadmin/${route.replace('@id', id)}`, '.superadmin-layout', { email: 'superadmin' })
    })
  }
})

test.describe('cashier POS area', () => {
  test.describe.configure({ mode: 'serial' })
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page, { email: 'cashier' })
  })

  for (const route of CASHIER_ROUTES) {
    test(`mounts /cashier/${route}`, async () => {
      const errors = trackPageErrors(page)
      await smokeRoute(page, errors, `/cashier/${route}`, '.pos-layout', { email: 'cashier' })
    })
  }
})

test.describe('store manager area', () => {
  test.describe.configure({ mode: 'serial' })
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page, { email: 'store' })
  })

  for (const route of STORE_ROUTES) {
    test(`mounts /store-manager/${route || ''}`, async () => {
      const errors = trackPageErrors(page)
      await smokeRoute(page, errors, `/store-manager/${route}`, '.sm-layout', { email: 'store' })
    })
  }
})

test.describe('owner area', () => {
  test.describe.configure({ mode: 'serial' })
  let page
  let id

  test.beforeAll(async ({ browser, request }) => {
    page = await browser.newPage()
    id = await hotelId(request)
    await signIn(page, { email: 'owner' })
  })

  for (const route of OWNER_ROUTES) {
    test(`mounts /owner/${route || ''}`, async () => {
      const errors = trackPageErrors(page)
      await smokeRoute(page, errors, `/owner/${route.replace('@id', id)}`, '.owner-layout', { email: 'owner' })
    })
  }
})