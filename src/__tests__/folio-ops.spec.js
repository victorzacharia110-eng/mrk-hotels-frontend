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

  it('hides nightly "night(s)" room-charge rows from the folio ledger but keeps other room charges', async () => {
    await mountDashboard()
    const payload = folioPayload()
    // The stay carries a 300,000 rental; the persisted room-charge entry
    // covers only part of it, so the remainder must fold into a single
    // non-nightly "Rental charges" row.
    payload.reservation.total_amount = 300000
    payload.folio_entries = [
      { folio_entry_id: 1, type: 'room_charge', amount: 150000, date: '2026-11-01', description: 'Room & taxes' },
      { folio_entry_id: 2, type: 'payment', amount: 150000, date: '2026-11-01', description: 'Advance' },
    ]
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const descriptions = [...document.querySelectorAll('.sv-folio-table tbody tr td:nth-child(3)')].map(
      (td) => td.textContent.trim(),
    )
    expect(descriptions.some((d) => /night\(s\)/.test(d))).toBe(false)
    // Other room charges (persisted folio entries whose description is not
    // nights) stay visible.
    expect(descriptions.some((d) => d.includes('Room & taxes'))).toBe(true)
    // The rental total still reaches the ledger through a single folded row so
    // TOTAL CHARGES stays in step with the top card.
    const rentalRow = wrapper.vm.folioEntries.find((e) => e.rental)
    expect(rentalRow).toBeTruthy()
    expect(rentalRow.description).not.toMatch(/night/)
    expect(rentalRow.amount).toBe(150000)
  })

  it('blocks post-to-creditors when the amount exceeds the folio balance', async () => {
    await mountDashboard()
    // Give the folio a balance_due of 100,000.
    const payload = folioPayload()
    payload.folio.balance_due = 100000
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    wrapper.vm.openPaymentModal('company')
    wrapper.vm.paymentForm.company_id = 9
    wrapper.vm.paymentForm.amount = 150000
    await wrapper.vm.submitPayment()
    expect(api.reservationApi.folioCreditors).not.toHaveBeenCalled()
    expect(wrapper.vm.paymentErrors.amount).toBeTruthy()
    expect(wrapper.vm.paymentModal).toBe(true)
  })

  it('posts to creditors when the amount is within the folio balance', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.folio.balance_due = 100000
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    wrapper.vm.openPaymentModal('company')
    wrapper.vm.paymentForm.company_id = 9
    wrapper.vm.paymentForm.amount = 50000
    await wrapper.vm.submitPayment()
    expect(api.reservationApi.folioCreditors).toHaveBeenCalledWith(501, {
      company_id: 9,
      amount: 50000,
      note: null,
    })
  })

  it('shows the ledger balance on the current folio card when the payload omits balance_due', async () => {
    await mountDashboard()
    // The mock payload carries no balance_due anywhere: 600,000 charges −
    // 150,000 advance − 80,000 early-departure refund = 370,000 must reach
    // the folio card instead of a bare 0.00.
    expect(wrapper.vm.ledgerHeader.balance).toBe(370000)
    // The card must match the balance due obtained in the ledger footer
    // below: charges 300,000 − paid 150,000 + 80,000 refund − 150,000
    // advance − 80,000 refund = 220,000? No — the ledger rows sum to
    // 300,000 (room charge) − 150,000 (payment) + 80,000 (refund credit) =
    // 220,000. The card mirrors the footer's balance, not the derived net.
    expect(wrapper.vm.balanceDisplay.text).toContain('220,000')
    const cards = [...document.querySelectorAll('.sv-panel-card')]
    const balanceCard = cards.find((c) => c.textContent.includes('Balance'))
    expect(balanceCard).toBeTruthy()
    expect(balanceCard.textContent).toContain('220,000')
    expect(balanceCard.textContent).not.toContain('TZS 0.00')
    // … and it equals the ledger footer's balance exactly.
    expect(wrapper.vm.balanceDisplay.text).toBe(wrapper.vm.ledgerBalance.text)
  })

  it('keeps the card in step with the ledger footer even when a stale balance_due is present', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.folio.balance_due = 999999
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    // ledgerHeader still prefers the backend's balance_due…
    expect(wrapper.vm.ledgerHeader.balance).toBe(999999)
    // …but the displayed balance matches the ledger's own charges − credits.
    expect(wrapper.vm.balanceDisplay.text).toContain('220,000')
    expect(wrapper.vm.balanceDisplay.text).toBe(wrapper.vm.ledgerBalance.text)
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

describe('post-to-creditors gating on the stay view', () => {
  async function menuForStatus(status) {
    await mountDashboard()
    wrapper.vm.activeBar = { ...activeBar, rawStatus: status }
    wrapper.vm.moreOpen = true
    await wrapper.vm.$nextTick()
    return document.querySelectorAll('.sv-dropdown-menu')
  }

  it('hides post-to-creditors and charges before the guest checks in', async () => {
    const [menu] = await menuForStatus('confirmed')
    const buttons = [...menu.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(buttons).not.toContain('Post to creditors')
    expect(buttons).not.toContain('Add Charges')
  })

  it('shows post-to-creditors and charges for an in-house guest', async () => {
    const [menu] = await menuForStatus('checked_in')
    const buttons = [...menu.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(buttons).toContain('Post to creditors')
    expect(buttons).toContain('Add Charges')
  })

  it('hides the creditors segment in the payment modal before check-in', async () => {
    await mountDashboard()
    wrapper.vm.activeBar = { ...activeBar, rawStatus: 'pending' }
    wrapper.vm.moreOpen = false
    wrapper.vm.openPaymentModal('company')
    await wrapper.vm.$nextTick()
    const segText = [...document.querySelectorAll('.sv-seg-btn')].map((b) => b.textContent.trim())
    expect(segText).toContain('Collect payment')
    expect(segText).not.toContain('Post to creditors')
  })
})