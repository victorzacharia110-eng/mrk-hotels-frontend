import { test, expect } from '@playwright/test'

test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('.mrk-layout')).toBeVisible()
  await expect(page.locator('.mrk-brand').first()).toContainText('MRK Hotel Software')
})
