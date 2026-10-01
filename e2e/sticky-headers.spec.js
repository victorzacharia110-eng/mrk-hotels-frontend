import { test, expect } from '@playwright/test'

/**
 * Sticky table guards.
 *
 * Two bugs lived here, and both were invisible to the unit suite because
 * jsdom resolves no layout:
 *
 *   1. `.table` rounds its corners with `overflow: hidden`, which quietly makes
 *      every table a scroll container in its own right. A sticky header inside
 *      one pins to the table's own top edge and rides away with the rows, so the
 *      sticky rule is present, correct, and does nothing. Measured, the header
 *      drifted -700px.
 *   2. The stop-sell calendar let the day header scroll away, so you could see
 *      that a room was stopped but not on which night.
 *
 * The unit tests assert the CSS that fixes both. These assert that the header is
 * still on screen, which is the thing that actually matters to the person using
 * it. A rule can be present and correct and still not work; only a rendered page
 * can tell you that, so the check lives here.
 */

const TABLES = [
  { path: '/app/rooms', label: 'rooms', wrapper: '.table-scroll.is-pinned' },
  { path: '/app/reservations', label: 'reservations', wrapper: '.table-scroll.is-pinned' },
]

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app/)
})

/**
 * Scrolls the grid down and reports where the header and the pinned edge
 * columns ended up relative to the box they are pinned inside.
 */
async function geometry(page, wrapper) {
  // Guard: never measure layout before the sticky rules are live. The dev server
  // (the default `webServer` here) streams CSS as separate modules, so `load` can
  // fire while the rules are still in flight and a correct column reads as
  // unpinned. Waiting keeps every assertion below about rendered layout.
  await page.waitForFunction(
    (sel) => {
      const box = document.querySelector(sel)
      const table = box?.querySelector('table')
      const actions = table?.querySelector('tbody tr .actions-col')
      const corner = table?.querySelector('thead th.pin-col')
      return (
        !!actions &&
        !!corner &&
        getComputedStyle(actions).position === 'sticky' &&
        getComputedStyle(corner).position === 'sticky'
      )
    },
    wrapper,
    { timeout: 10_000 },
  )

  return page.evaluate((sel) => {
    const box = document.querySelector(sel)
    if (!box) return { error: `no ${sel} on this page` }
    const table = box.querySelector('table')

    // Pin by class, not by position. Rooms leads with a bulk-select checkbox
    // column, so `td:first-child` there is the checkbox and the identity column
    // is the second one — asserting on position passed the wrong column.
    const pin = table.querySelector('tbody tr .pin-col')
    const actions = table.querySelector('tbody tr .actions-col')
    const corner = table.querySelector('thead th.pin-col')
    const midHead = table.querySelector('thead th:not(.pin-col):not(.actions-col)')
    if (!pin || !actions || !corner) return { error: 'pinned columns not found' }

    box.scrollTop = 400
    box.scrollLeft = 300
    // Two frames: layout, then the settled position after the scroll.
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const boxRect = box.getBoundingClientRect()
          const pinRect = pin.getBoundingClientRect()
          const actRect = actions.getBoundingClientRect()
          const cornerRect = corner.getBoundingClientRect()
          const midRect = midHead.getBoundingClientRect()

          // Compare against the scrollport, not the border box. The border box
          // returned by getBoundingClientRect() includes the scrollbar, and these
          // grids are tall enough to always have a vertical one. A `right: 0`
          // sticky cell lines up with the *content* edge, so measuring against
          // `boxRect.right` reads a full scrollbar width of "not pinned" on a
          // column that is pinned perfectly. That made this test fail for the
          // wrong reason on any platform with classic scrollbars.
          const viewLeft = boxRect.left + box.clientLeft
          const viewTop = boxRect.top + box.clientTop
          const viewRight = viewLeft + box.clientWidth
          const viewBottom = viewTop + box.clientHeight

          resolve({
            scrolledVertically: box.scrollTop > 0,
            scrolledHorizontally: box.scrollLeft > 0,
            // Sticky on both axes at once: the corner sits at the top-left of the
            // grid no matter which way the table was scrolled.
            cornerAtTopLeft:
              Math.abs(cornerRect.top - viewTop) < 3 &&
              Math.abs(cornerRect.left - viewLeft) < 3,
            cornerVisible: cornerRect.bottom > viewTop && cornerRect.top < viewBottom,
            midHeaderVisible: midRect.bottom > viewTop && midRect.top < viewBottom,
            firstColumnPinnedLeft: Math.abs(pinRect.left - viewLeft) < 3,
            lastColumnPinnedRight: Math.abs(actRect.right - viewRight) < 3,
            cornerAboveBody: Number(getComputedStyle(corner).zIndex) >= 4,
          })
        })
      })
    })
  }, wrapper)
}

// The vertical cap on `.is-pinned` lives in a `max-width: 900px` media query, so
// the header only has to survive on the narrow screens where the report came
// from. At desktop width the grid grows to fit and there is nothing to scroll —
// asserting there would pass for the wrong reason.
const PHONE = { width: 390, height: 844 }

for (const { path, label, wrapper } of TABLES) {
  test(`${label}: the header and the pinned columns survive scrolling on a phone`, async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(path)
    await expect(page.locator(`${wrapper} table`)).toBeVisible()
    // Rows per page is not forced by the test; make sure enough rendered for the
    // grid to overflow its capped height before asserting anything about scroll.
    await page.waitForTimeout(400)

    const g = await geometry(page, wrapper)
    expect(g.error, `expected ${wrapper} on ${path}`).toBeUndefined()
    expect(g.scrolledVertically, `${label} table is not tall enough to test`).toBe(true)
    expect(g.scrolledHorizontally, `${label} table is not wide enough to test`).toBe(true)
    expect(g.cornerVisible, `${label}: header scrolled out of view`).toBe(true)
    expect(g.midHeaderVisible, `${label}: a column header scrolled out of view`).toBe(true)
    expect(g.cornerAtTopLeft, `${label}: header is not pinned to the top-left of the grid`).toBe(true)
    expect(g.firstColumnPinnedLeft, `${label}: identity column is not pinned`).toBe(true)
    expect(g.lastColumnPinnedRight, `${label}: actions column is not pinned`).toBe(true)
    expect(g.cornerAboveBody, `${label}: rows are drawing over the header`).toBe(true)
  })
}

test('stop-sell calendar: the day header stays put when you scroll to lower rooms', async ({ page }) => {
  // The reported symptom: reaching the rooms further down scrolled the dates off
  // the top, so a stopped room could be seen but not read.
  await page.setViewportSize(PHONE)
  await page.goto('/app/rooms')
  await expect(page.locator('.tab', { hasText: /stop.?sell/i }).first()).toBeVisible()
  await page.locator('.tab', { hasText: /stop.?sell/i }).first().click()
  await expect(page.locator('.stop-sell-calendar')).toBeVisible({ timeout: 15_000 })

  // Widen the window so there is plenty to scroll both ways.
  const today = new Date()
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const from = page.locator('input[type="date"]').first()
  const to = page.locator('input[type="date"]').nth(1)
  await from.fill(iso(today))
  await to.fill(iso(new Date(today.getTime() + 41 * 86_400_000)))
  await from.press('Enter')
  await page.waitForTimeout(900)

  const g = await page.evaluate(() => {
    const box = document.querySelector('.table-scroll.cal-scroll')
    if (!box) return { error: 'calendar did not render' }
    const table = box.querySelector('table')
    const head = table.querySelector('thead th:nth-child(2)')

    box.scrollTop = 500
    const boxRect = box.getBoundingClientRect()
    // Same scrollport reasoning as `geometry()`: the border box includes the
    // vertical scrollbar, a sticky cell lines up with the content edge.
    const viewLeft = boxRect.left + box.clientLeft
    const viewTop = boxRect.top + box.clientTop
    const headRect = head.getBoundingClientRect()
    const roomCell = table.querySelector('tbody tr td.cal-room-col').getBoundingClientRect()
    const rows = table.querySelectorAll('tbody tr').length

    return {
      rows,
      scrolledVertically: box.scrollTop > 0,
      headerVisible: headRect.bottom > viewTop && headRect.top < viewTop + box.clientHeight,
      headerAtTopOfBox: Math.abs(headRect.top - viewTop) < 3,
      roomColumnPinnedLeft: Math.abs(roomCell.left - viewLeft) < 3,
    }
  })

  expect(g.error).toBeUndefined()
  expect(g.rows, 'not enough rooms to scroll the calendar').toBeGreaterThan(10)
  expect(g.scrolledVertically, 'calendar did not scroll vertically').toBe(true)
  expect(g.headerVisible, 'the dates scrolled off the top; a stopped room cannot be read').toBe(true)
  expect(g.headerAtTopOfBox, 'the day header is not pinned').toBe(true)
  expect(g.roomColumnPinnedLeft, 'the room column is not pinned').toBe(true)
})

test('the page action row keeps its last button on a phone', async ({ page }) => {
  // The export button was last in a nowrap flex row and `html` clips horizontal
  // overflow, so at 360px it was neither on screen nor scrollable to.
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/app/rooms')
  await expect(page.locator('.head-actions .btn').first()).toBeVisible()

  const rows = await page.evaluate(() => {
    const head = document.querySelector('.head-actions')
    const btns = [...head.querySelectorAll('.btn')]
    const lines = new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)))
    return {
      count: btns.length,
      rows: lines.size,
      offscreen: btns
        .filter((b) => b.getBoundingClientRect().right > window.innerWidth)
        .map((b) => b.textContent.trim()),
      wraps: getComputedStyle(head).flexWrap,
    }
  })

  expect(rows.wraps, 'the action row cannot wrap, so the last button is lost').toBe('wrap')
  expect(rows.offscreen, `buttons pushed off screen: ${rows.offscreen.join(', ')}`).toEqual([])
  // Wrapping onto a second line is the intended escape, not a squeeze.
  expect(rows.rows).toBeGreaterThanOrEqual(1)
})
