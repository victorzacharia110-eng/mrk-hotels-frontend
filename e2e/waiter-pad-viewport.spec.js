import { test, expect } from '@playwright/test'

/**
 * The pad has to fit the window it is given.
 *
 * The waiter pad locks itself to a fixed height and scrolls its food list
 * inside, so the page never scrolls. That only works if the locked height is the
 * height the pad is actually given. It was asking for `100vh` inside an app
 * shell that is itself `100vh` with a header above the content area, so the pad
 * overran its container by the height of that header — and because the overflow
 * was hidden and nothing could scroll to it, the Send order button sat below the
 * bottom of the window and could not be clicked at all. A waiter could build an
 * order and be unable to send it.
 *
 * These run at ordinary laptop sizes, which is where the header eats the most.
 */

const LAPTOPS = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
]

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app/)
})

for (const size of LAPTOPS) {
  test(`the pad fits the window and Send order stays clickable at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto('/app/take-order')
    await expect(page.locator('.cat-rail')).toBeVisible({ timeout: 20_000 })
    await page.locator('.cat-rail .cat-btn').first().click()
    await expect(page.locator('.inline-items')).toBeVisible()

    const m = await page.evaluate(() => {
      const send = document.querySelector('.send-btn')
      const page_ = document.querySelector('.taker-page')
      const sr = send?.getBoundingClientRect()
      // What actually receives a click at the button's centre is the real proof:
      // an element can be inside the viewport and still sit under an overlay.
      const hit = sr
        ? document.elementFromPoint(
            Math.min(sr.left + sr.width / 2, window.innerWidth - 1),
            Math.min(sr.top + sr.height / 2, window.innerHeight - 1),
          )
        : null
      return {
        vh: window.innerHeight,
        pageBottom: Math.round(page_.getBoundingClientRect().bottom),
        pageOverflows: Math.round(page_.getBoundingClientRect().bottom) > window.innerHeight + 1,
        sendPresent: !!send,
        sendBottom: sr ? Math.round(sr.bottom) : null,
        sendBelowFold: sr ? sr.bottom > window.innerHeight : null,
        sendClickable: hit ? send.contains(hit) || hit === send : false,
      }
    })

    expect(m.sendPresent, 'the pad must offer a way to send the order').toBe(true)
    expect(m.pageOverflows, 'the locked pad is taller than the window').toBe(false)
    expect(m.sendBelowFold, `Send order is ${m.sendBottom - m.vh}px below the fold`).toBe(false)
    expect(m.sendClickable, 'Send order cannot be clicked').toBe(true)
  })
}
