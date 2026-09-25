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
  it('renders one view/print/send action per switcher row', async () => {
    await mountDashboard()
    expect(document.querySelectorAll('.sv-folio-view-btn')).toHaveLength(2)
    expect(document.querySelectorAll('.sv-folio-print-btn')).toHaveLength(2)
    expect(document.querySelectorAll('.sv-folio-send-btn')).toHaveLength(2)
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

  it('puts the payment edit for the targeted payment', async () => {
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

  it('itemises the rental one row per night with the room and date in the folio ledger', async () => {
    await mountDashboard()
    const payload = folioPayload()
    // The stay runs 3 nights at 100,000 each (total 300,000); the persisted
    // room-charge entry only covers half of it, so the ledger must spell out
    // the unposted half one night per row ("Room 101 · Rent {date}") instead
    // of folding it into a single generic "Rental charges" line — and the
    // rows must sum exactly to the unposted remainder.
    payload.reservation.check_in_date = '2026-11-01'
    payload.reservation.total_amount = 300000
    payload.folio_entries = [
      { folio_entry_id: 1, type: 'room_charge', amount: 150000, date: '2026-11-01', description: 'Room & taxes' },
    ]
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const nights = wrapper.vm.folioEntries.filter((e) => e.rental)
    expect(nights).toHaveLength(3)
    for (const n of nights) {
      expect(n.description).toContain('Room 101')
      expect(n.description).toMatch(/rent/i)
      expect(n.description).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    }
    expect(Math.round(nights.reduce((s, n) => s + n.amount, 0))).toBe(150000)
    // Other room charges (persisted folio entries) stay visible.
    const descriptions = [...document.querySelectorAll('.sv-folio-table tbody tr td:nth-child(3)')].map(
      (td) => td.textContent.trim(),
    )
    expect(descriptions.some((d) => d.includes('Room & taxes'))).toBe(true)
    // TOTAL CHARGES still equals the full rental (posted + itemised).
    expect(wrapper.vm.folioTotals.charges).toBe(300000)
  })

  it('keeps a single legacy rental row when the stay has no usable dates', async () => {
    await mountDashboard()
    const payload = folioPayload()
    // No check-in date on the base payload: the rental cannot be split per
    // night, so it folds into one generic row when nothing covers it yet.
    payload.reservation.total_amount = 300000
    payload.folio_entries = []
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const rental = wrapper.vm.folioEntries.filter((e) => e.rental)
    expect(rental).toHaveLength(1)
    expect(rental[0].amount).toBe(300000)
    expect(rental[0].description).toBe('Rental charges')
  })

  it('Total Paid counts only money received, never discounts or refunds', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.folio_entries = [
      { folio_entry_id: 1, type: 'room_charge', amount: 300000, date: '2026-11-01', description: 'Room & taxes' },
      { folio_entry_id: 2, type: 'payment', amount: 150000, date: '2026-11-01', description: 'Advance' },
      { folio_entry_id: 5, type: 'discount', amount: -25000, date: '2026-11-02', description: 'QA discount' },
      { folio_entry_id: 6, type: 'adjustment', amount: -10000, date: '2026-11-02', description: 'QA adjustment' },
    ]
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    // The balance moves for the discount + adjustment…
    expect(wrapper.vm.folioTotals.credits).toBe(185000)
    // …but Total Paid is still only the money actually received.
    expect(wrapper.vm.folioTotals.paid).toBe(150000)
  })

  it('keeps the strip balance in step with the live ledger, not a stale balance_due', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.folio.balance_due = 999999
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    const strip = wrapper.vm.stayStrip.find((s) => s.key === 'balance')
    expect(strip.value).toBe(wrapper.vm.ledgerBalance.text)
    expect(strip.value).not.toContain('999,999')
  })

  it('keeps the current folio balance in the switcher fixed when a related folio is opened', async () => {
    await mountDashboard()
    // A misleading backend balance_due is exactly what made the current folio's
    // row flip when a related bill was opened: the row followed the live ledger
    // (220,000) while viewing the current bill but the stale balance_due
    // (999,999) once another bill took over the panel.
    wrapper.vm.folio.balance_due = 999999
    await wrapper.vm.$nextTick()
    const r = wrapper.vm.activeBar
    const before = wrapper.vm.folioRowBalance(r)
    expect(before).toBe(220000)
    const relatedPayload = folioPayload()
    relatedPayload.reservation = { ...relatedPayload.reservation, reservation_id: 502, guest_name: 'Lot 2' }
    relatedPayload.folio = { ...relatedPayload.folio, folio_code: 'F-502' }
    wrapper.vm.viewingFolio = relatedPayload
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    // Opening the related bill must not rewrite the current stay's figure: it
    // still reads the current folio's OWN charges − credits (220,000), never
    // the stale balance_due nor a balance from the opened related folio.
    expect(wrapper.vm.folioRowBalance(r)).toBe(before)
    const currentRow = [...document.querySelectorAll('.sv-folio-table-switch tbody tr')].find((tr) =>
      tr.textContent.includes('F-501'),
    )
    expect(currentRow.textContent).toContain('220,000.00')
    expect(currentRow.textContent).not.toContain('999,999')
  })

  it('resets a viewed related folio when another stay opens or the modal closes', async () => {
    await mountDashboard()
    wrapper.vm.viewingFolio = { reservation: { reservation_id: 502 } }
    wrapper.vm.openBarModal(activeBar)
    expect(wrapper.vm.viewingFolio).toBeNull()
    wrapper.vm.viewingFolio = { reservation: { reservation_id: 502 } }
    wrapper.vm.closeBarModal()
    expect(wrapper.vm.viewingFolio).toBeNull()
  })

  it('posts a payment to the VIEWED folio when a related folio is open', async () => {
    await mountDashboard()
    wrapper.vm.viewingFolio = { reservation: { reservation_id: 502, guest_name: 'Lot 2' } }
    await wrapper.vm.$nextTick()
    wrapper.vm.openPaymentModal()
    wrapper.vm.paymentForm.amount = 25000
    wrapper.vm.paymentForm.payment_method = 'cash'
    await wrapper.vm.submitPayment()
    expect(api.paymentApi.store).toHaveBeenCalledWith({
      reservation_id: 502,
      amount: 25000,
      payment_method: 'cash',
      payment_provider: null,
      transaction_reference: null,
    })
  })

  it('hides a transferred folio from the RELATED FOLIO chips, keeping split/cut links', async () => {
    await mountDashboard()
    // The base payload links reservation 502 to stay 501 as a related folio.
    expect(wrapper.vm.relatedFolios.map((r) => r.reservation_id)).toEqual([502])
    // After a TRANSFER that target belongs to another guest's bill — mark it
    // and the chip must disappear.
    wrapper.vm.markTransferredAway(501, 502)
    expect(wrapper.vm.relatedFolios).toEqual([])
    // A split/new-folio target (not marked) still shows.
    wrapper.vm.resetTransferMark()
    expect(wrapper.vm.relatedFolios.map((r) => r.reservation_id)).toEqual([502])
  })

  it('records the target when the move command is TRANSFER, never split/new-folio', async () => {
    await mountDashboard()
    wrapper.vm.resetTransferMark()

    wrapper.vm.folioMoveMode = 'transfer'
    wrapper.vm.moveSelected = ['e:2']
    wrapper.vm.moveTarget = '502'
    await wrapper.vm.moveSelectedOps()
    expect(api.reservationApi.folioTransfer).toHaveBeenCalledWith(
      501,
      expect.objectContaining({ mode: 'transfer', target_reservation_id: '502' }),
    )
    expect([...wrapper.vm.transferredAway(501)]).toEqual(['502'])

    wrapper.vm.resetTransferMark()
    wrapper.vm.folioMoveMode = 'split'
    wrapper.vm.moveSelected = ['e:2']
    wrapper.vm.moveTarget = '502'
    await wrapper.vm.moveSelectedOps()
    expect(wrapper.vm.transferredAway(501).size).toBe(0)

    wrapper.vm.resetTransferMark()
    wrapper.vm.folioMoveMode = 'newfolio'
    wrapper.vm.moveSelected = ['e:2']
    wrapper.vm.moveTarget = '502'
    await wrapper.vm.moveSelectedOps()
    // New-folio posts through the same transfer endpoint but stays linked.
    expect(api.reservationApi.folioTransfer).toHaveBeenLastCalledWith(
      501,
      expect.objectContaining({ mode: 'transfer', target_reservation_id: '502' }),
    )
    expect(wrapper.vm.transferredAway(501).size).toBe(0)
  })

  it('refuses to send an invoice to a malformed guest e-mail', async () => {
    await mountDashboard()
    wrapper.vm.activeBar = { ...activeBar, guestEmail: 'not-an-email' }
    await wrapper.vm.$nextTick()
    await wrapper.vm.sendFolioInvoice(wrapper.vm.activeBar)
    expect(api.invoiceApi.send).not.toHaveBeenCalled()
    expect(wrapper.vm.actionError).toBeTruthy()
  })

  it('shows a readable message instead of a raw server error when the e-mail fails', async () => {
    await mountDashboard()
    api.invoiceApi.send.mockRejectedValueOnce({ response: { status: 500 } })
    await wrapper.vm.sendFolioInvoice(activeBar)
    expect(api.invoiceApi.send).toHaveBeenCalledWith(501)
    expect(wrapper.vm.actionError).toContain('e-mail settings')
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
      request_id: expect.any(String),
    })
  })

  it('reuses one idempotency key across retries of the same posting intent', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.folio.balance_due = 100000
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    wrapper.vm.openPaymentModal('company')
    wrapper.vm.paymentForm.company_id = 9
    wrapper.vm.paymentForm.amount = 50000
    const firstKey = wrapper.vm.paymentForm.request_id
    expect(firstKey).toBeTruthy()
    await wrapper.vm.submitPayment()
    await wrapper.vm.submitPayment()
    expect(api.reservationApi.folioCreditors).toHaveBeenCalledTimes(2)
    expect(api.reservationApi.folioCreditors.mock.calls[0][1].request_id).toBe(firstKey)
    expect(api.reservationApi.folioCreditors.mock.calls[1][1].request_id).toBe(firstKey)
  })

  it('reuses one idempotency key across retries of the same add-charge intent', async () => {
    await mountDashboard()
    wrapper.vm.openChargeModal()
    wrapper.vm.chargeForm.description = 'Mini-bar'
    wrapper.vm.chargeForm.amount = 5000
    const firstKey = wrapper.vm.chargeForm.request_id
    expect(firstKey).toBeTruthy()
    await wrapper.vm.submitCharge()
    await wrapper.vm.submitCharge()
    expect(api.reservationApi.postRoomCharge).toHaveBeenCalledTimes(2)
    expect(api.reservationApi.postRoomCharge.mock.calls[0][1].request_id).toBe(firstKey)
    expect(api.reservationApi.postRoomCharge.mock.calls[1][1].request_id).toBe(firstKey)
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
    expect(html).toMatch(/refund/i)
  })

  it('prints the full branded invoice with the company name and ledger particulars', async () => {
    await mountDashboard()
    // Hotel identity comes from the signed-in tenant.
    const auth = wrapper.vm.authStore
    auth.user = {
      user_role: 'receptionist',
      full_name: 'Receptionist Vanessa',
      tenant: { hotel_name: 'Azure Bay Resort', city: 'Bagamoyo', country: 'Tanzania', phone: '+255 700 000 000', email: 'info@azurebay.tz', vrn: 'TIN-123456' },
    }
    wrapper.vm.folio = {
      ...folioPayload(),
      reservation: { ...folioPayload().reservation, check_in_date: '2026-11-01', check_out_date: '2026-11-04' },
    }
    await wrapper.vm.openInvoicePreview(activeBar)
    wrapper.vm.printInvoiceBreakdown()
    const html = window.open.mock.results[0].value.document.write.mock.calls[0][0]
    expect(html).toContain('Azure Bay Resort')
    expect(html).toContain('Bagamoyo, Tanzania')
    expect(html).toContain('+255 700 000 000')
    expect(html).toContain('062a52') // brand navy band/header
    expect(html).toContain('005eb8') // brand accent & balance figure
    expect(html).toContain('Room 101')
    expect(html).toContain('Room &amp; taxes') // a ledger particular with description
    expect(html).toContain('Check in') // dated particulars block
    expect(html).toContain('Check out')
    expect(html).toContain('Balance') // totals row labelled like Folio Operations
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

describe('transfer flip labels per the Folio Operations adjustment', () => {
  async function mountWithTransfer() {
    await mountDashboard()
    // The ledger carries a transfer in/out pair carried by the backend.
    wrapper.vm.folio = {
      ...folioPayload(),
      related_folios: [],
      folio_entries: [
        { folio_entry_id: 1, type: 'room_charge', amount: 300000, date: '2026-11-01', description: 'Room & taxes' },
        {
          folio_entry_id: 2,
          type: 'transfer_out',
          amount: -30000,
          date: '2026-11-02',
          description: 'Moved to EMMANUEL MALLYA',
          source_reservation_id: 502,
        },
        {
          folio_entry_id: 3,
          type: 'transfer_in',
          amount: 45000,
          date: '2026-11-02',
          description: 'ROOM POSTING',
          source_reservation_id: 801,
        },
      ],
    }
    await wrapper.vm.$nextTick()
  }

  it('records transfer labels so the receiver ledger can read "Transfer from guest (code)"', async () => {
    await mountDashboard()
    wrapper.vm.markTransferredAway(
      501,
      502,
      { reservation_id: 501, guest_name: 'Amina Hassan', folio_code: 'F-501' },
      { reservation_id: 502, guest_name: 'EMMANUEL MALLYA', folio_code: 'F-502' },
    )
    expect(wrapper.vm.transferLabelMap['501']).toEqual({ guest_name: 'Amina Hassan', folio_code: 'F-501' })
    expect(wrapper.vm.transferLabelMap['502']).toEqual({ guest_name: 'EMMANUEL MALLYA', folio_code: 'F-502' })
  })

  it('renders Transfer to on the sender ledger and Transfer from on the receiver', async () => {
    await mountWithTransfer()
    wrapper.vm.markTransferredAway(
      501,
      502,
      { reservation_id: 501, guest_name: 'Amina Hassan', folio_code: 'F-501' },
      { reservation_id: 502, guest_name: 'EMMANUEL MALLYA', folio_code: 'F-502' },
    )
    await wrapper.vm.$nextTick()
    const html = document.querySelector('.sv-stay-folio')?.innerHTML || document.body.innerHTML
    expect(html).toContain('Transfer to EMMANUEL MALLYA')
    expect(html).toContain('F-502')

    // Now look at the receiver's ledger: the transferred-in row (source 801)
    // carries no label of its own, so only the sender's out leg shows a name.
    const text = document.body.textContent
    expect(text).toContain('Transfer to EMMANUEL MALLYA')
    expect(text).toContain('F-502')

    // Receiver view: a `transfer_in` with source 501 must read Transfer from.
    wrapper.vm.activeBar = { ...activeBar, id: 802, label: 'EMMANUEL MALLYA', folio_code: 'F-802', roomNumber: '102' }
    wrapper.vm.folio = {
      ...folioPayload(),
      reservation: { ...folioPayload().reservation, reservation_id: 802, guest_name: 'EMMANUEL MALLYA' },
      related_folios: [],
      folio_entries: [
        { folio_entry_id: 1, type: 'room_charge', amount: 300000, date: '2026-11-01', description: 'Room & taxes' },
        {
          folio_entry_id: 2,
          type: 'transfer_in',
          amount: 45000,
          date: '2026-11-02',
          description: 'ROOM POSTING',
          source_reservation_id: 501,
        },
      ],
    }
    await wrapper.vm.$nextTick()
    const receiverText = document.body.textContent
    expect(receiverText).toContain('Transfer from Amina Hassan')
    expect(receiverText).toContain('F-501')
  })

  it('splits off the target selection when the transfer bool hides the transferred chip', async () => {
    await mountDashboard()
    wrapper.vm.activeBar = { ...activeBar }
    wrapper.vm.markTransferredAway(
      501,
      502,
      { reservation_id: 501, guest_name: 'Amina Hassan', folio_code: 'F-501' },
      { reservation_id: 502, guest_name: 'EMMANUEL MALLYA', folio_code: 'F-502' },
    )
    expect(wrapper.vm.relatedFolios.map((r) => r.reservation_id)).toEqual([])
  })
})

describe('created folio appears and is searchable on the split page', () => {
  it('remembers a created folio so it survives modal close and search', async () => {
    await mountDashboard()
    api.reservationApi.folioOpenNewFolio.mockResolvedValueOnce({
      data: {
        target_reservation: {
          reservation_id: 999,
          folio_code: 'F-999',
          guest_name: 'Amina Hassan',
          room: { room_number: '101' },
          status: 'confirmed',
        },
      },
    })
    // exercise the split-page create path (any non-transfer mode)
    wrapper.vm.folioMoveMode = 'split'
    await wrapper.vm.createNewFolioTarget()
    expect(wrapper.vm.moveTargets.map((t) => t.reservation_id)).toContain(999)
    expect(wrapper.vm.moveTarget).toBe(999)
    expect(wrapper.vm.createdFolioTargets['501'].map((t) => t.reservation_id)).toContain(999)

    // Reload the picker without the API knowing about the confirmed folio.
    api.reservationApi.folioSearch.mockResolvedValueOnce({
      data: { folios: [{ reservation_id: 502, folio_code: 'F-502', guest_name: 'Lot 2', room_number: '0', balance_due: 0 }] },
    })
    await wrapper.vm.loadFolioTargets('')
    expect(wrapper.vm.moveTargets.map((t) => t.reservation_id).sort()).toEqual([502, 999])

    // And it is findable via the split-page search box.
    await wrapper.vm.loadFolioTargets('F-999')
    expect(wrapper.vm.moveTargets.map((t) => t.reservation_id)).toEqual([999])
  })

  it('does not leak a remembered folio between different stays', async () => {
    await mountDashboard()
    wrapper.vm.rememberCreatedFolio(9999, {
      reservation_id: 111,
      folio_code: 'F-111',
      guest_name: 'Other Guest',
      room_number: '5',
    })
    await wrapper.vm.loadFolioTargets('')
    expect(wrapper.vm.moveTargets.map((t) => t.reservation_id)).not.toContain(111)
  })

  it('does not mark the split-created folio as if it were a transfer target', async () => {
    await mountDashboard()
    wrapper.vm.resetTransferMark()
    api.reservationApi.folioOpenNewFolio.mockResolvedValueOnce({
      data: {
        target_reservation: { reservation_id: 999, folio_code: 'F-999', guest_name: 'Amina Hassan', status: 'confirmed' },
      },
    })
    wrapper.vm.folioMoveMode = 'newfolio'
    await wrapper.vm.createNewFolioTarget()
    expect([...wrapper.vm.transferredAway(501)]).toEqual([])
  })
})

describe('transfer/split math per the reception adjustments', () => {
  it('deducts a transferred amount ONCE from the sender balance, never twice', async () => {
    await mountDashboard()
    // Sender before the move: rent 300,000 + parking 5,000 = 305,000.
    let payload = folioPayload()
    payload.payments = []
    payload.reservation = { ...payload.reservation, advance_payment: 0 }
    payload.folio = { ...payload.folio, advance_payment: 0 }
    payload.folio_entries = [
      { folio_entry_id: 1, type: 'room_charge', amount: 300000, date: '2026-11-01', description: 'Room & taxes' },
      { folio_entry_id: 2, type: 'extra_charge', amount: 5000, date: '2026-11-02', description: 'Parking fees' },
    ]
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    const before = wrapper.vm.folioTotals.charges - wrapper.vm.folioTotals.credits

    // After: parking (5,000) moved away — only rent remains on the donor plus
    // its book-keeping provenance row (split_out −5,000).
    payload = { ...payload, related_folios: [], folio_entries: [
      { folio_entry_id: 1, type: 'room_charge', amount: 300000, date: '2026-11-01', description: 'Room & taxes' },
      { folio_entry_id: 3, type: 'split_out', amount: -5000, date: '2026-11-02', description: 'Moved to EMMANUEL MALLYA' },
    ] }
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.folioTotals.charges).toBe(300000)
    expect(wrapper.vm.folioTotals.credits).toBe(0)
    // The balance fell by exactly the moved 5,000 (305,000 → 300,000).
    expect(wrapper.vm.folioTotals.charges - wrapper.vm.folioTotals.credits).toBe(before - 5000)
  })

  it('a split/new folio never inventories room rent — only the moved item shows', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.reservation = {
      ...folioPayload().reservation,
      reservation_id: 999,
      total_amount: 0,
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-04',
      room: { room_number: '101', price_per_night: 100000 },
    }
    payload.related_folios = []
    payload.payments = []
    payload.folio_entries = [
      { folio_entry_id: 1, type: 'room_charge', amount: 50000, date: '2026-11-02', description: 'ROOM POSTING' },
    ]
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    // The shared room's 100,000/night must not fabricate rent on this folio:
    // its own bill is zero, so only the split item (50,000) appears.
    expect(wrapper.vm.folioEntries.some((e) => e.rental)).toBe(false)
    expect(wrapper.vm.folioTotals.charges).toBe(50000)
  })

  it('does not re-invent a rent night that was split away from the donor', async () => {
    await mountDashboard()
    const payload = folioPayload()
    payload.reservation = {
      ...folioPayload().reservation,
      total_amount: 300000,
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-04',
      room: { room_number: '101', price_per_night: 100000 },
    }
    payload.related_folios = []
    payload.payments = []
    payload.folio_entries = [
      { folio_entry_id: 1, type: 'room_charge', amount: 250000, date: '2026-11-01', description: 'Room & taxes' },
      { folio_entry_id: 2, type: 'split_out', amount: -50000, date: '2026-11-02', description: 'Moved to new folio' },
    ]
    wrapper.vm.folio = payload
    await wrapper.vm.$nextTick()
    // The night moved onto the new folio must not be synthesised back here as
    // a fresh rent line (that was the "room charges reappear" glitch).
    expect(wrapper.vm.folioEntries.filter((e) => e.rental)).toHaveLength(0)
    expect(wrapper.vm.folioTotals.charges).toBe(250000)
  })
})