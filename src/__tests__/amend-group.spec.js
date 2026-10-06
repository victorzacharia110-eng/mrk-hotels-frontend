import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HotelDashboard from '@/pages/dashboards/HotelDashboard.vue'
import i18n from '@/locales/i18n'

const api = vi.hoisted(() => {
  const mk = () =>
    new Proxy(
      {},
      {
        get(target, prop) {
          if (typeof prop !== 'string') return undefined
          if (!(prop in target)) target[prop] = vi.fn().mockResolvedValue({ data: {} })
          return target[prop]
        },
      },
    )
  return {
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

const GROUP_ROOMS = [
  { reservation_id: 'r1', room_id: 'rm1', room_number: '101', status: 'confirmed', is_primary: true, guest_name: 'Amina Hassan' },
  { reservation_id: 'r2', room_id: 'rm2', room_number: '102', is_primary: false, guest_name: 'Lot 2' },
]

let wrapper

async function mountDashboard() {
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: 'hotel_admin', full_name: 'Manager' }
  wrapper = mount(HotelDashboard, { global: { plugins: [i18n] } })
  await wrapper.vm.$nextTick()
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
})

beforeEach(() => {
  api.reservationApi.update.mockClear()
  api.reservationApi.groupAmend.mockClear()
})

describe('Amend stay for a grouped booking', () => {
  it('applies the shared dates to every room in the group, without moving rooms', async () => {
    await mountDashboard()
    wrapper.vm.reservations = [
      { reservation_id: 'r1', room_number: '101', group_id: 'g1', is_primary: true, group: { rooms: GROUP_ROOMS } },
    ]
    wrapper.vm.activeBar = {
      id: 'r1',
      rawStatus: 'confirmed',
      label: 'Amina Hassan',
      roomId: 'rm1',
      guest_name: 'Amina Hassan',
    }
    wrapper.vm.folio = {
      reservation: {
        reservation_id: 'r1',
        first_name: 'Amina',
        last_name: 'Hassan',
        room_id: 'rm1',
        check_in_date: '2026-11-01',
        check_out_date: '2026-11-03',
        guest_phone: '',
      },
    }
    await wrapper.vm.$nextTick()

    wrapper.vm.openAmendModal(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.amendIsGroup).toBe(true)
    expect(wrapper.vm.amendGroupRooms).toHaveLength(2)

    wrapper.vm.amendForm.check_out_date = '2026-11-05'
    expect(wrapper.vm.amendIsGroup).toBe(true)
    expect(wrapper.vm.amendGroupRooms.map((r) => r.reservation_id)).toEqual(['r1', 'r2'])
    await wrapper.vm.submitAmend()

    expect(api.reservationApi.groupAmend).toHaveBeenCalledTimes(1)
    const [anchorId, payload] = api.reservationApi.groupAmend.mock.calls[0]
    expect(anchorId).toBe('r1')
    expect(payload.check_out_date).toBe('2026-11-05')
    expect(payload.room_ids.slice().sort()).toEqual(['r1', 'r2'])
    expect(payload).not.toHaveProperty('room_id')
    expect(api.reservationApi.update).not.toHaveBeenCalled()
  })

  it('edits just the one room for a standalone stay', async () => {
    await mountDashboard()
    wrapper.vm.reservations = [{ reservation_id: 's1', room_number: '201', group_id: null, group: null }]
    wrapper.vm.activeBar = { id: 's1', rawStatus: 'confirmed', label: 'Solo Guest', roomId: 'rm9' }
    wrapper.vm.folio = {
      reservation: {
        reservation_id: 's1',
        first_name: 'Solo',
        last_name: 'Guest',
        room_id: 'rm9',
        check_in_date: '2026-11-01',
        check_out_date: '2026-11-03',
        guest_phone: '',
      },
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.amendIsGroup).toBe(false)

    wrapper.vm.openAmendModal(false)
    await wrapper.vm.$nextTick()
    wrapper.vm.amendForm.check_out_date = '2026-11-05'
    await wrapper.vm.submitAmend()

    expect(api.reservationApi.update).toHaveBeenCalledTimes(1)
    expect(api.reservationApi.update.mock.calls[0][0]).toBe('s1')
  })

  it('amends only the rooms the desk ticks in the group grid', async () => {
    await mountDashboard()
    wrapper.vm.reservations = [
      { reservation_id: 'r1', room_number: '101', group_id: 'g1', is_primary: true, group: { rooms: GROUP_ROOMS } },
    ]
    wrapper.vm.activeBar = { id: 'r1', rawStatus: 'confirmed', label: 'Amina Hassan', roomId: 'rm1' }
    wrapper.vm.folio = {
      reservation: {
        reservation_id: 'r1',
        first_name: 'Amina',
        last_name: 'Hassan',
        room_id: 'rm1',
        check_in_date: '2026-11-01',
        check_out_date: '2026-11-03',
        guest_phone: '',
      },
    }
    await wrapper.vm.$nextTick()

    wrapper.vm.openAmendModal(false)
    await wrapper.vm.$nextTick()

    // Untick the primary so only the second room is amended.
    wrapper.vm.amendSelectedRoomIds = ['r2']
    wrapper.vm.amendForm.check_out_date = '2026-11-06'
    await wrapper.vm.submitAmend()

    expect(api.reservationApi.groupAmend).toHaveBeenCalledTimes(1)
    const [anchorId, payload] = api.reservationApi.groupAmend.mock.calls[0]
    expect(anchorId).toBe('r1')
    expect(payload.room_ids).toEqual(['r2'])
  })
})