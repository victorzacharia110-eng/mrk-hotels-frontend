import { test, expect } from '@playwright/test'
import { signIn, API } from './helpers'

/** Verifies the "Record goods received" (GRN) form can load a PO's items and
 *  save. Builds an approved purchase order through the API, then drives the
 *  store-manager /store-manager/goods-received UI as the inventory manager. */
test('store goods-received: record GRN against an approved PO', async ({ page, request }) => {
  async function api(role, method, path, data) {
    const login = await request.post(`${API}/v1/auth/login`, { data: { email: role.email, password: 'password' } })
    expect(login.ok()).toBeTruthy()
    const { token } = await login.json()
    const headers = { Authorization: `Bearer ${token}` }
    const res = await request[method](`${API}${path}`, { data, headers })
    expect(res.ok()).toBeTruthy()
    return res.json()
  }

  // 1. Seed a supplier (procurement, level 50).
  const supplierName = `E2E GRN Supplier ${Date.now()}`
  const p = await api({ email: 'procurement@mrkhotels.test' }, 'post', '/v1/suppliers', {
    supplier_name: supplierName,
    category: 'food_beverage',
    status: 'active',
  })
  const supplierId = p.supplier.supplier_id

  // 2. Create a purchase order (procurement) with one line item.
  const itemName = `E2E Item ${Date.now()}`
  const poRes = await api({ email: 'procurement@mrkhotels.test' }, 'post', '/v1/purchase-orders', {
    supplier_id: supplierId,
    items: [{ item_name: itemName, quantity: 10, unit: 'kg', unit_price: 50 }],
  })
  const poId = poRes.purchase_order.po_id
  const poNumber = poRes.purchase_order.po_number

  // 3. Manager approval (level 80) then finance approval (level 70).
  await api({ email: 'manager@mrkhotels.test' }, 'post', `/v1/purchase-orders/${poId}/manager-approve`)
  await api({ email: 'accountant@mrkhotels.test' }, 'post', `/v1/purchase-orders/${poId}/approve`)

  // 4. Drive the UI as the inventory manager.
  await signIn(page, { email: 'store' })
  await page.goto('/store-manager/goods-received')
  await expect(page.locator('.sm-layout')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /record goods received/i }).click()

  // 5. Pick the approved PO from the form's select (match by value = po_id).
  const poSelect = page.locator('.sm-modal select').first()
  await poSelect.selectOption(poId)

  // 6. Items from the PO must be loaded (the fixed loadPoItems path).
  const itemRow = page.locator('.sm-modal table').filter({ hasText: itemName })
  await expect(itemRow).toBeVisible({ timeout: 5000 })

  // 7. Save button must be enabled (items.length > 0).
  const saveBtn = page.locator('.sm-modal button[type="submit"]')
  await expect(saveBtn).toBeEnabled()

  // 8. Submit and confirm a GRN is created and appears in the list.
  await saveBtn.click()
  await expect(page.locator('.sm-modal')).not.toBeVisible({ timeout: 8000 })
  await expect(page.locator('.sm-table').filter({ hasText: supplierName })).toBeVisible({ timeout: 8000 })
})
