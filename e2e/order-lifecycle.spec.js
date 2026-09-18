import { test, expect } from '@playwright/test'
import { signIn, trackPageErrors, API } from './helpers.js'

/**
 * Cashier order-lifecycle regression checks, driven against the local
 * Laravel dev server (run the suite WITHOUT CI=1 so the dev server on
 * :5173 talks to the API at :8000; CI uses the preview build instead):
 *   1. an order created through the New Order flow shows up on the
 *      Take Away board (PDF: "take-away orders not appearing");
 *   2. it is listed under Order Summary → Running;
 *   3. voiding it moves it to Order Summary → Voided (PDF2: "voided
 *      orders visible in my order summary").
 *
 * Each run places a disposable order with a unique guest name and voids it,
 * so the run is self-cleaning. Business dates are read from the created
 * order (via the API) so the assertions survive day rollovers.
 */
async function pickOutlet(page) {
  try {
    const option = page.locator('.outlet-option').first()
    await option.waitFor({ state: 'visible', timeout: 8000 })
    await option.click()
  } catch {
    /* gate may be auto-dismissed when an outlet is already chosen */
  }
}

async function findOrder(page, guestPart) {
  return page.evaluate(async ({ url, guest }) => {
    const token = sessionStorage.getItem('auth_token')
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    const list = data.data || data.orders || data
    const found = (Array.isArray(list) ? list : [])
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .find((o) => (o.guest_name || '').includes(guest))
    if (!found) return null
    return {
      order_number: found.order_number,
      order_date: (found.order_date || (found.created_at || '').slice(0, 10)),
      status: found.status,
      payment_status: found.payment_status,
    }
  }, { url: `${API}/v1/orders?per_page=100`, guest: guestPart })
}

test.describe('Cashier order lifecycle', () => {
  test('take-away order reaches the board, Order Summary Running, then Voided on void', async ({ page }) => {
    const errors = trackPageErrors(page)

    await signIn(page, { email: 'cashier' })
    await page.goto('/cashier/take-away')
    await pickOutlet(page)

    const guest = `E2E Lifecycle ${Date.now()}`

    await page.getByRole('button', { name: /new.*order/i }).first().click()
    const modal = page.locator('.order-modal')
    await expect(modal).toBeVisible()

    await page.locator('#no-guest').fill(guest)

    const item = page.locator('.cat-item:not(:disabled)').first()
    await expect(item).toBeVisible({ timeout: 15_000 })
    await item.click()

    // Single-tap side dish popup may appear; pick the first accompaniment if so.
    const pop = page.locator('.cat-pop')
    if (await pop.count()) {
      await pop.locator('.accomp-option').first().click()
    }

    await expect(page.locator('.line-row')).toBeVisible()
    await page.locator('.submit-btn').click()
    await expect(modal).not.toBeVisible({ timeout: 20_000 })

    const order = await findOrder(page, guest)
    expect(order, `created order for "${guest}" not found via API`).not.toBeNull()

    // 1) Take Away board (set to the order's own date) lists it.
    await page.locator('#ta-date').fill(order.order_date)
    const boardRow = page.locator('tr').filter({ has: page.locator('td', { hasText: order.order_number }).first() }).first()
    await expect(boardRow).toBeVisible({ timeout: 20_000 })

    // 2) Order Summary → Running lists it.
    await page.goto('/cashier/order-summary')
    await pickOutlet(page)
    await page.locator('#sum-date').fill(order.order_date)
    await page.locator('input[type="search"]').first().fill(order.order_number)
    const summaryRow = page.locator('tr').filter({ hasText: order.order_number }).first()
    await expect(summaryRow).toBeVisible({ timeout: 20_000 })

    // 3) Void from the row, then confirm in the drawer.
    await summaryRow.locator('button:has(i.fa-ban)').first().click()
    const reason = page.locator('.drawer-void input[type="text"]')
    await expect(reason).toBeVisible()
    await reason.fill('E2E verification void')
    await page.locator('.drawer .drawer-void-actions button.danger').click()

    // Authoritative outcome: the order is cancelled on the backend.
    await expect.poll(async () => (await findOrder(page, guest))?.status, {
      timeout: 30_000,
    }).toBe('cancelled')

    // Reload to a clean page state (the drawer void path can linger in the
    // single-threaded dev server), then confirm the order moved to Voided.
    await page.reload()
    await pickOutlet(page)
    await page.locator('#sum-date').fill(order.order_date)
    await page.locator('input[type="search"]').first().fill(order.order_number)
    const voidedTab = page.locator('.status-tab').filter({ hasText: 'Voided' }).first()
    await expect(voidedTab).toBeVisible()
    await voidedTab.click()
    await expect(page.locator('tr').filter({ hasText: order.order_number }).first()).toBeVisible({ timeout: 20_000 })

    expect(errors, 'uncaught page errors during lifecycle').toEqual([])
  })
})