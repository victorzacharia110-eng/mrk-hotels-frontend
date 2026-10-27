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

const ROOMS = [
  { room_id: 'rm1', room_number: '101', room_type: 'standard', status: 'vacant', price_per_night: 100, stop_sell: false },
  { room_id: 'rm2', room_number: '102', room_type: 'deluxe', status: 'vacant', price_per_night: 150, stop_sell: false },
]

let wrapper

async function mountDashboard() {
  setActivePinia(createPinia())
  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: 'hotel_admin', full_name: 'Manager' }
  wrapper = mount(HotelDashboard, { global: { plugins: [i18n] }, attachTo: document.body })
  await flushPromises()
}

function openGroupBooking() {
  wrapper.vm.rooms = ROOMS
  wrapper.vm.tapeReservations = []
  wrapper.vm.openNewBooking()
  wrapper.vm.bookingForm.booking_type = 'group'
}

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

beforeEach(() => {
  i18n.global.locale.value = 'en'
})

describe('Group booking room picker', () => {
  it('opens the vacant/selected rooms in a modal instead of a dropdown', async () => {
    await mountDashboard()
    openGroupBooking()
    await wrapper.vm.$nextTick()

    const trigger = document.body.querySelector('[data-testid="group-room-picker-trigger"]')
    expect(trigger).not.toBeNull()
    expect(document.body.querySelector('.sv-room-picker-modal')).toBeNull()

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const modal = document.body.querySelector('.sv-room-picker-modal')
    expect(modal).not.toBeNull()
    expect(modal.querySelectorAll('.sv-group-item input[type="checkbox"]')).toHaveLength(2)
  })

  it('keeps the selected rooms and the primary room valid in the modal', async () => {
    await mountDashboard()
    openGroupBooking()
    await wrapper.vm.$nextTick()

    wrapper.vm.toggleRoomSelection({ value: 'rm1' })
    wrapper.vm.toggleRoomSelection({ value: 'rm2' })
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.roomSelectionsArray.map((r) => r.room_id)).toEqual(['rm1', 'rm2'])
    expect(wrapper.vm.bookingForm.primary_room_id).toBe('rm1')

    wrapper.vm.setPrimaryRoom('rm2')
    wrapper.vm.removeRoomFromSelection(1)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.roomSelectionsArray.map((r) => r.room_id)).toEqual(['rm1'])
    expect(wrapper.vm.bookingForm.primary_room_id).toBe('rm1')
  })
})
