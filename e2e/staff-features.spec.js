/**
 * End-to-end proof for the three client-reported issues on the F&B panels:
 *
 * 1. A table held by one waiter's open ticket must visually turn "occupied"
 *    (red) for EVERYONE — including the waiter who took it — and a different
 *    waiter must not be able to start an order on it.
 * 2. A bartender's bar ticket must show up in the Cashier's Order Summary
 *    (running) and be settleable from there.
 * 3. The talent-drawer Reports item actually renders department-scoped data,
 *    both on the Cashier panel (/cashier/reports) and for a bartender
 *    (/app/staff-reports).
 *
 * Runs against the seeded MRK Grand Hotel demo (two distinct waiters in the
 * restaurant department coexist, so the occupancy race is real).
 */
import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

const WAITER_A_EMAIL = 'benedicto-mahenge@mrk-grand.mrkhotels.test' // Benedicto Mahenge
const WAITER_B_EMAIL = 'betty-majaliwa@mrk-grand.mrkhotels.test' // Betty Majaliwa

/** If the cashier POS outlet gate is up, pick the first outlet. */
async function passOutletGate(page) {
  const option = page.locator('.outlet-gate-list .outlet-option').first()
  try {
    await option.waitFor({ state: 'visible', timeout: 10_000 })
    await option.click()
  } catch {
    // No gate — an outlet was already selected for this context.
  }
  await expect(page.locator('.sm-modal-backdrop')).toHaveCount(0, { timeout: 10_000 })
}

/** Places a ticket through the take-order UI. Returns the created order number. */
async function placeOrder(page, department = 'auto') {
  await page.goto('/app/take-order')
  // Bartenders land on the Dashboard tab — open the "New Order" tab first.
  await expect(page.locator('.pos-tab').nth(1)).toBeVisible({ timeout: 15_000 })
  await page.locator('.pos-tab').nth(1).click()
  await expect(page.locator('.cat-btn').first()).toBeVisible({ timeout: 15_000 })
  if (department !== 'auto') {
    const deptBtns = page.locator('.dept-toggle button')
    const label = department === 'bar' ? 'Bar' : 'Restaurant'
    const btn = deptBtns.filter({ hasText: label }).first()
    if (await btn.getAttribute('aria-pressed').then((v) => v === 'false')) await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  }

  const sent = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/orders') && r.request().method() === 'POST',
    { timeout: 20_000 },
  )

  // Pick the first enabled menu item from the first category.
  await page.locator('.cat-btn').first().click()
  const item = page.locator('.cat-item:not(:disabled) .cat-item-name').first()
  await expect(item).toBeVisible({ timeout: 10_000 })
  await item.click()

  const send = page.locator('.send-btn:not([disabled])')
  await expect(send).toBeVisible({ timeout: 10_000 })
  await send.click()

  const body = await (await sent).json()
  expect(body.order?.order_number, 'order create should return an order number').toMatch(/^ORD-/)
  return body.order.order_number
}

test('fixed: a table taken by another waiter turns occupied and cannot be re-ordered', async ({ browser }) => {
  // Waiter A walks in, takes the first free table and sends a ticket.
  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await signIn(pageA, { email: WAITER_A_EMAIL })
  await pageA.goto('/app/take-order')
  await expect(pageA.locator('.table-chip.free').first()).toBeVisible({ timeout: 15_000 })
  const table = pageA.locator('.table-chip.free').first()
  const tableName = (await table.locator('.table-chip-name').innerText()).trim()
  await table.click()
  await pageA.locator('.cat-btn').first().click()
  await expect(pageA.locator('.cat-item:not(:disabled) .cat-item-name').first()).toBeVisible({ timeout: 10_000 })
  await pageA.locator('.cat-item:not(:disabled) .cat-item-name').first().click()
  await expect(pageA.locator('.send-btn:not([disabled])')).toBeVisible({ timeout: 10_000 })
  await pageA.locator('.send-btn:not([disabled])').click()

  // The waiter who took the table now sees it as OCCUPIED (was green before)
  // but still theirs (clickable to keep working the ticket).
  const aChip = pageA.locator('.table-chip', { hasText: tableName }).first()
  await expect(aChip).toHaveClass(/occupied/, { timeout: 15_000 })
  await expect(aChip).not.toHaveClass(/free/)
  await expect(aChip).toBeEnabled()
  await expect(aChip).toContainText(/Benedicto/i)

  // Waiter B, a DIFFERENT staff member, must see the same table red and locked.
  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await signIn(pageB, { email: WAITER_B_EMAIL })
  await pageB.goto('/app/take-order')
  const bChip = pageB.locator('.table-chip', { hasText: tableName }).first()
  await expect(bChip).toHaveClass(/occupied/, { timeout: 15_000 })
  await expect(bChip).not.toHaveClass(/free/)
  await expect(bChip).toBeDisabled()
  await expect(bChip).toContainText(/Benedicto/i)

  await ctxA.close()
  await ctxB.close()
})

test('fixed: a bartender bar ticket appears in the cashier summary and settles there', async ({ browser }) => {
  // A bartender takes a bar order through the real ordering flow.
  const ctxBar = await browser.newContext()
  const barPage = await ctxBar.newPage()
  await signIn(barPage, { email: 'bartender@mrkhotels.test' })
  const orderNumber = await placeOrder(barPage, 'bar')

  // The cashier opens the Order Summary and sees the bar ticket running,
  // then settles it with cash in the pay modal.
  const ctxCash = await browser.newContext()
  const page = await ctxCash.newPage()
  await signIn(page, { email: 'cashier' })
  await page.goto('/cashier/order-summary')
  await passOutletGate(page)

  await expect(page.locator('.sm-table tbody tr', { hasText: orderNumber }).first()).toBeVisible({
    timeout: 20_000,
  })

  page.locator('.sm-table tbody tr', { hasText: orderNumber }).first()
    .getByRole('button', { name: /Settle/i })
    .click()
  await expect(page.locator('.pay-modal')).toBeVisible()

  const paid = page.waitForResponse(
    (r) => r.url().includes('/api/v1/orders/') && r.url().endsWith('/pay') && r.request().method() === 'POST',
    { timeout: 20_000 },
  )
  await page.locator('.pay-modal button[type="submit"]').click()
  await expect((await paid).ok()).toBeTruthy()

  // The ticket leaves Running and lands in Settled.
  await page.locator('.status-tab').nth(1).click()
  await expect(page.locator('.sm-table tbody tr', { hasText: orderNumber }).first()).toBeVisible({ timeout: 20_000 })

  await ctxBar.close()
  await ctxCash.close()
})

test('reports: cashier and bartender both see their department-scoped staff report', async ({ browser }) => {
  // Cashier panel: sidebar Reports link mounts the department report.
  const ctxCash = await browser.newContext()
  const cash = await ctxCash.newPage()
  await signIn(cash, { email: 'cashier' })
  await cash.goto('/cashier/reports')
  await passOutletGate(cash)
  await expect(cash.locator('.reports-page')).toBeVisible({ timeout: 20_000 })
  await expect(cash.locator('.rp-kpi').first()).toBeVisible({ timeout: 20_000 })
  expect(await cash.locator('.rp-kpi').count()).toBeGreaterThanOrEqual(4)
  await expect(cash.locator('.rp-table').first()).toBeVisible()
  await expect(cash.locator('.pos-nav-link', { hasText: /Reports/i })).toBeVisible()

  // Bartender's staff report (module-gated route in the talent panel).
  const ctxBar = await browser.newContext()
  const bar = await ctxBar.newPage()
  await signIn(bar, { email: 'bartender@mrkhotels.test' })
  await bar.goto('/app/staff-reports')
  await expect(bar.locator('.reports-page')).toBeVisible({ timeout: 20_000 })
  await expect(bar.locator('.rp-kpi').first()).toBeVisible({ timeout: 20_000 })
  await expect(bar.locator('.dept-toggle button', { hasText: /Bar/i })).toHaveAttribute('aria-pressed', 'true')
  await expect(bar.locator('.rp-table').first()).toBeVisible()

  await ctxCash.close()
  await ctxBar.close()
})