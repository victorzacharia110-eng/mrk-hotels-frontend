import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HotelDashboard from '@/pages/dashboards/HotelDashboard.vue'
import i18n from '@/locales/i18n'
import { roomOccupiedToday } from '@/utils/roomOccupancy'

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

const iso = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

let wrapper

async function mountDashboard() {
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  auth.user = { user_role: 'receptionist', full_name: 'Receptionist Vanessa' }
  for (const fn of api.created) fn.mockReset().mockResolvedValue({ data: {} })
  wrapper = mount(HotelDashboard, { global: { plugins: [i18n] } })
  await flushPromises()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

async function fillBoard(rooms, reservations) {
  wrapper.vm.rooms = rooms
  wrapper.vm.reservations = reservations
  await flushPromises()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

describe('roomOccupiedToday', () => {
  const today = startOfToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  it('is false when the room has NO checked_in stay for today even if rooms.status says occupied', () => {
    const rooms = [{ room_id: 1, status: 'occupied' }]
    const reservations = [
      // checked_in but already departed yesterday → not in-house today
      {
        reservation_id: 1,
        room: { room_id: 1 },
        guest_name: 'Amina Hassan',
        arrival_date: iso(new Date(today.getTime() - 2 * 86400000)),
        departure_date: iso(new Date(today.getTime() - 86400000)),
        status: 'checked_in',
      },
    ]
    expect(roomOccupiedToday(reservations, rooms[0].room_id, today)).toBe(false)
  })

  it('is false when the only overlap today is a pending/confirmed reservation', () => {
    const todayIso = iso(today)
    const tomorrowIso = iso(tomorrow)
    expect(
      roomOccupiedToday(
        [
          { reservation_id: 2, room: { room_id: 7 }, status: 'confirmed', arrival_date: todayIso, departure_date: tomorrowIso },
        ],
        7,
        today,
      ),
    ).toBe(false)
  })

  it('is true when a checked_in reservation overlaps today and exposes the guest', () => {
    const stay = {
      reservation_id: 3,
      room: { room_id: 9 },
      guest_name: 'Juma Bakari',
      arrival_date: iso(today),
      departure_date: iso(tomorrow),
      status: 'checked_in',
    }
    expect(roomOccupiedToday([stay], 9, today)).toBe(true)
    expect(stay.guest_name).toMatch(/^Juma Bakari$/)
  })
})

describe('stay-view dot board occupancy', () => {
  const today = startOfToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  it('keeps the red dot OFF a room whose rooms.status is stale "occupied" but has no checked_in stay (bug A)', async () => {
    await mountDashboard()
    await fillBoard(
      [
        { room_id: 1, room_number: '101', room_type: 'single', status: 'occupied', price_per_night: 100 },
        { room_id: 2, room_number: '102', room_type: 'single', status: 'available', price_per_night: 100 },
      ],
      [
        {
          reservation_id: 1,
          room: { room_id: 1, room_number: '101' },
          guest_name: 'Amina Hassan',
          arrival_date: iso(tomorrow),
          departure_date: iso(new Date(tomorrow.getTime() + 86400000)),
          status: 'confirmed',
        },
      ],
    )

    expect(wrapper.vm.roomDotOccupied(wrapper.vm.rooms[0])).toBe(false)
    const rows = wrapper.findAll('.sv-room-cell')
    const row101 = rows.find((r) => r.find('.sv-room-number').text() === '101')
    expect(row101).toBeTruthy()
    const dot = row101.find('.sv-room-dot')
    expect(dot.classes()).toContain('available')
    expect(dot.classes()).not.toContain('occupied')
  })

  it('draws the red dot WITH the occupant name when a checked_in stay overlaps today (bug B)', async () => {
    await mountDashboard()
    await fillBoard(
      [
        { room_id: 1, room_number: '101', room_type: 'single', status: 'occupied', price_per_night: 100 },
      ],
      [
        {
          reservation_id: 1,
          room: { room_id: 1, room_number: '101' },
          guest_name: 'Amina Hassan',
          arrival_date: iso(today),
          departure_date: iso(tomorrow),
          status: 'checked_in',
        },
      ],
    )

    expect(wrapper.vm.roomDotOccupied(wrapper.vm.rooms[0])).toBe(true)
    const row = wrapper.findAll('.sv-room-cell').find((r) => r.find('.sv-room-number').text() === '101')
    expect(row).toBeTruthy()
    const dot = row.find('.sv-room-dot')
    expect(dot.classes()).toContain('occupied')
    expect(dot.text()).not.toContain('Amina Hassan')
    expect(dot.attributes('title')).toBe('Amina Hassan')
  })
})