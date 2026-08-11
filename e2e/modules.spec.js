import { test, expect } from '@playwright/test'

const MODULES = [
  { path: '/app/rooms', heading: 'Rooms' },
  { path: '/app/guests', heading: 'Guests' },
  { path: '/app/reservations', heading: 'Reservations' },
  { path: '/app/housekeeping', heading: 'Housekeeping' },
  { path: '/app/booking-requisitions', heading: 'Booking Requests' },
  { path: '/app/payments', heading: 'Payments' },
  { path: '/app/menu', heading: 'Menu Items' },
  { path: '/app/orders', heading: 'F&B Orders' },
  { path: '/app/inventory', heading: 'Inventory' },
  { path: '/app/suppliers', heading: 'Suppliers' },
  { path: '/app/requisitions', heading: 'Purchase Requisitions' },
  { path: '/app/purchase-orders', heading: 'Purchase Orders' },
  { path: '/app/goods-received', heading: 'Goods Received Notes' },
  { path: '/app/staff', heading: 'Staff Management' },
  { path: '/app/reports', heading: 'Reports' },
]

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await expect(page.locator('input[type="password"]')).toHaveValue('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app$/)
})

for (const mod of MODULES) {
  test(`module page renders: ${mod.path}`, async ({ page }) => {
    await page.goto(mod.path)
    await expect(page).toHaveURL(new RegExp(mod.path.replace('/', '\\/') + '$'))
    await expect(page.locator('.page-head h1, h1')).toContainText(mod.heading)
    await expect(page.locator('.alert-error')).toHaveCount(0)
  })
}

test('rooms module can create a room', async ({ page }) => {
  const roomNumber = '9' + Date.now().toString().slice(-4)
  await page.goto('/app/rooms')
  await page.getByRole('button', { name: /new room/i }).click()
  await expect(page.locator('.modal-head h2')).toContainText('New Room')
  await page.locator('.modal input').first().fill(roomNumber)
  await page.locator('.modal input[type="number"]').nth(1).fill('150000')
  await page.getByRole('button', { name: /save room/i }).click()
  await expect(page.locator('.alert-success')).toBeVisible()
  await expect(page.locator('table')).toContainText(roomNumber)
})

test('menu module can create a menu item', async ({ page }) => {
  const itemName = 'Smoke ' + Date.now()
  await page.goto('/app/menu')
  await page.getByRole('button', { name: /new item/i }).click()
  await expect(page.locator('.modal-head h2')).toContainText('New Item')
  await page.locator('.modal input').first().fill(itemName)
  await page.locator('.modal input[type="number"]').first().fill('5000')
  await page.getByRole('button', { name: /save item/i }).click()
  await expect(page.locator('.alert-success')).toBeVisible()
  await expect(page.locator('table')).toContainText(itemName)
})
