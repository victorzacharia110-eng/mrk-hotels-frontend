import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const roomIndex = vi.fn()
const reportOccupancy = vi.fn()
const reportRevenue = vi.fn()
const settingsShow = vi.fn()

vi.mock('@/api', () => ({
  roomApi: { index: (...a) => roomIndex(...a), counts: () => roomIndex(), availability: () => roomIndex() },
  reservationApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  guestApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  housekeepingApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  laundryApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  invoiceApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  inventoryApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  paymentApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  companyApi: { index: () => Promise.resolve({ data: { data: [] } }) },
  hotelSettingsApi: { show: (...a) => settingsShow(...a) },
  reportApi: {
    occupancy: (...a) => reportOccupancy(...a),
    revenue: (...a) => reportRevenue(...a),
  },
}))

const can = vi.fn()
const user = { user_role: 'manager' }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user, can, permissions: [], canManage: () => true }),
}))

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ alerts: [], add: vi.fn(), remove: vi.fn() }),
}))

const HotelDashboard = (await import('@/pages/dashboards/HotelDashboard.vue')).default

function mountDashboard() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(HotelDashboard, { global: { plugins: [pinia, i18n] } })
}

describe('HotelDashboard — management summary band', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'en'
    can.mockReturnValue(true)
    roomIndex.mockResolvedValue({ data: { data: [] } })
    settingsShow.mockResolvedValue({ data: { hotel: {} } })
    reportOccupancy.mockResolvedValue({
      data: { occupancy: [{ date: '2026-09-29', occupied_rooms: 8, occupancy_rate: 80 }] },
    })
    reportRevenue.mockResolvedValue({
      data: {
        room_revenue: 125000,
        daily: [
          { date: '2026-09-29', total: 90000, count: 3 },
          { date: '2026-09-29', total: 40000, count: 2 },
        ],
      },
    })
  })

  it('shows today’s occupancy and takings to a manager', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.find('.mgmt-band').exists()).toBe(true)
    // 8 occupied at 80% implies 10 rooms.
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.text()).toContain('8 / 10')
    // Room revenue and payments collected are separate figures.
    expect(wrapper.text()).toContain('125,000')
    expect(wrapper.text()).toContain('130,000')
  })

  it('requests the summary for the reporting roles only', async () => {
    can.mockReturnValue(false)
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.find('.mgmt-band').exists()).toBe(false)
    // A receptionist should not pay for two extra requests on every load.
    expect(reportOccupancy).not.toHaveBeenCalled()
    expect(reportRevenue).not.toHaveBeenCalled()
  })

  it('still renders the stay view when the reports fail', async () => {
    reportOccupancy.mockRejectedValue(new Error('boom'))
    reportRevenue.mockRejectedValue(new Error('boom'))

    const wrapper = mountDashboard()
    await flushPromises()

    // The grid is the page; a failed band must not make it look broken.
    expect(wrapper.find('.mgmt-band').exists()).toBe(true)
    expect(wrapper.text()).toContain('Summary unavailable')
    expect(wrapper.find('.sv-toolbar').exists()).toBe(true)
  })

  it('does not divide by zero when the hotel is empty', async () => {
    reportOccupancy.mockResolvedValue({
      data: { occupancy: [{ date: '2026-09-29', occupied_rooms: 0, occupancy_rate: 0 }] },
    })

    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('0 / 0')
  })
})
