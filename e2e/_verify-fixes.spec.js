import { test, expect } from '@playwright/test'
import { signIn, trackPageErrors, API } from './helpers.js'

/**
 * Regression checks for the Cashier/Bar panel feedback round:
 *  - Day Close targets the previous ended business date (backend-computed),
 *    blocks the close while orders are running/unsettled, and hosts the
 *    Standard Time (timezone) editor.
 *  - Take Away and Delivery date pickers default to the F&B open business date.
 *
 * All business dates are read from the live API so the assertions survive
 * day rollovers instead of hardcoding a calendar day.
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

test.describe('PDF feedback fixes', () => {
  let dayClose

  test.beforeEach(async ({ page }) => {
    await signIn(page, { email: 'cashier' })
    await page.goto('/cashier/dine-in')
    await pickOutlet(page)
    dayClose = await page.evaluate(async (url) => {
      const token = sessionStorage.getItem('auth_token')
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      return res.json()
    }, `${API}/v1/fnb/day-close`)
  })

  test('Day Close offers the previous ended date, blocks the close while orders run, and shows Standard Time', async ({ page }) => {
    const errors = trackPageErrors(page)
    await page.goto('/cashier/day-close')
    await expect(page).toHaveURL(/\/cashier\/day-close$/, { timeout: 20_000 })
    const body = page.locator('body')
    await expect(body).toContainText('Date to close')
    await expect(body).toContainText('Open business day')
    await expect(body).toContainText('Running orders')
    await expect(body).toContainText('Unsettled orders')
    if (dayClose.close_date) {
      await expect(body).toContainText(new Date(`${dayClose.close_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }))
    }
    const btn = page.locator('button:has-text("Close This Day")').first()
    if (dayClose.can_close) {
      await expect(btn).toBeEnabled()
    } else {
      await expect(btn).toBeDisabled()
    }
    await expect(body).toContainText('Standard Time')
    await expect(page.locator('#dc-timezone')).toHaveValue(dayClose.timezone)
    expect(errors).toEqual([])
  })

  test('Take Away and Delivery date pickers default to the F&B open business date', async ({ page }) => {
    const errors = trackPageErrors(page)
    await page.goto('/cashier/take-away')
    await expect(page).toHaveURL(/\/cashier\/take-away$/, { timeout: 20_000 })
    await expect(page.locator('#ta-date')).toHaveValue(dayClose.open_date)
    await page.goto('/cashier/delivery')
    await expect(page).toHaveURL(/\/cashier\/delivery$/, { timeout: 20_000 })
    await expect(page.locator('#dl-date')).toHaveValue(dayClose.open_date)
    expect(errors).toEqual([])
  })

  test('Standard Time save persists the hotel timezone through the F&B endpoint and restores it', async ({ page }) => {
    const errors = trackPageErrors(page)
    await page.goto('/cashier/day-close')
    await expect(page).toHaveURL(/\/cashier\/day-close$/, { timeout: 20_000 })
    const tz = page.locator('#dc-timezone')
    await expect(tz).toHaveValue(dayClose.timezone)
    const changed = dayClose.timezone === 'Africa/Dar_es_Salaam' ? 'Africa/Nairobi' : 'Africa/Dar_es_Salaam'
    await tz.selectOption(changed)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('body')).toContainText('Standard time updated successfully.')
    await expect(tz).toHaveValue(changed)
    const persisted = await page.evaluate(async (url) => {
      const token = sessionStorage.getItem('auth_token')
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      return (await res.json()).timezone
    }, `${API}/v1/fnb/day-close`)
    expect(persisted).toBe(changed)
    await tz.selectOption(dayClose.timezone)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('body')).toContainText('Standard time updated successfully.')
    await expect(tz).toHaveValue(dayClose.timezone)
    expect(errors).toEqual([])
  })
})