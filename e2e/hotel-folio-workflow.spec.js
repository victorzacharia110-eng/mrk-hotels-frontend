/**
 * Extended stay-view / folio QA driven by the remaining items in
 * "RECEPTIONIST WORK FLOW(1).pdf". Each test maps to a documented behaviour:
 *
 *   A1 Amend stays must reflect live on the stay and the board.
 *   A2 Room moves relocate the stay to the new room.
 *   A3 A CHECKED-IN room move keeps the stay live and shows the new room.
 *   A4 Extending a checked-in stay posts the added nights live; shortening
 *      them releases them (bill stays in step with the window).
 *   A5 The arrival day of a checked-in stay is immutable.
 *   B1 A checked-in guest can add a payment to settle the folio.
 *   B2 A guest due to check out today must show the due-out PURPLE bar.
 *   B3 An outstanding balance can be posted to a creditor company.
 *   B4 Sending the invoice by e-mail completes without a server error.
 *   B5 Editing a posted room charge is management-only (front desk cannot)
 *      and moves the balance, row intact, no dupes.
 *   B6 Voiding a posted room charge is management-only and removes only that
 *      row.
 *   B7 An edited payment is attributed to the staff member's name.
 *   C1 After a folio transfer the switcher keeps both balances consistent.
 *   C2 A payment can never push the current folio balance negative while a
 *      related folio is open.
 *   C3 Postings land on the related folio being VIEWED, not the current one.
 *   D1 Folio edit/void operations are management-only once a guest checks out.
 *   E1 Folio entries stay ordered chronologically (FIFO).
 *   E2 An inclusion appears on the ledger without moving the balance.
 *   G1 No checked-in stay can be cancelled; only unstarted bookings can.
 *
 * Tests that encode a still-broken document item carry the intended assertion
 * and FAIL until the bug is fixed, so the suite doubles as a regression list.
 */
import { test, expect } from '@playwright/test'
import { signIn, trackPageErrors, isoDate } from './helpers.js'
import {
  guestName,
  openBoard,
  tapVacantToday,
  openBookingModal,
  fillNewBooking,
  submitNewBooking,
  bookAndCheckIn,
  barFor,
  openStay,
  closeStay,
  moreAction,
  waitForBarClass,
  folioCard,
  tzs,
  createArrivalDayStay,
} from './stay-workflow-helpers.js'

const roomChargeRows = (modal) => modal.locator('.sv-folio-table tbody tr', { hasText: /room charge/i })
const folioRow = (modal, re) => modal.locator('.sv-folio-table tbody tr').filter({ hasText: re }).first()

/**
 * Re-authenticate mid-test as another staff member. The app keeps the session
 * in sessionStorage, so it must be dropped first or /login bounces straight
 * back to the dashboard without ever rendering the sign-in form.
 */
async function relogin(page, email) {
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })
  await signIn(page, { email })
}

/** The single SearchableSelect within the given modal (room picker etc.). */
const ssTrigger = (modal) => modal.locator('.ss-trigger').first()

async function recordPaymentCash(page, modal, amount) {
  await moreAction(page, modal, /add payment/i)
  const pm = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /add payment/i }).last()
  await expect(pm.locator('input[data-field="amount"]')).toBeVisible()
  await pm.locator('input[data-field="amount"]').fill(String(amount))
  await ssTrigger(pm).click()
  await page.locator('.ss-panel [role="option"], .ss-panel li', { hasText: /cash/i }).first().click()
  await page.waitForTimeout(250)
  await pm.locator('.btn-primary', { hasText: /save payment/i }).last().click()
  await expect(pm).toBeHidden({ timeout: 15_000 })
  return pm
}

test.describe('hotel folio workflow', () => {
  test('A1 - amend stay edits are reflected live', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('am')
    await openBoard(page)
    await tapVacantToday(page, { checkOut: isoDate(2) })
    await openBookingModal(page)
    await fillNewBooking(page, { last, checkOut: isoDate(2) })
    await submitNewBooking(page)

    const modal = await openStay(page, last)
    await moreAction(page, modal, /amend stay/i)
    const amend = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /amend stay/i }).last()
    await expect(amend).toBeVisible()
    // Amend to a SHORTER stay: neatens the check-out date, and because the
    // room was picked free for nights [today, +2), a [today, +1) window cannot
    // collide with the seed's upcoming arrivals.
    await amend.locator('[data-field="check_out_date"]').fill(isoDate(1))
    await amend.locator('.btn-primary', { hasText: /save changes/i }).click()
    await expect(amend).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    await closeStay(page).catch(() => {})
    const again = await openStay(page, last)
    await moreAction(page, again, /amend stay/i)
    const reopen = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /amend stay/i }).last()
    await expect(reopen).toBeVisible()
    await expect(reopen.locator('[data-field="check_out_date"]')).toHaveValue(isoDate(1))
    expect(errors).toEqual([])
  })

  test('A2 - room move relocates the stay', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('mv')
    await openBoard(page)
    await tapVacantToday(page, { checkOut: isoDate(2) })
    await openBookingModal(page)
    await fillNewBooking(page, { last, checkOut: isoDate(2) })
    await submitNewBooking(page)

    let modal = await openStay(page, last)
    await moreAction(page, modal, /room move/i)
    const move = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /room move/i }).last()
    await expect(move).toBeVisible()
    const trigger = ssTrigger(move)
    await expect(trigger).toBeVisible()
    const origRoom = (await trigger.innerText()).match(/\d+/)?.[0]
    expect(origRoom, 'the stay must currently be in a room').toBeTruthy()

    await trigger.click()
    const options = page.locator('.ss-panel [role="option"]')
    await expect(options.nth(1)).toBeVisible({ timeout: 8_000 })
    const chosenText = await options.nth(1).innerText()
    const chosenRoom = chosenText.match(/\d+/)?.[0]
    await options.nth(1).click()
    await page.waitForTimeout(250)
    expect(chosenRoom, 'a second room must exist').toBeTruthy()
    expect(chosenRoom, 'the picked room must differ from the current one').not.toBe(origRoom)

    await move.locator('.btn-primary', { hasText: /save changes/i }).click()
    await expect(move).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)
    await closeStay(page).catch(() => {})

    await barFor(page, last)
    modal = await openStay(page, last)
    await moreAction(page, modal, /room move/i)
    const reopen = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /room move/i }).last()
    const movedRoom = (await ssTrigger(reopen).innerText()).match(/\d+/)?.[0]
    expect(movedRoom, 'the stay must now be in the new room').toBe(chosenRoom)
    expect(errors).toEqual([])
  })

  test('A3 - a checked-in room move keeps the stay live and shows the new room', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('cimv')
    await bookAndCheckIn(page, last)

    let modal = await openStay(page, last)
    await moreAction(page, modal, /room move/i)
    const move = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /room move/i }).last()
    await expect(move).toBeVisible()
    const trigger = ssTrigger(move)
    await expect(trigger).toBeVisible()
    const origRoom = (await trigger.innerText()).match(/\d+/)?.[0]
    expect(origRoom, 'the stay must currently be in a room').toBeTruthy()

    await trigger.click()
    const options = page.locator('.ss-panel [role="option"]')
    await expect(options.nth(1)).toBeVisible({ timeout: 8_000 })
    const chosenRoom = (await options.nth(1).innerText()).match(/\d+/)?.[0]
    await options.nth(1).click()
    await page.waitForTimeout(250)
    expect(chosenRoom, 'the picked room must differ from the current one').not.toBe(origRoom)

    await move.locator('.btn-primary', { hasText: /save changes/i }).click()
    await expect(move).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)
    await waitForBarClass(page, last, 'bar-green')
    await closeStay(page).catch(() => {})

    // The guest is still checked in and the stay now points at the new room.
    modal = await openStay(page, last)
    await moreAction(page, modal, /room move/i)
    const reopen = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /room move/i }).last()
    const movedRoom = (await ssTrigger(reopen).innerText()).match(/\d+/)?.[0]
    expect(movedRoom, 'the checked-in stay must now be in the new room').toBe(chosenRoom)
    await reopen.locator('button.sv-modal-close, .sv-modal-close').first().click().catch(() => {})
    expect(errors).toEqual([])
  })

  test('A4 - extending a checked-in stay posts extra nights live; shortening releases them', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('ext')
    await bookAndCheckIn(page, last)

    let modal = await openStay(page, last)
    let rows = roomChargeRows(modal)
    await expect(rows.first()).toBeVisible()
    const oneNight = tzs(await rows.first().locator('td.num').innerText())
    const bal1 = tzs(await folioCard(page, modal, /balance/i))

    // Extend today→tomorrow to today→day after tomorrow: a second night must
    // be posted and the live balance must rise by exactly one night.
    await moreAction(page, modal, /amend stay/i)
    const amend = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /amend stay/i }).last()
    await expect(amend).toBeVisible()
    await amend.locator('[data-field="check_out_date"]').fill(isoDate(2))
    await amend.locator('.btn-primary', { hasText: /save changes/i }).click()
    await expect(amend).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    await expect
      .poll(async () => (await roomChargeRows(modal).count()), { timeout: 20_000 })
      .toBe(2)
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(bal1 + oneNight)

    // Shorten back: the second night's row is released and the bill drops.
    await moreAction(page, modal, /amend stay/i)
    const shorten = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /amend stay/i }).last()
    await expect(shorten).toBeVisible()
    await shorten.locator('[data-field="check_out_date"]').fill(isoDate(1))
    await shorten.locator('.btn-primary', { hasText: /save changes/i }).click()
    await expect(shorten).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    await expect
      .poll(async () => (await roomChargeRows(modal).count()), { timeout: 20_000 })
      .toBe(1)
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(bal1)
    expect(errors).toEqual([])
  })

  test('A5 - the arrival day of a checked-in stay is locked against amendment', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('lock')
    await bookAndCheckIn(page, last)

    const modal = await openStay(page, last)
    await moreAction(page, modal, /amend stay/i)
    const amend = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /amend stay/i }).last()
    await expect(amend).toBeVisible()
    await amend.locator('[data-field="check_in_date"]').fill(isoDate(1))
    await amend.locator('.btn-primary', { hasText: /save changes/i }).click()

    // Checked-in stays cannot move their arrival day: the amend stays open
    // with the backend's refusal shown to the clerk.
    await expect(amend).toBeVisible({ timeout: 10_000 })
    const errText = (await amend.locator('.sv-action-error').first().innerText().catch(() => '')).toLowerCase()
    expect(errText, 'the immutability refusal must be visible').toContain('check-in')
    expect(errors).toEqual([])
  })

  test('B1 - add payment to a checked-in guest settles the folio', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('pay')
    await bookAndCheckIn(page, last)

    let modal = await openStay(page, last)
    const bal = tzs(await folioCard(page, modal, /balance/i))
    await recordPaymentCash(page, modal, bal)

    await expect.poll(async () => tzs(await folioCard(page, modal, /total paid/i)), { timeout: 15_000 }).toBe(bal)
    await expect.poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 15_000 }).toBe(0)
    expect(errors).toEqual([])
  })

  test('B2 - a guest due to check out today shows the purple due-out bar', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('due')
    // Arrive YESTERDAY and leave TODAY: the guest is due out today. The board
    // window only starts today, so a same-day booking there cannot see that the
    // previous night is free — drive the reservations-list create modal instead,
    // whose availability search is backend-verified for the whole window.
    await createArrivalDayStay(page, last, isoDate(-1))

    // Checked in, due out today: per the workflow document the bar turns purple
    // (the app currently keeps it green — Bug B2).
    await openBoard(page)
    const modal = await openStay(page, last)
    await modal.locator('.sv-modal-manage', { hasText: /check in/i }).click()
    await expect(page.locator('.sv-modal.sv-modal-tabs[role="dialog"]')).toBeHidden({ timeout: 30_000 })
    await waitForBarClass(page, last, 'bar-purple')
    expect(errors).toEqual([])
  })

  test('B3 - posting an outstanding balance to a creditor moves it off the folio', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('cred')
    await bookAndCheckIn(page, last)

    const modal = await openStay(page, last)
    const bal = tzs(await folioCard(page, modal, /balance/i))
    expect(bal, 'the in-house folio should owe money to post').toBeGreaterThan(0)

    await moreAction(page, modal, /post to creditors/i)
    const pm = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /post to creditors/i }).last()
    await expect(pm).toBeVisible()

    const companySelect = pm.locator('.sv-field').filter({ hasText: /creditor company/i }).locator('.ss-trigger').first()
    await expect(companySelect).toBeVisible({ timeout: 10_000 })
    await companySelect.click()
    const opt = page.locator('.ss-panel [role="option"], .ss-panel li', { hasText: /MRK QA Corp/i }).first()
    await expect(opt).toBeVisible({ timeout: 10_000 })
    await opt.click()
    await page.waitForTimeout(250)
    await pm.locator('.btn-primary', { hasText: /post to creditors/i }).last().click()

    await expect(pm).toBeHidden({ timeout: 20_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)
    await expect.poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 }).toBe(0)
    await expect(folioRow(modal, /MRK QA Corp/i)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('B4 - sending the invoice by e-mail completes without an error', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('mail')
    await bookAndCheckIn(page, last)

    const modal = await openStay(page, last)
    // An e-mail must be on file or the send button is disabled.
    await moreAction(page, modal, /amend stay/i)
    const amend = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /amend stay/i }).last()
    await amend.locator('[data-field="guest_email"]').fill(`qa+${last}@example.com`)
    await amend.locator('.btn-primary', { hasText: /save changes/i }).click()
    await expect(amend).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    const send = modal.locator('.sv-modal-manage', { hasText: /send invoice/i })
    await expect(send).toBeEnabled({ timeout: 10_000 })
    await send.click()
    // Bug B4: production 500 on the mail pipeline shows up here as an action error.
    await expect.poll(async () => page.locator('.sv-action-error').count(), { timeout: 45_000 }).toBe(0)
    await expect
      .poll(async () => !(await send.isDisabled()), { timeout: 45_000 })
      .toBe(true)
    expect(errors).toEqual([])
  })

  test('B5 - editing a posted room charge is management-only and moves the balance without duplicates', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('edit')
    await bookAndCheckIn(page, last)

    // The nightly room charge is the frozen stay bill: a front-desk clerk
    // must not be able to rewrite it.
    let modal = await openStay(page, last)
    let rows = roomChargeRows(modal)
    await expect(rows.first()).toBeVisible()
    const count = await rows.count()
    expect(count, 'a two-night stay must post two room charges').toBeGreaterThan(0)
    await expect(rows.first().locator('button[title="Edit"]')).toHaveCount(0)
    await expect(rows.first().locator('button[title="Void"]')).toHaveCount(0)
    await closeStay(page).catch(() => {})

    // Management (manager level 80) rewrites the row: no duplicates, and the
    // balance moves by exactly the difference.
    await relogin(page, 'manager')
    await openBoard(page)
    modal = await openStay(page, last)
    rows = roomChargeRows(modal)
    await expect(rows.first()).toBeVisible()
    await expect(rows.first().locator('button[title="Edit"]')).toBeVisible()
    const target = rows.first()
    const amount = tzs(await target.locator('td.num').innerText())
    const balBefore = tzs(await folioCard(page, modal, /balance/i))
    const half = Math.max(1, Math.round(amount / 2))

    await target.locator('button[title="Edit"]').click()
    const edit = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /edit/i }).last()
    await expect(edit).toBeVisible()
    await edit.locator('[data-field="amount"]').fill(String(half))
    await edit.locator('.btn-primary', { hasText: /save/i }).click()
    await expect(edit).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    await expect
      .poll(async () => (await roomChargeRows(modal).count()), { timeout: 20_000 })
      .toBe(count)
    await expect
      .poll(
        async () => tzs(await roomChargeRows(modal).first().locator('td.num').innerText()),
        { timeout: 20_000 },
      )
      .toBe(half)
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(balBefore - (amount - half))
    expect(errors).toEqual([])
  })

  test('B6 - voiding a posted room charge is management-only and removes only that row', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('void')
    await bookAndCheckIn(page, last, { nights: 2 })

    // A front-desk clerk sees no edit/void on a nightly room charge at all.
    let modal = await openStay(page, last)
    let rows = roomChargeRows(modal)
    await expect(rows.first()).toBeVisible()
    await expect(rows.first().locator('button[title="Edit"]')).toHaveCount(0)
    await expect(rows.first().locator('button[title="Void"]')).toHaveCount(0)
    await closeStay(page).catch(() => {})

    // Management voids the second night: only that row disappears.
    await relogin(page, 'manager')
    await openBoard(page)
    modal = await openStay(page, last)
    rows = roomChargeRows(modal)
    await expect(rows.first()).toBeVisible()
    await expect(rows.first().locator('button[title="Void"]')).toBeVisible()
    const count = await rows.count()
    expect(count, 'a two-night stay must post two room charges').toBeGreaterThan(1)
    const target = rows.nth(1)
    const amount = tzs(await target.locator('td.num').innerText())
    const balBefore = tzs(await folioCard(page, modal, /balance/i))

    page.once('dialog', (d) => d.accept())
    await target.locator('button[title="Void"]').click()

    await expect
      .poll(async () => (await roomChargeRows(modal).count()), { timeout: 20_000 })
      .toBe(count - 1)
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(balBefore - amount)
    expect(errors).toEqual([])
  })

  test('B7 - an edited payment is attributed to the staff member, not a raw id', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('editpay')
    await bookAndCheckIn(page, last)

    const modal = await openStay(page, last)
    const bal = tzs(await folioCard(page, modal, /balance/i))
    await recordPaymentCash(page, modal, bal)
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /total paid/i)), { timeout: 15_000 }).toBe(bal)

    const paymentEdit = modal.locator('.sv-folio-payment-edit').first()
    await expect(paymentEdit).toBeVisible()
    await paymentEdit.click()
    const pem = page.locator('.sv-modal-sm[role="dialog"]:has(.sv-pay-edit-submit)')
    await expect(pem).toBeVisible()
    await pem.locator('textarea').fill('QA edited note')
    await pem.locator('.sv-pay-edit-submit').click()
    await expect(pem).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    const note = modal.locator('.sv-folio-edit-note').first()
    await expect(note).toBeVisible({ timeout: 15_000 })
    const text = (await note.innerText()).toLowerCase()
    // Bug B7: the pending payload only carries the raw edited_by UUID.
    expect(text).toContain('edited by')
    expect(text).toContain('receptionist')
    expect(text, 'the auditor must never see a raw uuid').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
    expect(errors).toEqual([])
  })

  test('C1/C2 - transferring an operation keeps both folios consistent; payments cannot go negative', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const lastA = guestName('tf')
    const lastB = guestName('tb')
    await bookAndCheckIn(page, lastA)
    await bookAndCheckIn(page, lastB)

    // B's weighted balance is needed to compare after the move.
    const bBalBefore = await (async () => {
      const m = await openStay(page, lastB)
      const b = tzs(await folioCard(page, m, /balance/i))
      await closeStay(page).catch(() => {})
      return b
    })()

    let modal = await openStay(page, lastA)
    await expect(roomChargeRows(modal).first()).toBeVisible()
    const balA0 = tzs(await folioCard(page, modal, /balance/i))
    const moveAmt = tzs(await roomChargeRows(modal).first().locator('td.num').innerText())

    await moreAction(page, modal, /transfer folio/i)
    const tm = page.locator('.sv-modal-sm[role="dialog"]').filter({ has: page.locator('.sv-split-panel') }).last()
    await expect(tm).toBeVisible()
    await tm.locator('.sv-split-op input[type="checkbox"]').first().check()
    await tm.locator('.sv-split-search input').fill(lastB)
    await tm.locator('.sv-split-search button').click()
    const target = tm.locator('.sv-split-target').filter({ hasText: lastB }).first()
    await expect(target).toBeVisible({ timeout: 10_000 })
    await target.click()
    await page.waitForTimeout(200)
    await tm.locator('.sv-arrow-btn').click()
    await expect(tm).toBeHidden({ timeout: 20_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    // A lost exactly one night's charge, B gained it.
    const residual = balA0 - moveAmt
    await expect.poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 }).toBe(residual)
    await closeStay(page).catch(() => {})
    const bModal = await openStay(page, lastB)
    await expect
      .poll(async () => tzs(await folioCard(page, bModal, /balance/i)), { timeout: 20_000 })
      .toBe(bBalBefore + moveAmt)
    await closeStay(page).catch(() => {})

    // The switcher must list both folios, highlight exactly one and never zero
    // the other folio's balance while it is not being viewed.
    const switcherRows = () => modal.locator('.sv-folio-table-switch tbody tr')
    modal = await openStay(page, lastA)
    await expect(switcherRows()).toHaveCount(2)
    await expect(modal.locator('.sv-folio-row-active')).toHaveCount(1)

    // Bug #9: each switcher row must name its room so the clerk can tell the
    // current folio from the receiving one at a glance.
    const aRow = switcherRows().nth(0)
    const aRowCol1 = await aRow.locator('td').nth(1).innerText()
    expect(aRowCol1.toLowerCase()).toContain(lastA.toLowerCase())
    expect(aRowCol1, 'the current-folio row must show the room').toMatch(/·\s*\d+/)
    await expect.poll(async () => tzs(await aRow.locator('td').nth(3).innerText()), { timeout: 20_000 }).toBe(residual)

    const bRow = switcherRows().nth(1)
    await bRow.locator('.sv-folio-view-btn').click()
    await expect(modal.locator('.sv-folio-now-viewing')).toBeVisible({ timeout: 10_000 })
    await expect(modal.locator('.sv-folio-row-active')).toHaveCount(1)
    // The current (A) row is now non-active but must still read its residual balance.
    await expect.poll(async () => tzs(await aRow.locator('td').nth(3).innerText()), { timeout: 20_000 }).toBe(residual)
    await expect.poll(async () => tzs(await bRow.locator('td').nth(3).innerText()), { timeout: 20_000 }).toBe(bBalBefore + moveAmt)

    await modal.locator('.sv-folio-return').click()
    await expect(modal.locator('.sv-folio-now-viewing')).toBeHidden({ timeout: 10_000 })
    await expect(modal.locator('.sv-folio-row-active')).toHaveCount(1)

    // C2 - a payment larger than the current folio's balance must be refused:
    // the balance can never turn negative, even with a related folio open.
    const curBal = tzs(await folioCard(page, modal, /balance/i))
    await moreAction(page, modal, /add payment/i)
    const pm = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /add payment/i }).last()
    await expect(pm.locator('input[data-field="amount"]')).toBeVisible()
    await pm.locator('input[data-field="amount"]').fill(String(curBal + 2000))
    await ssTrigger(pm).click()
    await page.locator('.ss-panel [role="option"], .ss-panel li', { hasText: /cash/i }).first().click()
    await page.waitForTimeout(250)
    await pm.locator('.btn-primary', { hasText: /save payment/i }).last().click()
    // Bug C2: the overpay must be refused — the payment modal stays open, the
    // error is visible and the folio balance is untouched.
    await expect(pm).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.sv-action-error').first()).toBeVisible({ timeout: 15_000 })
    await expect.poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 }).toBe(curBal)
    await pm.locator('button.sv-modal-close, .sv-modal-close').first().click().catch(() => {})
    await expect(pm).toBeHidden({ timeout: 10_000 }).catch(() => {})
    expect(errors).toEqual([])
  })

  test('C3 - a posting lands on the related folio being viewed, not the current one', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const lastA = guestName('view')
    const lastB = guestName('vw')
    await bookAndCheckIn(page, lastA)
    await bookAndCheckIn(page, lastB)

    const aStart = tzs(await (async () => {
      const m = await openStay(page, lastA)
      const b = tzs(await folioCard(page, m, /balance/i))
      await closeStay(page).catch(() => {})
      return b
    })())
    const bStart = tzs(await (async () => {
      const m = await openStay(page, lastB)
      const b = tzs(await folioCard(page, m, /balance/i))
      await closeStay(page).catch(() => {})
      return b
    })())

    let modal = await openStay(page, lastA)
    await expect(roomChargeRows(modal).first()).toBeVisible()
    const moveAmt = tzs(await roomChargeRows(modal).first().locator('td.num').innerText())

    // Split one charge from A to B so the stay carries two folios.
    await moreAction(page, modal, /transfer folio/i)
    const tm = page.locator('.sv-modal-sm[role="dialog"]').filter({ has: page.locator('.sv-split-panel') }).last()
    await expect(tm).toBeVisible()
    await tm.locator('.sv-split-op input[type="checkbox"]').first().check()
    await tm.locator('.sv-split-search input').fill(lastB)
    await tm.locator('.sv-split-search button').click()
    const target = tm.locator('.sv-split-target').filter({ hasText: lastB }).first()
    await expect(target).toBeVisible({ timeout: 10_000 })
    await target.click()
    await page.waitForTimeout(200)
    await tm.locator('.sv-arrow-btn').click()
    await expect(tm).toBeHidden({ timeout: 20_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    // Switch the VIEW (not the stay) to B: postings must then hit B's folio.
    const switcherRows = () => modal.locator('.sv-folio-table-switch tbody tr')
    await expect(switcherRows()).toHaveCount(2)
    const bRow = switcherRows().filter({ hasText: lastB.toUpperCase() }).first()
    await expect(bRow).toBeVisible({ timeout: 10_000 })
    await bRow.locator('.sv-folio-view-btn').click()
    await expect(modal.locator('.sv-folio-now-viewing')).toBeVisible({ timeout: 10_000 })

    // The ledger now shows the related (B) folio's balance.
    const bBalViewing = tzs(await folioCard(page, modal, /balance/i))
    expect(bBalViewing, 'viewing switches the ledger to the related folio').toBe(bStart + moveAmt)

    const charge = 5000
    await moreAction(page, modal, /add charges/i)
    const c = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /save charge/i }).last()
    await expect(c).toBeVisible()
    await c.locator('[data-field="description"]').fill('QA viewed-folio charge')
    await c.locator('[data-field="amount"]').fill(String(charge))
    await c.locator('.btn-primary').click()
    await expect(c).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    // The viewed (B) folio took the charge; the current (A) folio is untouched.
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(bBalViewing + charge)
    await modal.locator('.sv-folio-return').click()
    await expect
      .poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 20_000 })
      .toBe(aStart - moveAmt)
    expect(errors).toEqual([])
  })

  test('G1 - a checked-in stay cannot be cancelled from the modal', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('nocl')
    const nights = 2
    await bookAndCheckIn(page, last, { nights })

    const modal = await openStay(page, last)
    // Bug #3: the cancel booking action must not offer itself to a guest who
    // already occupies a room; only pending/confirmed stays can be cancelled.
    await expect(modal.locator('.sv-modal-danger', { hasText: /cancel booking/i })).toHaveCount(0)
    await moreAction(page, modal, /amend stay/i).catch(() => {})
    // The More menu must not list a cancel action for this checked-in stay.
    if (await page.locator('.sv-dropdown-menu').isVisible().catch(() => false)) {
      await expect(page.locator('.sv-dropdown-menu button', { hasText: /cancel booking/i })).toHaveCount(0)
      await page.keyboard.press('Escape')
    }
    expect(errors).toEqual([])
  })

  test('D1 - folio edit/void is management-only after checkout', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('co')
    await bookAndCheckIn(page, last)

    // Settle, then check the guest out.
    let modal = await openStay(page, last)
    const bal = tzs(await folioCard(page, modal, /balance/i))
    if (bal > 0) {
      await recordPaymentCash(page, modal, bal)
    }
    await modal.locator('.sv-modal-manage', { hasText: /check ?out/i }).click()
    await expect(page.locator('.sv-modal.sv-modal-tabs[role="dialog"]')).toBeHidden({ timeout: 30_000 })
    await waitForBarClass(page, last, 'bar-blue')

    modal = await openStay(page, last)
    // Bug D1: a receptionist still sees Edit/Void on a checked-out folio; the
    // document says these become management-only once the guest is out.
    const editable = modal.locator(
      '.sv-folio-table tbody tr button[title="Edit"], .sv-folio-table tbody tr button[title="Void"]',
    )
    await expect(editable).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('E1 - folio entries stay ordered chronologically', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('fifo')
    await bookAndCheckIn(page, last)

    const modal = await openStay(page, last)
    for (const i of [1, 2, 3]) {
      await moreAction(page, modal, /add charges/i)
      const charge = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /save charge/i }).last()
      await expect(charge).toBeVisible()
      await charge.locator('[data-field="description"]').fill(`QA fifo charge ${i}`)
      await charge.locator('[data-field="amount"]').fill(String(5000 * i))
      await charge.locator('.btn-primary').click()
      await expect(charge).toBeHidden({ timeout: 15_000 })
      await expect(page.locator('.sv-action-error')).toHaveCount(0)
    }

    const dates = []
    const rows = modal.locator('.sv-folio-table tbody tr')
    const n = await rows.count()
    for (let i = 0; i < n; i++) {
      const [dd, mm, yy] = (await rows.nth(i).locator('td').first().innerText()).split('/').map(Number)
      dates.push(Date.UTC(yy, mm - 1, dd))
    }
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i], `row ${i} must not precede row ${i - 1}`).toBeGreaterThanOrEqual(dates[i - 1])
    }
    expect(errors).toEqual([])
  })

  test('E2 - an inclusion appears on the ledger without moving the balance', async ({ page }) => {
    const errors = trackPageErrors(page)
    await signIn(page, { email: 'reception' })
    const last = guestName('inc')
    await bookAndCheckIn(page, last)

    const modal = await openStay(page, last)
    const bal = tzs(await folioCard(page, modal, /balance/i))
    await moreAction(page, modal, /inclusion/i)
    const inc = page.locator('.sv-modal-sm[role="dialog"]', { hasText: /inclusion/i }).last()
    await expect(inc).toBeVisible()
    await inc.locator('[data-field="description"]').fill('QA complimentary airport transfer')
    await inc.locator('[data-field="amount"]').fill('25000')
    await inc.locator('.btn-primary').click()
    await expect(inc).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.sv-action-error')).toHaveCount(0)

    const row = folioRow(modal, /airport transfer/i)
    await expect(row).toBeVisible()
    expect(tzs(await row.locator('td.num').innerText())).toBeGreaterThan(0)
    await expect.poll(async () => tzs(await folioCard(page, modal, /balance/i)), { timeout: 15_000 }).toBe(bal)
    expect(errors).toEqual([])
  })
})