import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

/**
 * Bulk multi-select + typed-confirm delete on the Rooms table.
 * Selects all rows via the header checkbox, then confirms the modal requires
 * typing DELETE before the delete button becomes enabled.
 */
test('rooms bulk select-all opens typed-confirm delete modal', async ({ page }) => {
  await signIn(page, { email: 'admin' })
  await expect(page).toHaveURL(/\/app/, { timeout: 15000 })

  await page.goto('/app/rooms')
  await expect(page).toHaveURL(/\/app\/rooms/)
  await expect(page.locator('table thead tr')).toBeVisible({ timeout: 15000 })

  const headerCheckbox = page.locator('table thead input[type="checkbox"]').first()
  await expect(headerCheckbox).toBeVisible({ timeout: 15000 })
  await headerCheckbox.check()
  await expect(page.getByRole('button', { name: /delete selected/i })).toBeVisible()

  await page.getByRole('button', { name: /delete selected/i }).click()
  await expect(page.getByText(/permanently delete/i)).toBeVisible()

  const confirmBtn = page.getByRole('button', { name: /^delete selected$/i }).last()
  await expect(confirmBtn).toBeDisabled()
  await page.locator('.del-confirm-input').fill('delete')
  await expect(confirmBtn).toBeDisabled()
  await page.locator('.del-confirm-input').fill('DELETE')
  await expect(confirmBtn).toBeEnabled()
})