import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('cash register payment reconciliation', () => {
  const page = read('src/pages/reception/CashDrawerPage.vue')

  it('shows the staff member who recorded each cash payment', () => {
    expect(page).toMatch(/receptionPanel\.recordedBy/)
    expect(page).toMatch(/p\.received_by_name/)
  })

  it('keeps the recorded-by label in both locales', () => {
    const en = JSON.parse(read('src/locales/en.json'))
    const sw = JSON.parse(read('src/locales/sw.json'))

    expect(en.receptionPanel.recordedBy).toBeTruthy()
    expect(sw.receptionPanel.recordedBy).toBeTruthy()
  })
})

describe('insert transaction refresh', () => {
  it('reloads the selected date and rechecks whether the day is closed', () => {
    const page = read('src/pages/reception/InsertTransactionPage.vue')

    expect(page).toMatch(/data-test="insert-transaction-refresh"[^>]*@click="refreshForDate"/)
  })
})

describe('cashiering centre reconciliation', () => {
  const page = read('src/pages/reception/CashieringCenterPage.vue')

  it('groups collections by provider and shows who received each payment', () => {
    expect(page).toMatch(/p\.payment_provider \|\| p\.payment_method \|\| 'other'/)
    expect(page).toMatch(/providerLabel\(provider\)/)
    expect(page).toMatch(/p\.received_by_name/)
  })

  it('offers only guests with a balance and follows the business date', () => {
    expect(page).toMatch(/guestOptions = computed/)
    expect(page).toMatch(/Number\(r\.balance_due \?\? r\.balance \?\? 0\) > 1/)
    expect(page).not.toMatch(/userPickedDate/)
    expect(page).toMatch(/selectedDate\.value = businessDateStore\.current/)
  })

  it('labels card as credit card in both locales', () => {
    const en = JSON.parse(read('src/locales/en.json'))
    const sw = JSON.parse(read('src/locales/sw.json'))

    expect(en.paymentFields.methods.card).toBe('Credit Card')
    expect(sw.paymentFields.methods.card).toBeTruthy()
  })
})

describe('payment list filters', () => {
  const page = read('src/pages/payments/PaymentListPage.vue')

  it('defaults to the business date and loads stays with a balance', () => {
    expect(page).toMatch(/useBusinessDateStore/)
    expect(page).toMatch(/status: 'confirmed,checked_in'/)
    expect(page).toMatch(/balance_due \?\?/)
  })
})

describe('stay-view task and channel state', () => {
  const dashboard = read('src/pages/dashboards/HotelDashboard.vue')
  const reservations = read('src/pages/reservations/ReservationListPage.vue')

  it('guards stale folio requests and refreshes open tasks', () => {
    expect(dashboard).toMatch(/folioRequestId/)
    expect(dashboard).toMatch(/relatedFolioRequestId/)
    expect(dashboard).toMatch(/roomTasksPollTimer/)
  })

  it('shows the display-friendly booking code and channel reference', () => {
    expect(dashboard).toMatch(/src\.booking_code \|\| src\.booking_reference/)
    expect(reservations).toMatch(/detail\.booking_code \|\| detail\.booking_reference/)
    expect(reservations).toMatch(/detail\.external_ref/)
    expect(reservations).toMatch(/channelReference/)
  })

  it('nets a group party into one outstanding balance on the stay bars', () => {
    expect(dashboard).toMatch(/const partyRooms = Array\.isArray\(r\.group\?\.rooms\)/)
    expect(dashboard).toMatch(/const partyBalance = partyRooms\.reduce/)
    expect(dashboard).toMatch(/partyRooms\.length > 1/)
  })
})
