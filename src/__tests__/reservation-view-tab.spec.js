import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const index = vi.fn()
const show = vi.fn()

vi.mock('@/api', () => ({
  reservationApi: {
    index: (...a) => index(...a),
    show: (...a) => show(...a),
  },
  guestApi: {},
  invoiceApi: {},
  paymentApi: {},
  publicApi: {},
}))

const ReservationListPage = (await import('@/pages/reservations/ReservationListPage.vue')).default

const ROW = {
  reservation_id: 'res-1',
  guest_name: 'Neema Joseph',
  guest_phone: '0754000001',
  status: 'confirmed',
  room: { room_number: '204', room_type: 'double' },
  arrival_date: '2026-10-01',
  departure_date: '2026-10-04',
}

const FULL = {
  ...ROW,
  booking_reference: 'BK-9001',
  nights: 3,
  num_adults: 2,
  num_children: 1,
  rate: 120000,
  total_amount: 360000,
  room_charges: 0,
  advance_payment: 100000,
  balance: 260000,
  payments: [],
  guest: {
    full_name: 'Neema Joseph',
    phone: '0754000001',
    email: 'neema@example.com',
    id_type: 'national_id',
    id_number: '197801011234',
    nationality: 'Tanzanian',
    country: 'Tanzania',
    city: 'Arusha',
    date_of_birth: '1978-01-01',
    vip_status: 'gold',
  },
}

function build() {
  return mount(ReservationListPage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { SearchableSelect: true, TableExportButton: true, DeleteConfirmModal: true },
    },
  })
}

/**
 * Manager review: "VIEW tab is very confusing, it should show guest information
 * and booking details."
 *
 * The modal previously listed only booking and money fields — the guest's phone,
 * ID, nationality and VIP status were all absent, so staff could not confirm who
 * they were dealing with without leaving the screen.
 */
describe('ReservationListPage VIEW tab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    index.mockReset().mockResolvedValue({
      data: { data: [ROW], current_page: 1, last_page: 1, total: 1 },
    })
    show.mockReset().mockResolvedValue({ data: { reservation: FULL } })
  })

  it('fetches the full reservation so the guest relation is present', async () => {
    const wrapper = build()
    await flushPromises()

    await wrapper.vm.openDetail(ROW)
    await flushPromises()

    expect(show).toHaveBeenCalledWith('res-1')
    expect(wrapper.vm.detail.guest.nationality).toBe('Tanzanian')
  })

  it('shows guest information alongside booking details', async () => {
    const wrapper = build()
    await flushPromises()

    await wrapper.vm.openDetail(ROW)
    await flushPromises()

    const text = wrapper.text()
    // Guest identity block.
    expect(text).toContain('Neema Joseph')
    expect(text).toContain('neema@example.com')
    expect(text).toContain('197801011234')
    expect(text).toContain('Tanzanian')
    expect(text).toContain('gold')
    // Booking details block.
    expect(text).toContain('BK-9001')
    expect(text).toContain('204')
  })

  it('still opens with the summary row when the detail fetch fails', async () => {
    show.mockRejectedValue(new Error('boom'))
    const wrapper = build()
    await flushPromises()

    await wrapper.vm.openDetail(ROW)
    await flushPromises()

    // The modal must not be left blank by a failed refetch.
    expect(wrapper.vm.showDetail).toBe(true)
    expect(wrapper.vm.detail.guest_name).toBe('Neema Joseph')
  })
})
