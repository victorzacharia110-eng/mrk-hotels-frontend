import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StayCalendar from '@/components/StayCalendar.vue'
import i18n from '@/locales/i18n'

/**
 * The Rooms > Inventory tab now shows the dashboard's tape chart. These lock the
 * two promises the reception review made about it: the business date is the
 * first day column, and stays draw the same coloured bars the dashboard uses
 * (green in-house, purple due-out).
 */

const rooms = [
  { room_id: 1, room_number: '101', room_type: 'single', status: 'occupied', price_per_night: 100000 },
  { room_id: 2, room_number: '102', room_type: 'single', status: 'available', price_per_night: 100000 },
]

const BUSINESS = '2026-10-09'

let wrapper
afterEach(() => wrapper?.unmount())

function mountCal(reservations) {
  wrapper = mount(StayCalendar, {
    props: { rooms, reservations, businessDate: BUSINESS },
    global: { plugins: [i18n] },
  })
  return wrapper
}

describe('StayCalendar', () => {
  it('shows the business date as the corner label and the first day column', async () => {
    mountCal([])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sv-bizdate-text').text()).toBe('09/10/2026')

    const heads = wrapper.findAll('.sv-day-head')
    expect(heads).toHaveLength(14)
    // 9 Oct 2026 is a Friday and carries the "today"/business highlight.
    expect(heads[0].text().toLowerCase()).toContain('oct')
    expect(heads[0].classes()).toContain('today')
  })

  it('paints an in-house stay green and a due-out stay purple', async () => {
    mountCal([
      {
        reservation_id: 1,
        room: { room_id: 1 },
        guest_name: 'Grace Mollel',
        arrival_date: '2026-10-07',
        departure_date: '2026-10-12',
        status: 'checked_in',
      },
      {
        reservation_id: 2,
        room: { room_id: 2 },
        guest_name: 'Swaum Hamis',
        arrival_date: '2026-10-05',
        departure_date: '2026-10-09',
        status: 'checked_in',
      },
    ])
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.sv-bar.bar-green').exists()).toBe(true)
    expect(wrapper.find('.sv-bar.bar-purple').exists()).toBe(true)
    expect(wrapper.find('.sv-bar.bar-green .sv-bar-label').text()).toContain('Grace')
    expect(wrapper.find('.sv-bar.bar-purple .sv-bar-label').text()).toContain('Swaum')
  })

  it('keeps a plain reservation red until the desk checks it in', async () => {
    mountCal([
      {
        reservation_id: 3,
        room: { room_id: 1 },
        guest_name: 'Amina Juma',
        arrival_date: '2026-10-10',
        departure_date: '2026-10-13',
        status: 'confirmed',
      },
    ])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.sv-bar.bar-red').exists()).toBe(true)
    expect(wrapper.find('.sv-bar.bar-green').exists()).toBe(false)
  })

  it('renders the per-day availability and occupancy footers', async () => {
    mountCal([])
    await wrapper.vm.$nextTick()
    const availFooter = wrapper.findAll('.sv-footer-day.sv-sticky-avail')
    expect(availFooter).toHaveLength(14)
    // Two bookable rooms, none occupied → 2 available on the first night.
    expect(availFooter[0].text()).toBe('2')
    expect(wrapper.findAll('.sv-occ').length).toBe(14)
  })
})
