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
const authModule = await import('@/stores/auth')

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

/**
 * Mounts the page. `canEdit` is the 80-level permission that makes the calendar
 * cells live, so a manager is signed in by default; pass a receptionist to test
 * the read-only view.
 */
function build(user = { user_role: 'hotel_admin' }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const { useAuthStore } = authModule
  useAuthStore().user = user
  return mount(RoomListPage, {
    global: {
      plugins: [pinia, i18n],
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
    index.mockReset().mockResolvedValue(roomsPage())
    inventory.mockReset().mockResolvedValue({ data: { types: [], rooms: [] } })
    updateRates.mockReset().mockResolvedValue({ data: {} })
    storeStopSell.mockReset().mockResolvedValue({ data: { blocks: [] } })
    destroyStopSell.mockReset().mockResolvedValue({ data: {} })
    stopSell.mockReset().mockResolvedValue({ data: { blocks: [block()] } })
  })

  it('says so when a block could not be read', async () => {
    // A block the server cannot read is left off the grid. Without this the
    // room would read as sellable while actually being blocked, which is the
    // one mistake this screen must not make.
    stopSell.mockResolvedValue({
      data: {
        blocks: [block()],
        warnings: [{ stop_sell_id: 'b2', reason: 'This block could not be read and is not shown on the calendar.' }],
      },
    })
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    expect(wrapper.find('.alert-warning').exists()).toBe(true)
    expect(wrapper.find('.alert-warning').text()).toContain('1')
    // The rooms that did load are still drawn.
    expect(wrapper.findAll('.cal-cell').length).toBeGreaterThan(0)
  })

  it('shows no warning banner when everything loaded', async () => {
    stopSell.mockResolvedValue({ data: { blocks: [block()], warnings: [] } })
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')

    expect(wrapper.find('.alert-warning').exists()).toBe(false)
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

  /**
   * Manager review item 6: "You can set [a] calendar dashboard with rooms in
   * rows on the left side like the one in the receptionist dashboard to easily
   * set STOP SELL if it covers more than one day."
   *
   * The grid already had rooms in rows, but it was only a picture of the stop-
   * sell — setting a block still meant using the form above it. These hold the
   * calendar as a way of working: click the first night, click the last, and
   * the run becomes one block.
   */

  /** Opens the tab over a fixed six-night window and returns the rows. */
  async function calendar() {
    const wrapper = build()
    await flushPromises()
    await openTab(wrapper, 'stop-sell')
    wrapper.vm.calFrom = '2026-10-15'
    wrapper.vm.calTo = '2026-10-20'
    await wrapper.vm.loadBlocks()
    await flushPromises()
    return wrapper
  }

  /** The calendar row for a room number. */
  function rowFor(wrapper, roomNumber) {
    return wrapper.findAll('tbody tr').find((r) => r.text().includes(roomNumber))
  }

  it('places one range block from two clicks on a row', async () => {
    const wrapper = await calendar()

    const cells = rowFor(wrapper, '102').findAll('.cal-cell')
    await cells[0].trigger('click') // 15th
    await cells[3].trigger('click') // 18th

    // The pending range is stated before anything is saved, so the manager can
    // see the nights they just chose.
    expect(wrapper.find('.cal-pick-bar').text()).toContain('4')

    await wrapper.find('.cal-pick-bar .btn-primary').trigger('click')
    await flushPromises()

    // One block covering the run — not one block per night.
    expect(storeStopSell).toHaveBeenCalledTimes(1)
    expect(storeStopSell).toHaveBeenCalledWith({
      room_ids: ['r2'],
      start_date: '2026-10-15',
      end_date: '2026-10-18',
    })
  })

  it('sends no end_date when only one night is chosen', async () => {
    const wrapper = await calendar()

    await rowFor(wrapper, '102').findAll('.cal-cell')[2].trigger('click')
    await wrapper.find('.cal-pick-bar .btn-primary').trigger('click')
    await flushPromises()

    const body = storeStopSell.mock.calls[0][0]
    expect(body.start_date).toBe('2026-10-17')
    expect(body).not.toHaveProperty('end_date')
  })

  it('extends the range while dragging across the nights', async () => {
    const wrapper = await calendar()

    const cells = rowFor(wrapper, '102').findAll('.cal-cell')
    await cells[1].trigger('mousedown')
    await cells[4].trigger('mouseenter') // dragged over

    await wrapper.find('.cal-pick-bar .btn-primary').trigger('click')
    await flushPromises()

    // A manager pointing at a bar on the calendar does not stop at a cell edge.
    expect(storeStopSell.mock.calls[0][0]).toMatchObject({
      start_date: '2026-10-16',
      end_date: '2026-10-19',
    })
  })

  it('keeps a drag inside the row it started in', async () => {
    const wrapper = await calendar()

    await rowFor(wrapper, '102').findAll('.cal-cell')[1].trigger('mousedown')
    // Wandering over another room's nights must not quietly block them too.
    await rowFor(wrapper, '201').findAll('.cal-cell')[5].trigger('mouseenter')

    await wrapper.find('.cal-pick-bar .btn-primary').trigger('click')
    await flushPromises()

    expect(storeStopSell.mock.calls[0][0].room_ids).toEqual(['r2'])
  })

  it('orders the range when the later night is clicked first', async () => {
    const wrapper = await calendar()

    const cells = rowFor(wrapper, '102').findAll('.cal-cell')
    await cells[4].trigger('click')
    await cells[1].trigger('click')

    await wrapper.find('.cal-pick-bar .btn-primary').trigger('click')
    await flushPromises()

    // Clicking backwards must not send a negative range.
    expect(storeStopSell.mock.calls[0][0]).toMatchObject({
      start_date: '2026-10-16',
      end_date: '2026-10-19',
    })
  })

  it('lifts a stopped night by clicking it again', async () => {
    const wrapper = await calendar()

    // Block b1 covers 101 on the 15th–17th.
    await rowFor(wrapper, '101').findAll('.cal-cell')[2].trigger('click')
    await flushPromises()

    // Undo is the same gesture as doing it, so there is no separate "delete"
    // step to discover.
    expect(destroyStopSell).toHaveBeenCalledWith('b1')
    expect(storeStopSell).not.toHaveBeenCalled()
  })

  it('lifts a whole-type block so the night really clears', async () => {
    stopSell.mockResolvedValue({
      data: {
        blocks: [block({ room_id: null, room_number: null, is_whole_type: true, room_type: 'single', nights: ['2026-10-16'] })],
      },
    })
    const wrapper = await calendar()

    // The block belongs to no single room, so lifting it must still happen —
    // otherwise the cell stays red and the manager thinks it failed.
    await rowFor(wrapper, '102').findAll('.cal-cell')[1].trigger('click')
    await flushPromises()

    expect(destroyStopSell).toHaveBeenCalledWith('b1')
  })

  it('will not select a night that is already stopped', async () => {
    const wrapper = await calendar()

    const cells = rowFor(wrapper, '101').findAll('.cal-cell')
    const stopped = cells[2]
    expect(stopped.classes()).toContain('cal-stopped')

    // Choosing a free night elsewhere on the row must not disguise the block.
    await cells[5].trigger('click')
    expect(stopped.classes()).toContain('cal-stopped')
    expect(stopped.classes()).not.toContain('cal-picked')

    await wrapper.find('.cal-pick-bar .btn-primary').trigger('click')
    await flushPromises()
    // The saved range skips the already-stopped night rather than overlapping it.
    expect(storeStopSell.mock.calls[0][0]).toMatchObject({ start_date: '2026-10-20' })
  })

  it('marks a pending night apart from a stopped one', async () => {
    const wrapper = await calendar()

    const cells = rowFor(wrapper, '102').findAll('.cal-cell')
    await cells[0].trigger('click')
    await cells[1].trigger('click')

    const cls = (i) => cells[i].classes()
    // Chosen nights carry the brand colour; 101's blocked nights stay danger red.
    expect(cls(0)).toContain('cal-picked')
    expect(cls(1)).toContain('cal-picked')
    expect(cls(2)).toContain('cal-free')
  })

  it('discards a pending range when cancelled', async () => {
    const wrapper = await calendar()

    await rowFor(wrapper, '102').findAll('.cal-cell')[0].trigger('click')
    expect(wrapper.find('.cal-pick-bar').exists()).toBe(true)

    await wrapper.find('.cal-pick-actions .btn-secondary').trigger('click')
    expect(wrapper.find('.cal-pick-bar').exists()).toBe(false)
    expect(storeStopSell).not.toHaveBeenCalled()
  })

  it('leaves the calendar read-only for a role that cannot edit', async () => {
    const wrapper = build({ user_role: 'receptionist' })
    await flushPromises()
    await openTab(wrapper, 'stop-sell')
    wrapper.vm.calFrom = '2026-10-15'
    wrapper.vm.calTo = '2026-10-20'
    await wrapper.vm.loadBlocks()
    await flushPromises()

    // A receptionist can see the picture but must not be able to change it.
    await rowFor(wrapper, '102').findAll('.cal-cell')[0].trigger('click')
    expect(wrapper.find('.cal-pick-bar').exists()).toBe(false)
    expect(storeStopSell).not.toHaveBeenCalled()
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
