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

describe('stay-view bar deduplication', () => {
  const today = startOfToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  async function withReservations(reservations) {
    await mountDashboard()
    await fillBoard([{ room_id: 1, room_number: '101', room_type: 'single', status: 'available', price_per_night: 100 }], reservations)
    return wrapper.vm.barsByRoom
  }

  it('draws ONE bar for overlapping duplicate bookings of the same guest in the same room', async () => {
    const todayIso = iso(today)
    const tomorrowIso = iso(tomorrow)
    const bars = await withReservations([
      { reservation_id: 1, guest_id: null, guest_name: 'Grace Mollel', room: { room_id: 1 }, arrival_date: todayIso, departure_date: tomorrowIso, status: 'pending', total_amount: 600000 },
      { reservation_id: 2, guest_id: null, guest_name: 'Grace Mollel', room: { room_id: 1 }, arrival_date: todayIso, departure_date: tomorrowIso, status: 'confirmed', total_amount: 1650000 },
    ])
    expect(bars[1]).toHaveLength(1)
    expect(bars[1][0].id).toBe(2)
  })

  it('keeps separate bars for the same guest staying in different rooms', async () => {
    const todayIso = iso(today)
    const tomorrowIso = iso(tomorrow)
    await mountDashboard()
    await fillBoard(
      [
        { room_id: 1, room_number: '101', room_type: 'single', status: 'available', price_per_night: 100 },
        { room_id: 2, room_number: '102', room_type: 'single', status: 'available', price_per_night: 100 },
      ],
      [
        { reservation_id: 1, guest_id: null, guest_name: 'Amina Juma', room: { room_id: 1 }, arrival_date: todayIso, departure_date: tomorrowIso, status: 'pending', total_amount: 700000 },
        { reservation_id: 2, guest_id: null, guest_name: 'Amina Juma', room: { room_id: 2 }, arrival_date: todayIso, departure_date: tomorrowIso, status: 'confirmed', total_amount: 800000 },
      ],
    )
    expect(wrapper.vm.barsByRoom[1]).toHaveLength(1)
    expect(wrapper.vm.barsByRoom[2]).toHaveLength(1)
  })

  it('drops the split-folio twin so the in-house bar is the one that shows', async () => {
    const tomorrowIso = iso(tomorrow)
    const bars = await withReservations([
      { reservation_id: 1, guest_id: 7, guest_name: 'Juma Bakari', room: { room_id: 1 }, arrival_date: iso(new Date(today.getTime() - 86400000)), departure_date: tomorrowIso, status: 'pending', total_amount: 900000 },
      { reservation_id: 2, guest_id: 7, guest_name: 'Juma Bakari', room: { room_id: 1 }, arrival_date: iso(new Date(today.getTime() - 86400000)), departure_date: tomorrowIso, status: 'confirmed', total_amount: 0, notes: 'Split folio of Juma Bakari' },
    ])
    expect(bars[1]).toHaveLength(1)
    expect(bars[1][0].id).toBe(1)
  })

  it('still draws one bar when the only stay in a room is a split folio', async () => {
    const todayIso = iso(today)
    const tomorrowIso = iso(tomorrow)
    const bars = await withReservations([
      { reservation_id: 9, guest_id: null, guest_name: 'Lot Two', room: { room_id: 1 }, arrival_date: todayIso, departure_date: tomorrowIso, status: 'confirmed', total_amount: 0, notes: 'Split folio of a stay' },
    ])
    expect(bars[1]).toHaveLength(1)
    expect(bars[1][0].id).toBe(9)
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

describe('due-out residents on the stay view', () => {
  const today = startOfToday()
  const daysAgo = (n) => iso(new Date(today.getTime() - n * 86400000))

  const occupiedRoom = {
    room_id: 1,
    room_number: '101',
    room_type: 'single',
    status: 'occupied',
    price_per_night: 100,
  }

  it('keeps an overdue checked-in resident on the tape and paints the bar purple', async () => {
    await mountDashboard()
    await fillBoard([occupiedRoom], [
      {
        reservation_id: 1,
        room: { room_id: 1, room_number: '101' },
        guest_name: 'Swaum Hamis',
        arrival_date: daysAgo(3),
        departure_date: daysAgo(1),
        status: 'checked_in',
        total_amount: 200000,
      },
    ])
    const bars = wrapper.vm.barsByRoom[1]
    expect(bars).toHaveLength(1)
    expect(bars[0].colorClass).toBe('bar-purple')
    expect(bars[0].span).toBeGreaterThan(0)
  })

  it('paints a stay due out exactly on the business date purple', async () => {
    await mountDashboard()
    await fillBoard([occupiedRoom], [
      {
        reservation_id: 2,
        room: { room_id: 1, room_number: '101' },
        guest_name: 'Grace Mollel',
        arrival_date: daysAgo(2),
        departure_date: daysAgo(0),
        status: 'checked_in',
        total_amount: 200000,
      },
    ])
    const bars = wrapper.vm.barsByRoom[1]
    expect(bars).toHaveLength(1)
    expect(bars[0].colorClass).toBe('bar-purple')
  })

  it('still hides a non-resident stay that fully ended before the window', async () => {
    await mountDashboard()
    await fillBoard([occupiedRoom], [
      {
        reservation_id: 3,
        room: { room_id: 1, room_number: '101' },
        guest_name: 'Past Guest',
        arrival_date: daysAgo(4),
        departure_date: daysAgo(2),
        status: 'checked_out',
        total_amount: 200000,
      },
    ])
    expect(wrapper.vm.barsByRoom[1] || []).toHaveLength(0)
  })

  it('counts overdue residents in the due-out and occupied pills', async () => {
    await mountDashboard()
    await fillBoard([occupiedRoom], [
      {
        reservation_id: 4,
        room: { room_id: 1, room_number: '101' },
        guest_name: 'Swaum Hamis',
        arrival_date: daysAgo(3),
        departure_date: daysAgo(1),
        status: 'checked_in',
        total_amount: 200000,
      },
    ])
    const dueOut = wrapper.vm.pills.find((p) => p.key === 'dueout')
    expect(dueOut.count).toBe(1)
    const occupied = wrapper.vm.pills.find((p) => p.key === 'occupied')
    expect(occupied.count).toBe(1)
  })
})