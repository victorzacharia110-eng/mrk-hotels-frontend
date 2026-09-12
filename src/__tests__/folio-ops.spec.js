import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HotelDashboard from '@/pages/dashboards/HotelDashboard.vue'
import i18n from '@/locales/i18n'
import { folioBreakdown, isFolioRefundEntry } from '@/utils/folio'

const api = vi.hoisted(() => {
  const created = []
  const mk = (initial = {}) =>
    new Proxy(initial, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined
        if (!(prop in target)) {
          target[prop] = vi.fn().mockResolvedValue({ data: {} })
          created.push(target[prop])
        }
        return target[prop]
      },
    })
  return {
    created,
    roomApi: mk(),
    reservationApi: mk(),
    guestApi: mk(),
    housekeepingApi: mk(),
    laundryApi: mk(),
    invoiceApi: mk(),
    inventoryApi: mk(),
    paymentApi: mk(),
    companyApi: mk(),
  }
})

vi.mock('@/api', () => ({
  roomApi: api.roomApi,
  reservationApi: api.reservationApi,
  guestApi: api.guestApi,
  housekeepingApi: api.housekeepingApi,
  laundryApi: api.laundryApi,
  invoiceApi: api.invoiceApi,
  inventoryApi: api.inventoryApi,
  paymentApi: api.paymentApi,
  companyApi: api.companyApi,
}))

const activeBar = { id: 501, label: 'Amina Hassan', folio_code: 'F-501', guestEmail: 'amina@example.com', roomNumber: '101' }

const relatedFolio = { reservation_id: 502, folio_code: 'F-502', guest_name: 'Lot 2', room_number: '0', balance_due: 0 }

function folioPayload() {
  return {
    folio: { folio_code: 'F-501', total_amount: 300000, room_charges: 300000, advance_payment: 150000, paid_amount: 150000 },
    reservation: {
      reservation_id: 501,
      guest_name: 'Amina Hassan',
      room: { room_number: '101' },
      check_out_date: '2026-11-04',
      advance_payment: 150000,
    },
    related_folios: [relatedFolio],
    folio_entries: [
      { folio_entry_id: 1, type: 'room_charge', amount: 300000, date: '2026-11-01', description: 'Room & taxes' },
      { folio_entry_id: 2, type: 'payment', amount: 150000, date: '2026-11-01', description: 'Advance' },
      { folio_entry_id: 3, type: 'early_departure_refund', amount: -80000, date: '2026-11-03', description: 'Refund for unused nights' },
    ],
    payments: [
      { payment_id: 7, amount: 150000, payment_method: 'cash', transaction_reference: 'T-101', date: '2026-11-01' },
      { payment_id: null, amount: 0, payment_method: 'cash', transaction_reference: '', date: '2026-11-02' },
    ],
  }
}

let wrapper

async function mountDashboard() {
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  auth.user = { user_role: 'receptionist', full_name: 'Receptionist Vanessa' }
  vi.spyOn(window, 'open').mockImplementation(() => ({
    document: { write: vi.fn(), close: vi.fn() },
  }))
  for (const fn of api.created) fn.mockReset().mockResolvedValue({ data: {} })
  wrapper = mount(HotelDashboard, { global: { plugins: [i18n] } })
  wrapper.vm.activeBar = activeBar
  wrapper.vm.folio = folioPayload()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

describe('folioBreakdown', () => {
  it('derives room charges, advance, refund and net from a folio payload', () => {
    expect(folioBreakdown(folioPayload())).toEqual({ roomCharges: 600000, paid: 150000, refund: 80000, net: 370000 })
  })

  it('identifies refund-typed ledger lines', () => {
    expect(isFolioRefundEntry('early_departure_refund')).toBe(true)
    expect(isFolioRefundEntry('refund')).toBe(true)
    expect(isFolioRefundEntry('room_charge')).toBe(false)
    expect(isFolioRefundEntry(null)).toBe(false)
  })
})

describe('folio operations on the stay view', () => {
  it('renders one view/print action per switcher row', async () => {
    await mountDashboard()
    expect(document.querySelectorAll('.sv-folio-view-btn')).toHaveLength(2)
    expect(document.querySelectorAll('.sv-folio-print-btn')).toHaveLength(2)
  })

  it('skips print buttons when the folio is still loading', async () => {
    await mountDashboard()
    wrapper.vm.folioLoading = true
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.sv-folio-print-btn').disabled).toBe(true)
  })

  it('shows an edit button only for payment rows with a payment id', async () => {
    await mountDashboard()
    expect(document.querySelectorAll('.sv-folio-payment-edit')).toHaveLength(1)
  })

  it('shows the editor identity under an edited payment', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.payments[0].edited_by = 'Receptionist Vanessa'
    payload.payments[0].edited_at = '2026-11-05'
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const note = document.querySelector('.sv-folio-edit-note')
    expect(note).toBeTruthy()
    expect(note.textContent).toContain('edited by')
    expect(note.textContent).toContain('Receptionist Vanessa')
    expect(note.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('posts the early-departure refund from the modal form', async () => {
    await mountDashboard()
    wrapper.vm.openEarlyDeparture()
    expect(wrapper.vm.earlyDepartureOpen).toBe(true)
    wrapper.vm.earlyDepartureForm.actual_departure_date = '2026-11-03'
    wrapper.vm.earlyDepartureForm.reason = 'Guests cut the safari short'
    await wrapper.vm.submitEarlyDeparture()
    expect(api.reservationApi.folioEarlyDeparture).toHaveBeenCalledWith(501, {
      actual_departure_date: '2026-11-03',
      reason: 'Guests cut the safari short',
    })
  })

  it('posts a null reason when the early-departure reason is blank', async () => {
    await mountDashboard()
    wrapper.vm.openEarlyDeparture()
    wrapper.vm.earlyDepartureForm.actual_departure_date = '2026-11-03'
    wrapper.vm.earlyDepartureForm.reason = '   '
    await wrapper.vm.submitEarlyDeparture()
    expect(api.reservationApi.folioEarlyDeparture).toHaveBeenCalledWith(
      501,
      expect.objectContaining({ actual_departure_date: '2026-11-03', reason: null }),
    )
  })

  it('keeps the modal open and skips the request when the date is empty', async () => {
    await mountDashboard()
    wrapper.vm.openEarlyDeparture()
    wrapper.vm.earlyDepartureForm.actual_departure_date = ''
    await wrapper.vm.submitEarlyDeparture()
    expect(api.reservationApi.folioEarlyDeparture).not.toHaveBeenCalled()
    expect(wrapper.vm.earlyDepartureOpen).toBe(true)
  })

  it('PUTs the payment edit for the targeted payment', async () => {
    await mountDashboard()
    wrapper.vm.openPaymentEdit({ payment: { payment_id: 7, amount: 150000, payment_method: 'cash', payment_status: 'completed', transaction_reference: 'T-101' } })
    expect(wrapper.vm.paymentEditModal).toBe(true)
    wrapper.vm.paymentEditForm.amount = 120000
    wrapper.vm.paymentEditForm.payment_status = 'completed'
    wrapper.vm.paymentEditForm.notes = 'Corrected after re-count'
    wrapper.vm.paymentEditForm.transaction_reference = 'T-101'
    await wrapper.vm.submitPaymentEdit()
    expect(api.paymentApi.paymentEdit).toHaveBeenCalledWith(7, {
      amount: 120000,
      payment_method: 'cash',
      payment_status: 'completed',
      notes: 'Corrected after re-count',
      transaction_reference: 'T-101',
    })
  })

  it('opens the invoice breakdown preview for the open folio and prints it', async () => {
    await mountDashboard()
    await wrapper.vm.openInvoicePreview(activeBar)
    expect(wrapper.vm.invoicePreviewOpen).toBe(true)
    await wrapper.vm.$nextTick()
    const table = document.querySelector('.sv-print-breakdown')
    expect(table).toBeTruthy()
    expect(table.textContent).toContain('TZS')
    wrapper.vm.printInvoiceBreakdown()
    expect(window.open).toHaveBeenCalled()
    const win = window.open.mock.results[0].value
    const html = win.document.write.mock.calls[0][0]
    expect(html).toContain('Folio invoice')
    expect(html).toContain('F-501')
    expect(html).toContain('Amina Hassan')
    expect(html).toContain('refund')
  })
})