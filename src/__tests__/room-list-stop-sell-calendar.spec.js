import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const index = vi.fn()
const updateRates = vi.fn()
const stopSell = vi.fn()
const storeStopSell = vi.fn()
const destroyStopSell = vi.fn()
const inventory = vi.fn()

vi.mock('@/api', () => ({
  roomApi: {
    index: (...a) => index(...a),
    updateRates: (...a) => updateRates(...a),
    stopSell: (...a) => stopSell(...a),
    storeStopSell: (...a) => storeStopSell(...a),
    destroyStopSell: (...a) => destroyStopSell(...a),
    inventory: (...a) => inventory(...a),
  },
}))

const RoomListPage = (await import('@/pages/rooms/RoomListPage.vue')).default

const ROOMS = [
  { room_id: 'r1', room_number: '101', room_type: 'single', price_per_night: 50000, status: 'available' },
  { room_id: 'r2', room_number: '102', room_type: 'single', price_per_night: 50000, status: 'available' },
  { room_id: 'r3', room_number: '201', room_type: 'suite', price_per_night: 120000, status: 'available' },
]

function roomsPage() {
  return {
    data: { data: ROOMS, current_page: 1, last_page: 1, total: ROOMS.length },
  }
}

/** A block covering 15th–17th inclusive. */
function block(overrides = {}) {
  return {
    stop_sell_id: 'b1',
    room_id: 'r1',
    room_number: '101',
    room_type: 'single',
    stop_date: '2026-10-15',
    stop_end_date: '2026-10-17',
    nights: ['2026-10-15', '2026-10-16', '2026-10-17'],
    is_whole_type: false,
    reason: 'Renovation',
    ...overrides,
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

async function openTab(wrapper, key) {
  wrapper.vm.switchTab(key)
  await flushPromises()
}

/**
 * Manager review: "It is not possible to stop sell a specific room, for example
 * room 5", "how to see a calendar of stop sell", and "stop sell from 15 to 20
 * would be difficult."
 */
describe('RoomListPage stop-sell calendar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    index.mockReset().mockResolvedValue(roomsPage())
    inventory.mockReset().mockResolvedValue({ data: { types: [], rooms: [] } })
    updateRates.mockReset().mockResolvedValue({ data: {} })
    storeStopSell.mockReset().mockResolvedValue({ data: { blocks: [] } })
    destroyStopSell.mockReset().mockResolvedValue({ data: {} })
    stopSell.mockReset().mockResolvedValue({ data: { blocks: [block()] } })
  })

  it('asks for the calendar window rather than every block', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    const params = stopSell.mock.calls[0][0]
    expect(params.from_date).toBeTruthy()
    expect(params.to_date).toBeTruthy()
  })

  it('paints every night a range block covers, not just its start date', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    // The window is driven by the block's own dates so the assertion is stable.
    wrapper.vm.calFrom = '2026-10-15'
    wrapper.vm.calTo = '2026-10-17'
    await wrapper.vm.loadBlocks()
    await flushPromises()

    expect(wrapper.vm.calDays).toEqual(['2026-10-15', '2026-10-16', '2026-10-17'])
    // All three nights are stopped for room 101.
    expect(wrapper.vm.isStoppedOn('r1', '2026-10-15')).toBe(true)
    expect(wrapper.vm.isStoppedOn('r1', '2026-10-16')).toBe(true)
    expect(wrapper.vm.isStoppedOn('r1', '2026-10-17')).toBe(true)
  })

  it('leaves the other rooms of the same type sellable', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')
    wrapper.vm.calFrom = '2026-10-15'
    wrapper.vm.calTo = '2026-10-17'
    await wrapper.vm.loadBlocks()
    await flushPromises()

    // 102 shares the "single" type with 101 but is not itself stopped.
    expect(wrapper.vm.isStoppedOn('r2', '2026-10-15')).toBe(false)
    expect(wrapper.vm.isStoppedOn('r3', '2026-10-15')).toBe(false)
  })

  it('resolves a whole-type block onto every room of that type', async () => {
    stopSell.mockResolvedValue({
      data: {
        blocks: [
          block({ room_id: null, room_number: null, is_whole_type: true, room_type: 'single', nights: ['2026-10-15'] }),
        ],
      },
    })
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')
    wrapper.vm.calFrom = '2026-10-15'
    wrapper.vm.calTo = '2026-10-15'
    await wrapper.vm.loadBlocks()
    await flushPromises()

    // Both singles are stopped; the suite is not.
    expect(wrapper.vm.isStoppedOn('r1', '2026-10-15')).toBe(true)
    expect(wrapper.vm.isStoppedOn('r2', '2026-10-15')).toBe(true)
    expect(wrapper.vm.isStoppedOn('r3', '2026-10-15')).toBe(false)
  })

  it('posts the selected rooms and the date range', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    wrapper.vm.stopForm.room_id = ['r1', 'r2']
    wrapper.vm.stopForm.start_date = '2026-10-15'
    wrapper.vm.stopForm.end_date = '2026-10-20'
    wrapper.vm.stopForm.reason = 'Renovation'
    await wrapper.vm.placeStopSell()
    await flushPromises()

    expect(storeStopSell).toHaveBeenCalledWith({
      room_ids: ['r1', 'r2'],
      start_date: '2026-10-15',
      end_date: '2026-10-20',
      reason: 'Renovation',
    })
  })

  it('omits end_date for a single night so the backend stores one night', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    wrapper.vm.stopForm.room_id = ['r1']
    wrapper.vm.stopForm.start_date = '2026-10-15'
    wrapper.vm.stopForm.end_date = '2026-10-15'
    await wrapper.vm.placeStopSell()
    await flushPromises()

    const body = storeStopSell.mock.calls[0][0]
    expect(body).not.toHaveProperty('end_date')
  })

  it('accumulates rooms in the picker and clears the form after saving', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    wrapper.vm.stopForm.pick = 'r1'
    wrapper.vm.addStopRoom()
    wrapper.vm.stopForm.pick = 'r2'
    wrapper.vm.addStopRoom()
    // Adding the same room twice must not duplicate it.
    wrapper.vm.stopForm.pick = 'r1'
    wrapper.vm.addStopRoom()
    expect(wrapper.vm.stopForm.room_id).toEqual(['r1', 'r2'])
    // The picker stops offering a room that is already queued.
    expect(wrapper.vm.roomPickerOptions.map((o) => o.value)).toEqual(['r3'])

    wrapper.vm.stopForm.start_date = '2026-10-15'
    await wrapper.vm.placeStopSell()
    await flushPromises()

    expect(wrapper.vm.stopForm.room_id).toEqual([])
    expect(wrapper.vm.stopForm.start_date).toBe('')
  })

  it('removes a queued room without touching the others', async () => {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    wrapper.vm.stopForm.room_id = ['r1', 'r2']
    wrapper.vm.removeStopRoom('r1')
    expect(wrapper.vm.stopForm.room_id).toEqual(['r2'])
  })
})
