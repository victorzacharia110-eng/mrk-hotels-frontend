import { test, expect } from '@playwright/test'

/**
 * Mobile horizontal-overflow guard: at a 375px viewport the page itself must
 * never scroll horizontally — only tables inside .table-scroll wrappers may.
 */

const APP_PAGES = [
  '/app',
  '/app/overview',
  '/app/reservations',
  '/app/staff',
  '/app/laundry',
  '/app/messages',
]

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)
})

for (const path of APP_PAGES) {
  test(`no page-level horizontal scroll on mobile: ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()

    const result = page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const inScroller = (el) => {
        let p = el.parentElement
        while (p) {
          const o = getComputedStyle(p).overflowX
          if (o === 'auto' || o === 'scroll') return true
          p = p.parentElement
        }
        return false
      }
      const bad = []
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width && r.right > vw + 1 && !inScroller(el)) {
          bad.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0])
        }
      })
      return { scrollWidth: document.documentElement.scrollWidth, vw, bad: [...new Set(bad)].slice(0, 5) }
    })

    const r = await result
    expect(r.scrollWidth, `page scrolls horizontally; offenders: ${r.bad.join(', ')}`).toBeLessThanOrEqual(r.vw + 1)
  })
}

test('public pages have no horizontal scroll on mobile', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()
  const vw = await page.evaluate(() => document.documentElement.clientWidth)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(sw).toBeLessThanOrEqual(vw + 1)
})

test('tables scroll inside their wrapper, not the page', async ({ page }) => {
  await page.goto('/app/reservations')
  await expect(page.locator('.table-scroll table')).toBeVisible()
  const check = await page.evaluate(() => {
    const w = document.querySelector('.table-scroll')
    if (!w || !w.querySelector('table')) return null
    w.scrollLeft = 150
    return { scrolled: w.scrollLeft, pageX: window.scrollX }
  })
  expect(check, 'reservations table is inside a .table-scroll wrapper').not.toBeNull()
  expect(check.scrolled).toBeGreaterThan(0)
  expect(check.pageX).toBe(0)
})
