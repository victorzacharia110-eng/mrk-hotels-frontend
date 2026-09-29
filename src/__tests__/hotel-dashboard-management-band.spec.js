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
  // Still mocked so a reintroduced call is observable rather than a hard failure.
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

/**
 * The front-desk stay view used to lead management with a "Today at a glance"
 * card band (occupancy, room revenue, total revenue) fetched only for the
 * reporting roles. Management now land on the operational overview at
 * /app/overview, which reports those same figures properly — so the band on
 * this page duplicated the landing page and is gone.
 *
 * These tests guard the removal: the cards must not come back, and the two
 * report requests they needed must not start again either.
 */
describe('HotelDashboard — no management card band', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'en'
    can.mockReturnValue(true) // manager: passes every level check
    roomIndex.mockResolvedValue({ data: { data: [] } })
    settingsShow.mockResolvedValue({ data: { hotel: {} } })
  })

  it('renders no management band for a manager', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.find('.mgmt-band').exists()).toBe(false)
    expect(wrapper.find('.mgmt-stats').exists()).toBe(false)
    expect(wrapper.find('.mgmt-stat').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(i18n.global.t('stayview.todayAtAGlance'))
  })

  it('spends no occupancy/revenue requests on a manager', async () => {
    mountDashboard()
    await flushPromises()

    expect(reportOccupancy).not.toHaveBeenCalled()
    expect(reportRevenue).not.toHaveBeenCalled()
  })

  it('still renders the stay view itself, so the page is not gutted', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    // The grid and toolbar are what managers keep using from here.
    expect(wrapper.find('.sv-toolbar').exists()).toBe(true)
    expect(wrapper.find('.stayview-page').exists()).toBe(true)
  })
})
