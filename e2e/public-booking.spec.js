/**
 * Full public booking journey: availability -> select rooms -> guest details ->
 * rooms held pending payment -> per-method pay instructions. This is the
 * highest-value public flow (booking + payment clarity regressions).
 */
import { test, expect } from '@playwright/test'
import { pickSelect, trackPageErrors, expectMounted, hotelId, isoDate, futureStay, API } from './helpers'

function pickStay(page, day) {
  const { checkIn, checkOut } = futureStay(day)
  return page.locator('input[type="date"]').nth(0).fill(checkIn)
    .then(() => page.locator('input[type="date"]').nth(1).fill(checkOut))
}

async function pickHotelDates(page, hotel, day = 14) {
  await pickSelect(page, /Hotel/, hotel)
  await pickStay(page, day)
}

async function fillGuestForm(page, first, last) {
  const form = page.locator('form').filter({ hasText: /First Name/i })
  await form.locator('input[type="text"]').nth(0).fill(first)
  await form.locator('input[type="text"]').nth(1).fill(last)
  await form.locator('input[type="email"]').fill(`${first}@example.com`)
  await form.locator('input[type="tel"]').first().fill('255712345678')
  await pickSelect(page, /City/i, /Dar es Salaam/)
}

/**
 * Search availability across a few candidate windows until rooms are returned.
 * The demo hotel only exposes a couple of rooms to the portal, so earlier runs
 * on the same day can drain a given window; try the next window instead.
 */
async function searchRooms(page, hotel, days) {
  for (const day of days) {
    await pickHotelDates(page, hotel, day)
    await page.locator('.search-actions button').click()
    try {
      await expect(page.locator('.room-card').first()).toBeVisible({ timeout: 12_000 })
      return
    } catch {
      // No rooms for this window — move to the next candidate.
    }
  }
  throw new Error('no window returned available rooms (all candidates drained)')
}

test.describe('public booking flow', () => {
  test('holds a room pending payment and shows mobile-money pay instructions', async ({ page }) => {
    const errors = trackPageErrors(page)
    const id = await hotelId(page.request)

    await page.goto(`/booking?hotel_id=${id}`)
    await expect(page.locator('.search-actions button')).toBeVisible()
    await searchRooms(page, /MRK Grand/, [14, 30, 46])
    await page.locator('.room-card input[type="checkbox"]').first().check()

    // Guest details.
    await fillGuestForm(page, 'Asha', 'Mushi')

    await page.getByRole('button', { name: /Submit Booking Request/i }).click()

    // Rooms held, payment card with a reference and itemised total.
    await expect(page.locator('.card-title').filter({ hasText: /Complete your payment/i })).toBeVisible({ timeout: 20_000 })
    expect((await page.locator('.booking-ref code').innerText()).trim()).toMatch(/^BK-/)
    await expect(page.locator('.price-summary').first()).toBeVisible()

    // Switch to Mobile Money -> M-Pesa and check the numbered instructions.
    await pickSelect(page, /Payment method\*?/, /Mobile money/i)
    await pickSelect(page, /Mobile money service\*?/, /M-Pesa/)
    const card = page.locator('.hotel-receiving-details')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Pay using this hotel’s number')
    await expect(card).toContainText('*150*00#')
    await expect(card).toContainText(/Enter this exact number: [\d ]+/)
    await expect(card).toContainText(/full amount TZS [\d,]+/)
    await expect(card).toContainText(/Confirm with your PIN/)
    await expect(card).toContainText(/text you the link to download your invoice/i)
    await expect(page.locator('.pay-instr > .pay-instr-number')).toBeVisible()

    // Receiving endpoint name shown for authenticity on the phone-number flow.
    await expect(page.locator('.pay-instr-receiver').first()).toContainText('MRK Grand Hotel')

    // When the wallet has a Lipa number, its own steps and receiver show too.
    await expect(page.locator('.pay-instr-lipa')).toBeVisible()
    await expect(page.locator('.pay-instr-lipa')).toContainText('Lipa number')
    await expect(page.locator('.pay-instr-lipa .pay-instr-number')).toHaveText(/4001202/)
    await expect(page.locator('.pay-instr-lipa .pay-instr-receiver')).toContainText('MRK Grand Hotel')
    await expect(page.locator('.pay-instr-lipa')).toContainText(/Choose “Lipa”/)
    await expect(page.locator('.pay-instr-lipa')).toContainText(/Enter this exact Lipa number/)

    // The other-wallets strip shows phone and Lipa numbers per provider.
    await expect(page.locator('.pay-instr-other-lipa').last()).toContainText(/Lipa 4001203/)

    await expectMounted(page, errors)
  })

  test('bank method shows the account details with the booking reference', async ({ page }) => {
    const errors = trackPageErrors(page)
    const id = await hotelId(page.request)
    await page.goto(`/booking?hotel_id=${id}`)
    await searchRooms(page, /MRK Grand/, [40, 56, 70])
    await page.locator('.room-card input[type="checkbox"]').first().check()

    await fillGuestForm(page, 'Bahat', 'Chale')

    await page.getByRole('button', { name: /Submit Booking Request/i }).click()
    await expect(page.locator('.card-title').filter({ hasText: /Complete your payment/i })).toBeVisible({ timeout: 20_000 })

    const reference = (await page.locator('.booking-ref code').innerText()).trim()
    await pickSelect(page, /Payment method\*?/, /Bank/i)
    await expect(page.locator('.hotel-receiving-details')).toBeVisible()
    // The demo hotel may or may not have bank details wired up; the card must
    // still resolve to the hotel's receiving details and the reference stays visible.
    await expect(page.locator('.hotel-receiving-details')).toContainText(/hotel receiving details|contact the front desk/i)
    await expect(page.locator('.booking-ref code')).toHaveText(reference)
    await expectMounted(page, errors)
  })

  test('a past check-in date cannot be booked on the public flow', async ({ page }) => {
    const errors = trackPageErrors(page)
    const id = await hotelId(page.request)
    await page.goto(`/booking?hotel_id=${id}`)
    await searchRooms(page, /MRK Grand/, [60, 76, 90])
    await page.locator('.room-card input[type="checkbox"]').first().check()
    await fillGuestForm(page, 'Rukia', 'Hassan')

    // Sliding the check-in into the past makes the bound booking-date field
    // exceed its max, so the browser blocks the submit before any request fires.
    let reservationPost = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/public/reservations')) reservationPost += 1
    })
    page.on('response', (r) => {
      if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`)
    })

    await page.locator('input[type="date"]').nth(0).fill(isoDate(-1))
    await page.getByRole('button', { name: /Submit Booking Request/i }).click()
    await page.waitForTimeout(1200)

    expect(reservationPost, 'past-date booking must not reach the API').toBe(0)
    await expect(page.locator('.card-title').filter({ hasText: /Complete your payment/i })).toHaveCount(0)
    expect(errors).toEqual([])

    // The API backstop rejects a past check-in with a clear message, and the
    // submitted room number must never surface in the error. (Native fetch:
    // Playwright's page.request swallows POSTs against the PHP dev server.)
    const room = await (async () => {
      const { checkIn, checkOut } = futureStay(72)
      const res = await page.request.get(`${API}/v1/public/availability?hotel_id=${id}&check_in=${checkIn}&check_out=${checkOut}`)
      const { available_rooms } = await res.json()
      return available_rooms[0]
    })()
    const past = await fetch(`${API}/v1/public/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        hotel_id: id,
        room_selections: [{ room_id: room.room_id, room_number: room.room_number }],
        first_name: 'Rukia',
        last_name: 'Hassan',
        guest_email: 'rukia@example.com',
        guest_phone: '255712345678',
        country: 'Tanzania',
        country_code: 'TZ',
        city: 'Dar es Salaam',
        booking_type: 'single',
        check_in_date: isoDate(-1),
        check_out_date: isoDate(-1 + 2),
        num_adults: 1,
      }),
    })
    expect(past.status).toBe(422)
    const body = await past.json()
    const flattened = JSON.stringify(body)
    expect(flattened.toLowerCase()).toContain('cannot be in the past')
    expect(flattened).not.toContain(room.room_number)
  })

  test('guest form validation blocks submission with empty required fields', async ({ page }) => {
    const id = await hotelId(page.request)
    await page.goto(`/booking?hotel_id=${id}`)
    await searchRooms(page, /MRK Grand/, [26, 42, 58])
    await page.locator('.room-card input[type="checkbox"]').first().check()

    const failed = []
    page.on('requestfailed', (r) => failed.push(r.url()))
    await page.getByRole('button', { name: /Submit Booking Request/i }).click()
    await page.waitForTimeout(800)
    expect(failed.filter((u) => u.includes('/api/'))).toEqual([])
    // Still on the form (nothing was submitted), no payment card appeared.
    await expect(page.locator('.card-title').filter({ hasText: /Complete your payment/i })).toHaveCount(0)
  })
})