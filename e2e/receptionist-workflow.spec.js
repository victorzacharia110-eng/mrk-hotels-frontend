/**
 * Receptionist workflow QA, driven from the workflow document
 * ("RECEPTIONIST WORK FLOW(1).pdf"). It walks the stay-view board the way a
 * front-desk receptionist would:
 *
 *   1. NEW BOOKING tab collects the documented fields and creates a stay.
 *   2. A guest who pays while still RESERVED must keep the reserved (red) bar —
 *      not flip to the checked-in green.
 *   3. A reservation whose check-in date is still in the future cannot be
 *      checked in today.
 *   4. Cancelling a confirmed reservation moves it to the Cancelled tab.
 *   5. Checking in a stay posts one folio entry per night of the stay.
 *   6. Folio adjustments/discounts must not inflate Total Paid — only the
 *      balance may move.
 *
 * Each test creates its own unique guest name and room; the suite is serial
 * (workers:1) so the stays never fight one another. Known deviations from the
 * document show up as failing assertions on purpose so the QA run surfaces them.
 */
import { test, expect } from '@playwright/test'
import { signIn, trackPageErrors, isoDate } from './helpers.js'
import {
  guestName,
  dismissAlerts,
  openBoard,
  tapVacantToday,
  createFutureStay,
  fillByLabel,
  pickOptionIn,
  openBookingModal,
  fillNewBooking,
  submitNewBooking,
  barFor,
  openStay,
  closeStay,
  openStayCharges,
  moreAction,
  waitForBarClass,
  folioCard,
  folioChargeRows,
  tzs,
} from './stay-workflow-helpers.js'

test.describe('receptionist workflow', () => {
  test('NEW BOOKING collects the documented fields and creates a stay', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    await openBoard(page)

    await tapVacantToday(page, { checkOut: isoDate(2) })
    await openBookingModal(page)
    const last = guestName('nb')
    await fillNewBooking(page, { last, checkOut: isoDate(2) })
    await submitNewBooking(page)

    await barFor(page, last)
    expect(errors).toEqual([])
  })

  test('a guest who pays while still reserved keeps the reserved (red) bar', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })

    // Reserved (future, no advance) stay — the board must show it as unpaid first.
    const last = guestName('pay')
    await createFutureStay(page, last, 4, 2)
    await openBoard(page)

    let bar = await barFor(page, last)
    expect(await bar.getAttribute('class'), 'reserved + balance due = red bar').toContain('bar-red')

    // Settle the whole balance through the stay modal "Add payment".
    let modal = await openStay(page, last)
    await openStayCharges(page, modal)
    const balance = tzs(await folioCard(page, modal, /balance/i))
    await moreAction(page, modal, /add payment/i)

    const payment = page.locator('.sv-modal[role="dialog"]', { hasText: /add payment/i }).last()
    await expect(payment.locator('input[data-field="amount"]')).toBeVisible()
    await payment.locator('input[data-field="amount"]').fill(String(balance))
    await payment.locator('.ss-trigger').first().click()
    await page.locator('.ss-panel [role="option"], .ss-panel li', { hasText: /cash/i }).first().click()
    await payment.locator('.btn-primary', { hasText: /save payment/i }).last().click()

    // The payment modal closes, but the stay modal stays open with a reloaded
    // folio; "Total paid" must now equal the settled balance.
    await expect(payment).toBeHidden({ timeout: 15_000 })
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /total paid/i)), { timeout: 15_000 })
      .toBe(balance)

    // The guest is still RESERVED: the stay offers check-in, not check-out…
    await expect(modal.locator('.sv-modal-manage', { hasText: /check in/i })).toBeVisible()
    await expect(modal.locator('.sv-modal-manage', { hasText: /check ?out/i })).toHaveCount(0)
    await closeStay(page)

    // …and the board bar must NOT have flipped to the checked-in green.
    bar = await barFor(page, last)
    expect(await bar.getAttribute('class'), 'reserved + paid still shows the reserved bar, not green').toContain('bar-red')
    expect(errors).toEqual([])
  })

  test('a reservation with a future check-in date cannot be checked in', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })

    // Future check-in that sits inside the 14-day board window.
    const last = guestName('fut')
    await createFutureStay(page, last, 4, 2)
    await openBoard(page)
    await barFor(page, last)

    await page.goto('/app/reservations')
    const row = page.locator('tbody tr', { hasText: last }).first()
    await expect(row).toBeVisible()
    await row.locator('.actions button', { hasText: /check.?in/i }).click()

    const rowModal = page.locator('.modal-overlay', { hasText: last }).last()
    await expect(rowModal.locator('button[type="submit"]')).toBeVisible()
    await rowModal.locator('button[type="submit"]').click()

    // Desired behaviour: the check-in is refused and the stay stays confirmed.
    await expect(page.locator('.alert-error').first()).toBeVisible({ timeout: 10_000 })
    const rowAfter = page.locator('tbody tr', { hasText: last }).first()
    await expect(rowAfter.locator('.badge', { hasText: /confirmed/i }).first()).toHaveText(/confirmed/i)
    expect(errors).toEqual([])
  })

  test('cancelling a confirmed reservation moves it to the Cancelled tab', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })

    const last = guestName('can')
    await createFutureStay(page, last, 3, 2)
    await openBoard(page)
    await barFor(page, last)

    await page.goto('/app/reservations')
    const row = page.locator('tbody tr', { hasText: last }).first()
    await expect(row).toBeVisible()
    page.once('dialog', (d) => d.accept())
    await row.locator('.actions button', { hasText: /cancel/i }).click()
    await expect(page.locator('.alert-success').first()).toBeVisible({ timeout: 15_000 })

    await page.locator('button.tab-cancelled').click()
    const cancelledRow = page.locator('tbody tr', { hasText: last }).first()
    await expect(cancelledRow).toBeVisible({ timeout: 15_000 })
    await expect(cancelledRow.locator('.badge', { hasText: /cancelled/i }).first()).toHaveText(/cancelled/i)
    expect(errors).toEqual([])
  })

  test('checking in a 3-night stay posts one folio entry per night', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    await openBoard(page)

    await tapVacantToday(page, { checkOut: isoDate(3) })
    await openBookingModal(page)
    const last = guestName('ci')
    await fillNewBooking(page, { last, checkOut: isoDate(3) })
    await submitNewBooking(page)

    let modal = await openStay(page, last)
    await modal.locator('.sv-modal-manage', { hasText: /check in/i }).click()
    await expect(page.locator('.sv-modal.sv-modal-tabs[role="dialog"]')).toBeHidden({ timeout: 30_000 })

    // Wait for the board to reflect the in-house state before re-opening, so
    // the modal reads real (not stale pre-reload) data.
    await waitForBarClass(page, last, 'bar-green')
    modal = await openStay(page, last)
    // Now in-house: the modal offers check-out (only a checked-in guest sees it)
    // and the board head turns green.
    await expect(modal.locator('.sv-modal-manage', { hasText: /check out/i })).toBeVisible()
    await expect(modal.locator('.sv-modal-head').first()).toHaveClass(/bar-green/)
    const rows = await folioChargeRows(page, modal)
    expect(await rows.count()).toBe(3)
    expect(errors).toEqual([])
  })

  test('folio adjustments do not inflate Total Paid — only the balance moves', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    await openBoard(page)

    await tapVacantToday(page, { checkOut: isoDate(2) })
    await openBookingModal(page)
    const last = guestName('adj')
    await fillNewBooking(page, { last, checkOut: isoDate(2) })
    await submitNewBooking(page)

    let modal = await openStay(page, last)
    await modal.locator('.sv-modal-manage', { hasText: /check in/i }).click()
    await expect(page.locator('.sv-modal.sv-modal-tabs[role="dialog"]')).toBeHidden({ timeout: 30_000 })

    await waitForBarClass(page, last, 'bar-green')
    modal = await openStay(page, last)
    await openStayCharges(page, modal)
    const paidBefore = tzs(await folioCard(page, modal, /Total Paid/i))
    const balBefore = tzs(await folioCard(page, modal, /balance/i))
    await moreAction(page, modal, /adjustment/i)

    const op = page.locator('.sv-modal[role="dialog"]', { hasText: /adjustment/i }).last()
    await expect(op.locator('input[data-field="amount"]')).toBeVisible()
    await op.locator('input[data-field="amount"]').fill(String(-100))
    await op.locator('input[data-field="description"]').fill('QA negative adjustment')
    await op.locator('.btn-primary', { hasText: /post|save|apply/i }).last().click()

    // Posting keeps the stay modal open but reloads the folio; on error the op
    // modal reopens with the message. The balance must drop by exactly the
    // posted adjustment.
    await expect(page.locator('.sv-modal[role="dialog"]', { hasText: /adjustment/i }).last()).toBeHidden().catch(() => {})
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(balBefore - 100)
    const paidAfter = tzs(await folioCard(page, modal, /Total Paid/i))
    expect(paidAfter, 'Total Paid must not change from a folio adjustment').toBe(paidBefore)
    expect(errors).toEqual([])
  })
})