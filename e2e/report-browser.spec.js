import { test, expect } from '@playwright/test'

test('report browser renders night audit pilot with real data', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)

  await page.goto('/app/reports')
  await expect(page).toHaveURL(/\/app\/reports$/)

  // Left sidebar with collapsible categories
  await expect(page.locator('.rb-tree')).toBeVisible()
  await expect(page.locator('.rb-cat').first()).toContainText('Reservation Report')
  await expect(page.locator('.rb-cat').nth(1)).toContainText('Front Office Report')

  // Night audit is the active pilot by default
  await expect(page.locator('.rb-report.active')).toContainText('Night Audit')

  // Toolbar has the as-on-date + currency + report-template controls
  await expect(page.locator('.rb-toolbar input[type="date"]')).toBeVisible()
  await expect(page.locator('.rb-toolbar select')).toHaveCount(2)

  // Report table renders (revenue rows)
  await expect(page.locator('.rb-table').first()).toContainText('Total Revenue')

  // Selecting the wired guest-list pilot renders its form + live data table
  await page.locator('.rb-report', { hasText: 'Guest List' }).click()
  await expect(page.locator('.rb-toolbar')).toContainText('Stay date')
  await expect(page.locator('.rb-help')).toContainText('Help Guide')
  await expect(page.locator('.rb-table').first()).toContainText('Guest Name')
  await expect(page.locator('.rb-report-card')).toContainText('rows returned')

  // A genuinely unwired report still shows its filter form + help + placeholder
  await page.locator('.rb-report', { hasText: 'Departure List' }).click()
  await expect(page.locator('.rb-toolbar')).toContainText('Room Type')
  await expect(page.locator('.rb-placeholder')).toContainText('not connected')
})
