import { test, expect } from '@playwright/test'

test('admin can sign in and reach the hotel app dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.store-layout')).toBeVisible()
  await expect(page.locator('.hotel-grid')).toBeVisible()

  await page.getByRole('link', { name: /sign in/i }).first().click()
  await expect(page).toHaveURL(/\/login$/)

  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)

  // The app dashboard renders the rooms board with live occupancy counts.
  await expect(page.locator('.store-layout')).toBeVisible()
  await expect(page.locator('body')).toContainText('Occupied', { timeout: 15_000 })
})