import { test, expect } from '@playwright/test'

/**
 * Session storage policy: the token lives in sessionStorage, so a page
 * refresh keeps the user signed in while a closed tab ends the session.
 * The idle watchdog must also re-arm on boot after a refresh.
 */

test('refreshing a signed-in page keeps the session', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)

  await expect
    .poll(() => page.evaluate(() => !!sessionStorage.getItem('auth_token')))
    .toBe(true)
  await expect(page.evaluate(() => localStorage.getItem('auth_token'))).resolves.toBeNull()

  await page.goto('/app/messages')
  await expect(page.locator('.dashboard-page')).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/app\/messages$/)
  await expect(page.locator('.dashboard-page')).toBeVisible()
})

test('closing the tab ends the session', async ({ page, context }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)

  // Closing the tab drops sessionStorage; a new tab must start signed out.
  await page.close()
  const newTab = await context.newPage()
  await newTab.goto('/app')
  await expect(newTab).toHaveURL(/\/login\?redirect=/)
  // sessionStorage should be cleared for the closed tab; ensure no auth token
  await expect(newTab.evaluate(() => sessionStorage.getItem('auth_token'))).resolves.toBeNull()
  await expect(newTab.evaluate(() => localStorage.getItem('auth_token'))).resolves.toBeNull()
})
