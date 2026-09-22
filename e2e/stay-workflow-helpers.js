/**
 * Shared board / stay-modal helpers shared by the receptionist workflow spec
 * and the hotel folio workflow spec. Both suites drive the stay-view board
 * the way a front-desk receptionist would.
 */
import { expect } from '@playwright/test'
import { isoDate } from './helpers.js'

export function guestName(tag) {
  return `pw${tag}${Date.now()}`
}

export async function dismissAlerts(page) {
  for (let i = 0; i < 6; i++) {
    const overlay = page.locator('.alert-modal-overlay')
    await overlay.waitFor({ state: 'visible', timeout: 300 }).catch(() => {})
    if (!(await overlay.isVisible().catch(() => false))) return
    await page.locator('.alert-modal-close').first().click()
    await page.waitForTimeout(350)
  }
}

export async function openBoard(page) {
  await page.goto('/app')
  await expect(page.locator('.sv-room-track').first()).toBeVisible({ timeout: 20_000 })
  await dismissAlerts(page)
}

/**
 * Click the booking cell of a room free for [checkIn, checkOut). The board
 * only marks each single day cell vacant, so a room free today can still
 * collide with bookings starting tomorrow; a window-aware picker must require
 * every NIGHT cell in the range to be vacant. The checkout day is excluded
 * (a same-day arrival is legal), which mirrors isVacantCell + the availability
 * service's date semantics.
 */
export async function tapVacantToday(page, { checkIn, checkOut } = {}) {
  await dismissAlerts(page)
  // Wait for the space map data to arrive: bars render from a paginated stays
  // fetch, so before the first page lands every cell looks "vacant". Choosing
  // a cell too early double-books the first room of the grid.
  await expect(page.locator('.sv-bar').first()).toBeVisible({ timeout: 15_000 }).catch(() => {})
  const today = isoDate(0)
  const nights = checkIn && checkOut ? dayDiff(checkOut, checkIn) : 1
  const startShift = checkIn ? dayDiff(checkIn, today) : 0

  const rows = page.locator('.sv-room-track')
  const rowCount = await rows.count()
  await expect(page.locator('.sv-cell-bg').first()).toBeVisible({ timeout: 10_000 })

  // Locate today's column inside each row (cells follow the visible `days`).
  const firstCells = rows.first().locator('.sv-cell-bg')
  const cellCount = await firstCells.count()
  const todayIdx = await firstCells
    .evaluateAll((els) => els.findIndex((el) => el.classList.contains('today')))
  const nightIdx = Array.from({ length: nights }, (_, i) => todayIdx + startShift + i)
  if (nightIdx.some((i) => i < 0 || i >= cellCount)) {
    throw new Error(`booking window [${checkIn}..${checkOut}] outside the board window`)
  }

  for (let r = 0; r < rowCount; r++) {
    const cells = rows.nth(r).locator('.sv-cell-bg')
    const classes = await cells.evaluateAll((els) => els.map((el) => el.className))
    const allFree = nightIdx.every((i) => classes[i].includes('vacant'))
    if (!allFree) continue
    // Half-day model: a guest checking out on the arrival day still holds the
    // room for its first half, and the backend refuses a NEW check-in until
    // that occupant is actually checked out. So a bar ending exactly on the
    // check-in day makes the room unusable for an arriving-today flow, even
    // though the checkout-day cell reads "vacant". Skip those rooms (and only
    // those: checked-out blue bars do not block a new arrival). Purple bars
    // (checked in, due out today) are likewise in-house occupants the room
    // cannot admit anyone else into.
    const bars = await rows
      .nth(r)
      .locator('.sv-bar')
      .evaluateAll((els) =>
        els
          .filter((el) => /bar-(green|red|purple)/.test(el.className))
          .map((el) => {
            const m = /grid-column:\s*([\d.]+)\s*\/\s*span\s*([\d.]+)/.exec(el.style.cssText || '')
            return m ? Math.floor((Number(m[1]) + Number(m[2]) - 2) / 2) : -1
          }),
      )
    if (bars.some((endDay) => endDay === startShift)) continue
    await cells.nth(nightIdx[0]).click()
    return
  }
  throw new Error('no room is free for the requested window')
}

function dayDiff(fromIso, toIso) {
  return Math.round((Date.parse(fromIso) - Date.parse(toIso)) / 86_400_000)
}

/**
 * Create a FUTURE (reserved, not yet checked-in) stay through the reservations
 * list modal. It searches availability like the online booking flow, so the
 * room returned is guaranteed free for the whole window — unlike the stay-view
 * cells, whose single-day vacancy does not guarantee the following nights.
 */
export async function createFutureStay(page, last, baseDay = 4, nights = 2) {
  for (let base = baseDay; base <= baseDay + 6; base += 2) {
    const arrivalIso = isoDate(base)
    if (await _createStayTry(page, last, arrivalIso, nights)) return
  }
  throw new Error('no window returned an available room in the list create modal')
}

/**
 * Creates a stay for a SPECIFIC arrival day through the reservations-list
 * create modal. The modal polls the backend availability endpoint for the
 * chosen window, so the room it returns is guaranteed free for EVERY night
 * of that window — unlike the front-desk board cells, whose vacancy only
 * covers the boarded window (today onward). Used by tests that need a stay
 * starting BEFORE today (exactly what a "due out today" guest is).
 */
export async function createArrivalDayStay(page, last, arrivalIso, nights = 1) {
  if (!(await _createStayTry(page, last, arrivalIso, nights))) {
    throw new Error(`no room available for arrival ${arrivalIso} · ${nights} night(s)`)
  }
}

/** Books one room through the list create modal; returns true when done. */
async function _createStayTry(page, last, arrivalIso, nights) {
  await page.goto('/app/reservations')
  await expect(page.locator('.head-actions .btn.btn-primary')).toBeVisible({ timeout: 10_000 })
  await page.locator('.head-actions .btn.btn-primary').click()
  const modal = page.locator('.modal-overlay').filter({ has: page.locator('h2', { hasText: /new reservation/i }) }).last()
  await expect(modal).toBeVisible({ timeout: 10_000 })

  // Availability is driven by Arrival + Number of days (Departure auto-fills),
  // so we drive the form the same way the UI expects and never guess at fields.
  await fillByLabel(modal, /arrival date/i, arrivalIso)
  await fillByLabel(modal, /number of days/i, String(nights))
  await page.waitForTimeout(200)
  await modal.locator('button', { hasText: /check availability/i }).click()
  const first = modal.locator('.room-card').first()
  await first.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {})
  if (!(await first.isVisible().catch(() => false))) return false
  await first.click()

  await fillByLabel(modal, /first name/i, 'PW')
  await fillByLabel(modal, /last name/i, last)
  await modal.locator('input[type="tel"]').first().fill('712345678')
  await pickOptionIn(page, modal, /booking type/i, /single/i)

  await modal.locator('button[type="submit"]').click()
  await expect(modal).toBeHidden({ timeout: 20_000 })
  await dismissAlerts(page)
  return true
}

export async function fillByLabel(modal, labelRe, value) {
  const group = modal.locator('.form-group').filter({ hasText: labelRe }).first()
  await group
    .locator('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], input[type="date"], textarea')
    .first()
    .fill(value)
}

export async function pickOptionIn(page, modal, labelRe, optionRe) {
  const group = modal.locator('.form-group').filter({ hasText: labelRe }).first()
  await expect(group.locator('.ss-trigger')).toBeVisible()
  await group.locator('.ss-trigger').click()
  await expect(page.locator('.ss-panel').first()).toBeVisible()
  await page.locator('.ss-panel [role="option"], .ss-panel li', { hasText: optionRe }).first().click()
  await page.waitForTimeout(250)
}

export async function openBookingModal(page) {
  await expect(
    page.locator('.sv-modal[role="dialog"]', { hasText: /new booking/i }).first(),
  ).toBeVisible({ timeout: 10_000 })
}

export async function fillNewBooking(page, opts) {
  const modal = page.locator('.sv-modal[role="dialog"]', { hasText: /new booking/i }).first()
  await expect(modal.locator('input[data-field="first_name"]')).toBeVisible()
  // The workflow document requires these fields on the NEW BOOKING tab.
  for (const field of [
    'first_name',
    'last_name',
    'company_name',
    'nationality',
    'id_type',
    'id_number',
    'advance_payment',
    'check_in_date',
    'check_out_date',
  ]) {
    await expect(modal.locator(`[data-field="${field}"]`).first()).toBeVisible()
  }
  await modal.locator('[data-field="first_name"]').fill(opts.first || 'PW')
  await modal.locator('[data-field="last_name"]').fill(opts.last)
  await modal.locator('[data-field="company_name"]').fill(opts.company || 'MRK QA Ltd')
  await modal.locator('[data-field="nationality"]').fill(opts.nationality || 'Tanzanian')
  await modal.locator('[data-field="id_type"]').selectOption('national_id')
  await modal.locator('[data-field="id_number"]').fill(`ID-${opts.last}`)
  await modal.locator('input[type="tel"]').fill(opts.phone || '255712345678')
  // Stay dates default to the tapped day → tomorrow; override when asked.
  if (opts.checkIn) {
    await modal.locator('[data-field="check_in_date"]').fill(opts.checkIn)
  }
  if (opts.checkOut) {
    await modal.locator('[data-field="check_out_date"]').fill(opts.checkOut)
  }
  await modal.locator('[data-field="booking_type"]').selectOption(opts.bookingType || 'single')
  if (opts.advancePayment) {
    await modal.locator('[data-field="advance_payment"]').fill(String(opts.advancePayment))
    await modal.locator('[data-field="advance_payment_method"]').selectOption('cash')
  }
}

export async function submitNewBooking(page) {
  await page
    .locator('.sv-modal[role="dialog"] button.sv-modal-manage', { hasText: /create booking/i })
    .last()
    .click()
  await expect(
    page.locator('.sv-modal[role="dialog"]', { hasText: /new booking/i }),
  ).toBeHidden({ timeout: 45_000 })
}

/**
 * Book a stay today→tomorrow (or with the given window), check it in and wait
 * for the green in-house bar. Returns nothing; the guest is checked in.
 */
export async function bookAndCheckIn(page, last, opts = {}) {
  await openBoard(page)
  const nights = opts.nights ?? 1
  await tapVacantToday(page, { checkOut: isoDate(nights) })
  await openBookingModal(page)
  await fillNewBooking(page, { last, checkOut: isoDate(nights), ...opts })
  await submitNewBooking(page)

  let modal = await openStay(page, last)
  await modal.locator('.sv-modal-manage', { hasText: /check in/i }).click()
  await expect(page.locator('.sv-modal.sv-modal-tabs[role="dialog"]')).toBeHidden({ timeout: 30_000 })
  await closeStay(page).catch(() => {})
  await waitForBarClass(page, last, 'bar-green')
}

export async function barFor(page, last) {
  const bar = page.locator('.sv-bar', { hasText: last.toUpperCase() }).first()
  await expect(bar, `board bar for ${last}`).toBeVisible({ timeout: 15_000 })
  return bar
}

export async function openStay(page, last) {
  await dismissAlerts(page)
  const bar = await barFor(page, last)
  await bar.click()
  const modal = page.locator('.sv-modal.sv-modal-tabs[role="dialog"]', { hasText: last.toUpperCase() }).first()
  await expect(modal).toBeVisible({ timeout: 10_000 })
  return modal
}

export async function closeStay(page) {
  const closeBtn = page.locator('.sv-modal.sv-modal-tabs .sv-modal-close').first()
  if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closeBtn.click({ timeout: 5_000 }).catch(() => {})
  }
  await expect(page.locator('.sv-modal.sv-modal-tabs[role="dialog"]')).toBeHidden({ timeout: 10_000 }).catch(() => {})
}

/** Switch the stay modal to the Room Charges tab (real per-night totals). */
export async function openStayCharges(page, modal) {
  await modal.locator('.sv-tab', { hasText: /room charges/i }).click()
  await expect(modal.locator('.sv-tab.active', { hasText: /room charges/i })).toBeVisible()
}

/** Click an entry in the stay-modal "More" dropdown by label. */
export async function moreAction(page, modal, labelRe) {
  await modal.locator('.sv-dropdown > button').first().click()
  const menu = page.locator('.sv-dropdown-menu')
  await expect(menu).toBeVisible()
  await menu.locator('button', { hasText: labelRe }).first().click()
  await expect(menu).toBeHidden().catch(() => {})
}

export async function waitForBarClass(page, last, cls) {
  await expect
    .poll(async () => {
      const bar = page.locator('.sv-bar', { hasText: last.toUpperCase() }).first()
      const c = await bar.getAttribute('class').catch(() => '')
      return c.includes(cls)
    }, { timeout: 20_000 })
    .toBe(true)
}

export async function folioCard(page, modal, labelRe) {
  // The balance cards render immediately as 0.00 until the folio payload lands
  // (they sit above the v-else-if="folio" ledger table). Wait for the loaded
  // table first so the figure read is the real balance, not the loading state.
  await expect(modal.locator('.sv-folio-table').first()).toBeVisible({ timeout: 15_000 })
  const card = modal.locator('.sv-panel-card').filter({ hasText: labelRe }).first()
  await expect(card).toBeVisible()
  return card.locator('strong').last().innerText()
}

export async function folioChargeRows(page, modal) {
  await expect(modal.locator('.sv-folio-table').first()).toBeVisible({ timeout: 10_000 })
  return modal.locator('.sv-folio-table tbody tr', { hasText: /room charge/i })
}

/** Locate one ledger row in the stay modal by description fragment. */
export async function folioRow(modal, descRe) {
  const row = modal.locator('.sv-folio-table tbody tr').filter({ hasText: descRe }).first()
  await expect(row).toBeVisible()
  return row
}

export function tzs(text) {
  return Number(String(text).replace(/[^0-9.-]/g, ''))
}