import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const inventory = vi.fn()
const roomsIndex = vi.fn()
const reservations = vi.fn()
const bizShow = vi.fn()

vi.mock('@/api', () => ({
  roomApi: {
    index: (...a) => roomsIndex(...a),
    inventory: (...a) => inventory(...a),
  },
  reservationApi: { index: (...a) => reservations(...a) },
  businessDateApi: { show: (...a) => bizShow(...a) },
}))

const RoomListPage = (await import('@/pages/rooms/RoomListPage.vue')).default

const emptyPage = { data: { data: [], current_page: 1, last_page: 1, per_page: 100, total: 0 } }

function build() {
  return mount(RoomListPage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        SearchableSelect: true,
        TableExportButton: true,
        DeleteConfirmModal: true,
        StayCalendar: true,
      },
    },
  })
}

describe('RoomListPage inventory', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    roomsIndex.mockResolvedValue(emptyPage)
    reservations.mockResolvedValue(emptyPage)
    bizShow.mockResolvedValue({ data: { business_date: '2026-10-11' } })
  })

  it('renders the per-type rate summary without crashing', async () => {
    inventory.mockResolvedValue({
      data: {
        from: '2026-10-11',
        types: [
          {
            room_type: 'deluxe',
            room_count: 5,
            available_count: 3,
            min_rate: 180000,
            avg_rate: 200000,
            status_counts: { in_house: 2 },
          },
        ],
      },
    })

    const wrapper = build()
    await wrapper.vm.loadInventory()
    await flushPromises()

    // Regression: `formatRate` was referenced by the template but never defined,
    // so this render threw "t.formatRate is not a function" and blanked Rooms.
    expect(wrapper.text()).toContain('TZS 180,000')
    expect(wrapper.text()).toContain('TZS 200,000')
    expect(wrapper.text()).toContain('deluxe')
  })

  it('keeps the per-room listing off Inventory and on the All rooms tab', async () => {
    inventory.mockResolvedValue({ data: { from: '2026-10-11', types: [] } })

    const wrapper = build()
    await flushPromises()

    // Inventory is a summary (cards + tape calendar), never the room listing.
    expect(wrapper.find('.table-scroll.is-pinned table.table-pinned').exists()).toBe(false)

    wrapper.vm.switchTab('all-rooms')
    await flushPromises()
    expect(wrapper.find('.table-scroll.is-pinned table.table-pinned').exists()).toBe(true)
  })
})
