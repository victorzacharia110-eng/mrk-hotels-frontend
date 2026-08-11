import { test, expect } from '@playwright/test'

test('admin can sign in and see the hotel app shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Find Your Perfect Stay')
  await expect(page.locator('.main-nav')).toContainText('Book a Stay')

  await page.getByRole('link', { name: /sign in/i }).first().click()
  await expect(page).toHaveURL(/\/login$/)

  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.locator('.dash-header h1')).toContainText('Welcome')
  await expect(page.locator('.main-nav')).toContainText('Reservations')
  await expect(page.locator('.main-nav')).toContainText('Reports')

  await page.getByRole('link', { name: /my profile/i }).first().click()
  await expect(page).toHaveURL(/\/app\/profile$/)
})
