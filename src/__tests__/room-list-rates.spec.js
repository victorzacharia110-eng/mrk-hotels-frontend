import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const index = vi.fn()
const updateRates = vi.fn()
const createBlock = vi.fn()

vi.mock('@/api', () => ({
  roomApi: {
    index: (...a) => index(...a),
    updateRates: (...a) => updateRates(...a),
    createBlock: (...a) => createBlock(...a),
  },
}))

const RoomListPage = (await import('@/pages/rooms/RoomListPage.vue')).default

function page(n = 1) {
  return {
    data: {
      data: [{ room_id: `r${n}`, room_number: '101', room_type: 'single', price_per_night: 50000, status: 'available' }],
      current_page: n,
      last_page: 3,
      per_page: 20,
      total: 60,
    },
  }
}

function build() {
  return mount(RoomListPage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { SearchableSelect: true, TableExportButton: true, DeleteConfirmModal: true },
    },
  })
}

/**
 * Manager review: "Why when push rates not work unless refreshed?"
 *
 * The push succeeded, but only the inventory summary was refetched. The room
 * list kept the old prices, so the change looked like it had not applied until
 * the manager reloaded the page. Both must refresh.
 */
describe('RoomListPage push rates', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    index.mockReset().mockResolvedValue(page(1))
    updateRates.mockReset().mockResolvedValue({ data: {} })
  })

  it('refetches the room list after pushing rates, not just the summary', async () => {
    const wrapper = build()
    await flushPromises()
    const callsAfterMount = index.mock.calls.length

    wrapper.vm.rateForm.room_type = 'single'
    wrapper.vm.rateForm.price_per_night = 80000
    await wrapper.vm.pushRates()
    await flushPromises()

    expect(updateRates).toHaveBeenCalledWith({ room_type: 'single', price_per_night: 80000 })
    // The room list must be re-requested so the displayed price is not stale.
    expect(index.mock.calls.length).toBeGreaterThan(callsAfterMount)

    // A second push must refetch again — the regression was that a refresh was
    // needed to see any change at all.
    const before = index.mock.calls.length
    wrapper.vm.rateForm.price_per_night = 90000
    await wrapper.vm.pushRates()
    await flushPromises()
    expect(index.mock.calls.length).toBeGreaterThan(before)
  })

  it('clears the price box after a successful push so it is not resubmitted', async () => {
    const wrapper = build()
    await flushPromises()

    wrapper.vm.rateForm.price_per_night = 80000
    await wrapper.vm.pushRates()
    await flushPromises()

    expect(wrapper.vm.rateForm.price_per_night).toBeNull()
  })
})
