import { test, expect } from '@playwright/test'
import { API, USERS, futureStay, hotelId } from './helpers'

/**
 * Guest self-service invoice download on the public hotel directory page.
 * The seeded reservations carry no booking reference and there are no live
 * invoices, so the success test builds its own fixture through the real API:
 * public hold → completed cash payment → confirmed → downloadable PDF.
 */

let fixture // { reference, phone }

test.beforeAll(async ({ request }) => {
  const id = await hotelId(request)
  const { checkIn, checkOut } = futureStay(88)

  const login = await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: USERS.reception.email, password: USERS.reception.password }),
  })
  const { token } = await login.json()

  const avail = await (
    await fetch(`${API}/v1/public/availability?hotel_id=${id}&check_in=${checkIn}&check_out=${checkOut}`, {
      headers: { Accept: 'application/json' },
    })
  ).json()
  const room = avail.available_rooms[0]
  expect(room, 'a room window must be free to build the fixture').toBeTruthy()

  const held = await (
    await fetch(`${API}/v1/public/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        hotel_id: id,
        room_selections: [{ room_id: room.room_id }],
        first_name: 'Zawadi',
        last_name: 'Mushi',
        guest_email: `zawadi.e2e${Date.now()}@example.com`,
        guest_phone: '255712345678',
        country: 'Tanzania',
        country_code: 'TZ',
        city: 'Dar es Salaam',
        booking_type: 'single',
        check_in_date: checkIn,
        check_out_date: checkOut,
        num_adults: 1,
      }),
    })
  ).json()
  const reference = held.booking_reference
  expect(reference, 'public hold should return a booking reference').toBeTruthy()

  // Settle it with a completed cash payment so the hold becomes 'confirmed'.
  const paid = await (
    await fetch(`${API}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        booking_reference: reference,
        amount: 1_000_000,
        payment_method: 'cash',
        payment_status: 'completed',
        notes: 'E2E invoice fixture',
      }),
    })
  ).json()
  expect(paid.payment || paid.message, 'completed payment should be recorded').toBeTruthy()

  fixture = { reference, phone: '0712345678' }
})

test('directory page shows the invoice download card', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Download your invoice' })).toBeVisible()
  await expect(page.getByPlaceholder(/Booking reference/)).toBeVisible()
  await expect(page.getByPlaceholder(/Phone number/)).toBeVisible()
})

test('shows an error when no invoice matches the reference and phone', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder(/Booking reference/).fill('BK-XXXX-0000')
  await page.getByPlaceholder(/Phone number/).fill('0700000000')
  await page.getByRole('button', { name: 'Download invoice' }).click()
  await expect(page.locator('.alert-error')).toHaveText(
    'No invoice found for that booking reference and phone number.'
  )
})

test('downloads the invoice PDF for a matching reference and phone', async ({ page }) => {
  expect(fixture, 'fixture must have been built (run the prior tests implicitly)').toBeTruthy()
  await page.goto('/')
  await page.getByPlaceholder(/Booking reference/).fill(fixture.reference)
  await page.getByPlaceholder(/Phone number/).fill(fixture.phone)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download invoice' }).click()
  const download = await downloadPromise

  // Invoice files are named after the booking reference (BK-MGH-YYYY-NNNN.pdf).
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  expect(download.suggestedFilename()).toContain('BK-')
  await expect(page.locator('.alert-success')).toHaveText('Your invoice has been downloaded.')
})