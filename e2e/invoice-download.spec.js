import { test, expect } from '@playwright/test'

/**
 * Guest self-service invoice download on the public hotel directory page.
 * Runs against the live local API (localhost:8000) — the seeded reservation
 * BK-2026-0001 (guest phone +255683870268) must exist for the success test.
 */

test('directory page shows the invoice download card', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Download your invoice' })).toBeVisible()
  await expect(page.getByPlaceholder(/Booking reference/)).toBeVisible()
  await expect(page.getByPlaceholder(/Phone number/)).toBeVisible()
})

test('shows an error when no invoice matches the reference and phone', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder(/Booking reference/).fill('BK-2026-0001')
  await page.getByPlaceholder(/Phone number/).fill('0700000000')
  await page.getByRole('button', { name: 'Download invoice' }).click()
  await expect(page.locator('.alert-error')).toHaveText(
    'No invoice found for that booking reference and phone number.'
  )
})

test('downloads the invoice PDF for a matching reference and phone', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder(/Booking reference/).fill('BK-2026-0001')
  // Local phone format on purpose — the API matches by trailing digits.
  await page.getByPlaceholder(/Phone number/).fill('0683870268')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download invoice' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^INV-\d{4}-\d+\.pdf$/)
  await expect(page.locator('.alert-success')).toHaveText('Your invoice has been downloaded.')
})
