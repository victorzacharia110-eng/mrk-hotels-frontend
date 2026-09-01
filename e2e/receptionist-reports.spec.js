import { test, expect } from '@playwright/test'

test('receptionist sees report browser in staff drawer and loads night audit pilot', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('reception@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)

  // The dashboard can surface urgent-notification modals (multiple can queue)
  // that cover the drawer and block clicks. Dismiss any that appear.
  for (let i = 0; i < 5; i++) {
    const close = page.locator('.alert-modal-close')
    if (!(await close.isVisible().catch(() => false))) break
    await close.click()
    await page.waitForTimeout(300)
  }

  // Staff drawer (sliding sidebar) holds the module links, grouped in accordions.
  await page.locator('.side-hamburger').click()
  await expect(page.locator('#staff-drawer')).toBeVisible()
  // Reports lives inside the (collapsed) Administration accordion group.
  await page.locator('.drawer-acc-head', { hasText: /administration/i }).first().click()
  await expect(page.locator('#staff-drawer')).toContainText('Reports')
  await page.locator('#staff-drawer a[href="/app/reports"]').click()

  await expect(page).toHaveURL(/\/app\/reports$/)
  await expect(page.locator('.rb-tree')).toBeVisible()
  await expect(page.locator('.rb-report.active')).toContainText('Night Audit')
  await expect(page.locator('.rb-table').first()).toContainText('Total Revenue')

  // Help guide is shown for the pilot.
  await expect(page.locator('.rb-help')).toContainText('Help Guide')

  // The wired guest-list pilot shows its form + live data table.
  await page.locator('.rb-report', { hasText: 'Guest List' }).click()
  await expect(page.locator('.rb-toolbar input[type="date"]').first()).toBeVisible()
  await expect(page.locator('.rb-toolbar')).toContainText('Stay date')
  await expect(page.locator('.rb-help')).toContainText('Help Guide')
  await expect(page.locator('.rb-table').first()).toContainText('Guest Name')
})
