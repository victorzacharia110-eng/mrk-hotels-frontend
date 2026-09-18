import { test, expect } from '@playwright/test'

/**
 * End-to-end creditor settlement flow (PDF 2 amendments):
 *  1. Cashiering Center shows the outstanding corporate balance under
 *     "Creditors Owed" and settles part of it via the CREDITORS dropdown.
 *  2. Company Data opens the date-ranged posted-folio statement, selects a
 *     posted folio and RECEIVEs a settlement which lowers the account.
 *
 * Requires the live demo tenant (MRK Grand Hotel) with a company "telesoft"
 * that has an outstanding posted-folio balance. The default seeded state has
 * telesoft with a 0 balance, so this spec builds its own fixture through the
 * API first (checks a guest in, posts a folio to the creditor, raises its
 * available credit) so it both tests the feature and leaves clean demo data.
 */

import { API, USERS, signIn, isoDate, trackPageErrors, expectMounted } from './helpers'

const COMPANY_NAME = 'e2e-creditor'
// Rooms verified (via API availability check) to accept a past-window stay —
// the posting-to-creditors flow demands an arrived guest, so the fixture needs
// a reservation whose check-in is already in the past. Each run consumes the
// first candidate that still accepts the window; reruns move down the list.
const PAST_ROOMS = [
  '01a04a60-7f3c-7247-ac88-78a93363dfaa',
  '01a04d1e-ae3f-71cc-9bb1-4735b7c0140c',
  '01a04cf9-26db-71b4-a210-0b3900b72782',
  '01a05abe-8b2a-724a-95d0-f92690b75dae',
  '01a04dab-feaa-7163-9ef6-ce727df27cb5',
  '01a04ce2-e3e1-734f-a361-6654607460d5',
  '01a04cda-86e1-7010-ad55-ff9e6906782c',
  '01a04cdb-6e31-700c-b7ec-e77115a430af',
  '01a04cda-870d-70fc-813b-530e7754e193',
  '01a04cda-0bfe-71bb-b241-efc72331f7f0',
  '01a04c80-a2fb-72db-9b11-ad401b8e83d8',
  '01a05aab-34a5-7101-babd-7924da77f7cb',
  '01a04daf-b1f7-7038-920e-f00f82a21034',
  '01a04cb9-6a72-720e-97cb-e0ce044ee505',
  '01a05a9a-007a-7045-a859-cc01c5831f14',
  '01a04cdb-ee9d-70b1-9fa3-b9c79745cfbb',
]
let AUTH = ''

async function apiLogin(request) {
  const res = await request.post(`${API}/v1/auth/login`, {
    data: { email: USERS.reception.email, password: USERS.reception.password },
  })
  expect(res.ok()).toBeTruthy()
  AUTH = (await res.json()).token
}

async function apiAdmin(request) {
  const res = await request.post(`${API}/v1/auth/login`, {
    data: { email: USERS.admin.email, password: USERS.admin.password },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).token
}

async function apiCalls(request, token, method, path, body, ok = 200) {
  const res = await request[method](`${API}${path}`, {
    ...(method === 'get' ? { params: body } : { data: body }),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (res.status() !== ok) {
    throw new Error(`${method.toUpperCase()} ${path} -> ${res.status()}: ${await res.text()}`)
  }
  return res
}

/** Build a self-contained fixture: company + guest in-house + owed balance. */
async function buildFixture(request) {
  const admin = await apiAdmin(request)
  await apiLogin(request)

  // Unique company each run so reruns never collide with earlier balances.
  const stamp = Date.now().toString(36)
  const companyRes = await apiCalls(request, admin, 'post', '/v1/companies', {
    name: `${COMPANY_NAME}-${stamp}`,
    available_credit: 200000,
    current_balance: 0,
    status: 'active',
  }, 201)
  const company = (await companyRes.json()).company
  const companyId = company.company_id

  // Receptionists do the operational work (the `operate` middleware rejects
  // admins/managers). Create an in-house guest on a room that is free in the
  // PAST window so the creditor posting sees an arrived guest: try the known
  // free rooms in order until one accepts the reservation.
  const ci = isoDate(-1)
  const co = isoDate(1)
  let resv = null
  for (const roomId of PAST_ROOMS) {
    const attempt = await request.post(`${API}/v1/reservations`, {
      data: {
        room_id: roomId,
        first_name: 'E2E',
        last_name: 'Creditor Guest',
        guest_phone: '+255700123456',
        country_code: 'TZ',
        booking_type: 'single',
        status: 'confirmed',
        check_in_date: ci,
        check_out_date: co,
      },
      headers: { Authorization: `Bearer ${AUTH}` },
    })
    if (attempt.status() === 201) {
      resv = await attempt.json()
      break
    }
  }
  expect(resv, 'no room accepted a past-window reservation').toBeTruthy()
  const reservationId = resv.reservation?.reservation_id || resv.data?.reservation_id

  const checkIn = await request.post(`${API}/v1/reservations/${reservationId}/check-in`, {
    data: {},
    headers: { Authorization: `Bearer ${AUTH}` },
  })
  expect(checkIn.status(), await checkIn.text()).toBe(200)

  // Post 50,000 of the guest folio to the creditor company.
  await apiCalls(request, AUTH, 'post', `/v1/reservations/${reservationId}/folio/creditors`, {
    company_id: companyId,
    amount: 50000,
    note: 'E2E corporate bill',
  })

  return { company, companyId, reservationId, stamp }
}

test.describe('creditor settlement (PDF 2)', () => {
  test('Cashiering Center lists the owed creditor and settles it; Company Data receives from the posted folio', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)
    const { company, companyId } = await buildFixture(request)
    const owed = `TZS ${Number(company.current_balance || 50000).toLocaleString()}`

    // --- Cashiering Center -----------------------------------------------
    await signIn(page, { email: 'reception', password: 'password' })
    await page.goto('/app/payments/cashiering')

    const errors = trackPageErrors(page)
    const creditorsCard = page.locator('h3', { hasText: 'Creditors Owed' })
    await expect(creditorsCard).toBeVisible()
    await expectMounted(page, errors, '.dashboard-page')

    const row = page.locator('.table tr', { hasText: company.name }).first()
    await expect(row).toBeVisible()
    await expect(row).toContainText(owed)

    // Settle 10,000 of the 50,000 owed using the Settle shortcut.
    await row.locator('button', { hasText: 'Settle' }).click()
    const modal = page.locator('.modal-overlay').last()
    await expect(modal).toBeVisible()

    // Modal is pre-scoped to the creditor (CREDITORS dropdown) with amount filled.
    // Select order in the record-payment modal: Guest, Creditors, Method, ...
    const creditorsSelect = modal.locator('select').nth(1)
    await expect(creditorsSelect).toHaveValue(companyId)
    await expect(creditorsSelect.locator('option:checked')).toContainText(company.name)
    await expect(modal.locator('input[type="number"]')).toHaveValue('50000')

    await modal.locator('input[type="number"]').fill('10000')
    await modal.getByRole('button', { name: /save payment/i }).click()

    await expect(page.locator('.alert-success')).toContainText(
      "Payment received. The creditor's balance was reduced.",
    )
    // The creditor row now shows the reduced balance.
    await expect(row).toContainText('TZS 40,000')

    // --- Company Data -----------------------------------------------------
    await page.goto('/app/payments/company-data')
    await expect(page.locator('h1', { hasText: /Company Data/i })).toBeVisible()

    // Click the company name to open the posted-folio statement.
    const companyLink = page.locator('button.btn-link', { hasText: company.name }).first()
    await expect(companyLink).toBeVisible()
    await companyLink.click()

    const statement = page.locator('.modal-lg')
    await expect(statement).toBeVisible()
    // Balance badge reflects what is still owed after the 10,000 settlement.
    await expect(statement.locator('.badge')).toContainText('TZS 40,000')

    // The ledger mixes the posted folio (row) with the earlier settlement (row).
    const folioRow = statement.locator('tbody tr', { hasText: 'E2E Creditor Guest' }).first()
    await expect(folioRow).toContainText('TZS 50,000')
    await expect(statement.locator('tbody tr', { hasText: 'Payment' })).toContainText('TZS 10,000')

    // Select the posted folio and RECEIVE the remaining balance.
    await folioRow.locator('input[type="checkbox"]').check()
    await expect(statement.locator('text=40,000').first()).toBeVisible()

    await statement.getByRole('button', { name: 'RECEIVE' }).click()
    const receive = page.locator('.modal-overlay').last()
    await expect(receive).toBeVisible()
    await expect(receive.locator('input[type="number"]')).toHaveValue('40000')
    await receive.getByRole('button', { name: 'RECEIVE' }).click()

    await expect(page.locator('.alert-success')).toContainText('Payment recorded. The balance owed was adjusted.')

    // Balance is now settled; statement reloads to show both receipts.
    await expect(statement.locator('.badge', { hasText: 'Balance:' })).toContainText('TZS 0')
    await expect(statement.locator('tbody tr', { hasText: 'Payment' })).toHaveCount(2)

    // Back in Cashiering Center this creditor is no longer owed.
    await page.goto('/app/payments/cashiering')
    await expect(page.locator('.table tr', { hasText: company.name })).toHaveCount(0)

    await expectMounted(page, errors, '.dashboard-page')
    void companyId
  })
})