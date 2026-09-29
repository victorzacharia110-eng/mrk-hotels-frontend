import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const index = vi.fn()
const show = vi.fn()
const options = vi.fn()

vi.mock('@/api', () => ({
  reservationApi: {
    index: (...a) => index(...a),
    show: (...a) => show(...a),
  },
  guestApi: { options: (...a) => options(...a) },
  invoiceApi: {},
  paymentApi: {},
  publicApi: {},
}))

// The business date is the hotel's own night-audit date, not the browser's.
const workingDate = { value: '2026-10-02' }
vi.mock('@/stores/workingDate', () => ({
  useWorkingDateStore: () => ({
    get workingDate() {
      return workingDate.value
    },
    ensureLoaded: async () => workingDate.value,
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

/**
 * Manager review: the reservations FROM/TO filters opened on the browser's date
 * rather than the date the night audit had left the hotel on, so after an audit
 * rolled the business date forward management was looking at yesterday. It also
 * filters on overlap (window_start/window_end) rather than exact date equality,
 * so a stay spanning the window is not hidden.
 *
 * This deliberately exercises the filter state and the query it builds rather
 * than the whole mounted page: the page's onMounted awaits several stores, which
 * is exactly what made a previous attempt at this test hang.
 */
describe('ReservationListPage business-date range', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    workingDate.value = '2026-10-02'
    index.mockReset().mockResolvedValue(emptyPage())
    show.mockReset().mockResolvedValue({ data: { reservation: {} } })
    options.mockReset().mockResolvedValue({ data: { data: [] } })
  })

  it('defaults FROM and TO to the hotel business date, not the browser date', async () => {
    const wrapper = build()
    await flushPromises()

    expect(wrapper.vm.filters.from).toBe('2026-10-02')
    expect(wrapper.vm.filters.to).toBe('2026-10-02')
  })

  it('leaves the range alone when the business date is not known yet', async () => {
    workingDate.value = ''
    const wrapper = build()
    await flushPromises()

    // No business date means no default; the manager can still pick a range.
    expect(wrapper.vm.filters.from).toBe('')
    expect(wrapper.vm.filters.to).toBe('')
  })

  it('picks up a business date that advanced past the browser date', async () => {
    const wrapper = build()
    await flushPromises()
    expect(wrapper.vm.filters.from).toBe('2026-10-02')

    // A night audit rolls the hotel forward; re-applying moves the range.
    workingDate.value = '2026-10-03'
    wrapper.vm.applyBusinessDate()
    expect(wrapper.vm.filters.from).toBe('2026-10-03')
    expect(wrapper.vm.filters.to).toBe('2026-10-03')
  })

  it('queries by overlap window so a stay spanning the range is not hidden', async () => {
    const wrapper = build()
    await flushPromises()
    index.mockClear()

    wrapper.vm.filters.from = '2026-10-01'
    wrapper.vm.filters.to = '2026-10-05'
    await wrapper.vm.load()
    await flushPromises()

    const params = index.mock.calls[0][0]
    expect(params.window_start).toBe('2026-10-01')
    expect(params.window_end).toBe('2026-10-05')
  })
})
