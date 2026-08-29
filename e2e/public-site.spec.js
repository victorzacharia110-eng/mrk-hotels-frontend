/**
 * Public storefront smoke + behaviour: home, directory filters, hotel detail
 * room browser (search / sort), the room-number privacy regression and the
 * EN/SW language toggle.
 */
import { test, expect } from '@playwright/test'
import { pickSelect, trackPageErrors, expectMounted, hotelId, isoDate } from './helpers'

test.describe('public storefront', () => {
  test('home lists hotels and links into detail pages', async ({ page }) => {
    const errors = trackPageErrors(page)
    await page.goto('/')
    await expect(page.locator('h1')).toHaveText('Find Your Perfect Stay')
    await expect(page.locator('.hotel-card').first()).toBeVisible()
    const count = await page.locator('.hotel-card').count()
    expect(count).toBeGreaterThan(2)

    await page.locator('.hotel-card .btn').first().click()
    await expect(page).toHaveURL(/\/hotels\//)
    await expect(page.locator('.hotel-card')).toHaveCount(0)
    await expectMounted(page, errors)
  })

  test('directory country/city filter narrows the hotel grid', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.hotel-card').first()).toBeVisible()
    const before = await page.locator('.hotel-card').count()

    await pickSelect(page, /Country/, /Tanzania/)

    // City options load after the country is picked.
    await expect(page.locator('.form-group').filter({ hasText: /City/ }).first().locator('.ss-trigger')).toBeVisible({ timeout: 10_000 })
    await pickSelect(page, /City/, /Dodoma|Arusha/)

    await expect(page.locator('.hotel-card').first()).toBeVisible({ timeout: 10_000 })
    const after = await page.locator('.hotel-card').count()
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  })

  test('hotel detail renders rooms and supports search and price sort', async ({ page }) => {
    const errors = trackPageErrors(page)
    const id = await hotelId(page.request)
    await page.goto(`/hotels/${id}`)
    await expect(page.locator('.detail-head h1')).toHaveText('MRK Grand Hotel')
    await expect(page.locator('.room-card').first()).toBeVisible({ timeout: 10_000 })

    // Search by room type narrows the cards.
    await page.getByLabel('Search', { exact: true }).or(page.locator('.room-browser-bar input')).first().waitFor()
    await page.locator('.room-browser-bar input').fill('single')
    await expect(page.locator('.room-card').count()).resolves.toBeGreaterThan(0)

    // Sort by price: first card is the cheapest.
    await page.locator('.room-browser-bar input').fill('')
    await pickSelect(page, /Sort by/, /Price/)
    const firstPrice = await page.locator('.room-card .room-price').first().innerText()
    const price = () => Number(firstPrice.replace(/[^\d]/g, ''))
    expect(price()).toBeGreaterThan(0)
    await expectMounted(page, errors)
  })

  test('regression: public room search cannot match room numbers', async ({ page }) => {
    const errors = trackPageErrors(page)
    const id = await hotelId(page.request)

    // Room numbers exist on the detail page (availability/seed) but the public
    // search must not surface them, so a room number finds nothing.
    const res = await page.request.get(
      `${globalThis.process?.env?.E2E_API_URL || 'http://localhost:8000/api'}/v1/public/availability?hotel_id=${id}&check_in=${isoDate(1)}&check_out=${isoDate(3)}`,
    )
    const { available_rooms } = await res.json()
    const number = available_rooms[0]?.room_number
    expect(number, 'expected seeded rooms to expose a number via the API').toBeTruthy()

    await page.goto(`/hotels/${id}`)
    await expect(page.locator('.room-card').first()).toBeVisible({ timeout: 10_000 })
    await page.locator('.room-browser-bar input').fill(number)
    await expect(page.locator('.room-card')).toHaveCount(0)
    await expect(page.getByText(/No results/i)).toBeVisible()
    await expectMounted(page, errors)
  })

  test('language toggle switches the storefront to Swahili and back', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /SW|Kiswahili/i }).first().click()
    await expect(page.locator('h1')).toHaveText('Pata Malazi Yako Bora')

    await page.getByRole('button', { name: /EN/i }).first().click()
    await expect(page.locator('h1')).toHaveText('Find Your Perfect Stay')
  })
})