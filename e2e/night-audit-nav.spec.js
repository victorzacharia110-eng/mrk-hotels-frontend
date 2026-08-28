import { test, expect } from '@playwright/test'

test('receptionist uses the night audit accordion: run, insert transaction, and log', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('reception@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)

  // Open the staff drawer and expand the Night Audit accordion group.
  await page.locator('.side-hamburger').click()
  await expect(page.locator('#staff-drawer')).toBeVisible()
  await page.locator('#staff-drawer .drawer-acc-head', { hasText: 'Night Audit' }).click()

  // The three sub-actions should now be visible.
  await expect(page.locator('#staff-drawer a[href="/app/night-audit"]')).toContainText('Run Night Audit')
  await expect(page.locator('#staff-drawer a[href="/app/night-audit/transactions"]')).toContainText('Insert Transaction')
  await expect(page.locator('#staff-drawer a[href="/app/night-audit/logs"]')).toContainText('Night Audit Log')

  // Insert Transaction page renders the form with billing summary.
  await page.locator('#staff-drawer a[href="/app/night-audit/transactions"]').click()
  await expect(page).toHaveURL(/\/app\/night-audit\/transactions$/)
  await expect(page.locator('h1')).toContainText('Insert Transaction')
  await expect(page.locator('input[type="date"]')).toBeVisible()

  // Night Audit Log page renders the audit trail table.
  await page.locator('.side-hamburger').click()
  await page.locator('#staff-drawer a[href="/app/night-audit/logs"]').click()
  await expect(page).toHaveURL(/\/app\/night-audit\/logs$/)
  await expect(page.locator('h1')).toContainText('Night Audit Log')

  // Run Night Audit page still works (the classic KPI day-close).
  await page.locator('.side-hamburger').click()
  await page.locator('#staff-drawer a[href="/app/night-audit"]').click()
  await expect(page).toHaveURL(/\/app\/night-audit$/)
  await expect(page.locator('h1')).toContainText('Night Audit')
  await expect(page.locator('.kpi-grid').first()).toBeVisible()

  // Close Business Day opens our custom animated modal (not a native alert).
  await page.getByRole('button', { name: /close business day/i }).click()
  const modal = page.locator('.confirm-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Are you sure you want to close this business day?')
  await modal.locator('.confirm-modal-foot .btn-secondary').click()
  await expect(modal).toBeHidden()
})
