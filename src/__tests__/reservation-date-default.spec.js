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

// The business date is the hotel's own night-audit date, not the browser's.
const businessDate = { value: '2026-10-02' }
vi.mock('@/stores/businessDate', () => ({
  useBusinessDateStore: () => ({
    get current() {
      return businessDate.value
    },
    ensureLoaded: async () => businessDate.value,
  }),
}))

const ReservationListPage = (await import('@/pages/reservations/ReservationListPage.vue')).default

function build() {
  return mount(ReservationListPage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { SearchableSelect: true, TableExportButton: true, DeleteConfirmModal: true },
    },
  })
}

function emptyPage() {
  return { data: { data: [], current_page: 1, last_page: 1, total: 0 } }
}

describe('ReservationListPage business-date tabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    businessDate.value = '2026-10-02'
    index.mockReset().mockResolvedValue(emptyPage())
    show.mockReset().mockResolvedValue({ data: { reservation: {} } })
  })

  it('loads reserved arrivals for the current business date by default', async () => {
    await build()
    await flushPromises()

    expect(index).toHaveBeenCalled()
    const params = index.mock.calls.at(-1)[0]
    expect(params.from).toBe('2026-10-02')
    expect(params.window_end).toBe('2026-10-02')
    expect(params.exclude_status).toEqual(['cancelled', 'no_show', 'checked_out'])
  })

  it('loads active in-house reservations for the current business date', async () => {
    const wrapper = build()
    await flushPromises()
    index.mockClear()

    wrapper.vm.switchTab('active')
    await flushPromises()

    const params = index.mock.calls.at(-1)[0]
    expect(params.status).toBe('checked_in')
    expect(params.window_start).toBe('2026-10-02')
    expect(params.window_end).toBe('2026-10-02')
  })

  it('loads checked-out departures for the current business date', async () => {
    const wrapper = build()
    await flushPromises()
    index.mockClear()

    wrapper.vm.switchTab('checked_out')
    await flushPromises()

    const params = index.mock.calls.at(-1)[0]
    expect(params.status).toBe('checked_out')
    expect(params.window_start).toBe('2026-10-02')
    expect(params.to).toBe('2026-10-02')
  })

  it('loads cancelled/no-show reservations for the current business date context', async () => {
    const wrapper = build()
    await flushPromises()
    index.mockClear()

    wrapper.vm.switchTab('cancelled')
    await flushPromises()

    const params = index.mock.calls.at(-1)[0]
    expect(params.status).toBe('cancelled,no_show')
    expect(params.window_start).toBe('2026-10-02')
    expect(params.window_end).toBe('2026-10-02')
  })
})
