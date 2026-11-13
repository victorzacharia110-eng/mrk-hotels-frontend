import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import OrderTakerDashboard from '@/pages/dashboards/OrderTakerDashboard.vue'
import CashierLowStockPage from '@/pages/cashier/CashierLowStockPage.vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkingDateStore } from '@/stores/workingDate'

const api = vi.hoisted(() => ({
  dayClose: vi.fn(),
  staffDashboard: vi.fn(),
  orderIndex: vi.fn(),
  menuIndex: vi.fn(),
  tables: vi.fn(),
  accompaniments: vi.fn(),
}))

vi.mock('@/api', () => ({
  fbDayCloseApi: { index: api.dayClose },
  reportApi: { staffDashboard: api.staffDashboard },
  orderApi: { index: api.orderIndex, summary: vi.fn(), show: vi.fn() },
  menuItemApi: { index: api.menuIndex },
  menuAccompanimentApi: { index: api.accompaniments },
  tableApi: { index: api.tables },
  tableLocationApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  creditAccountApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}))

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
const route = vi.hoisted(() => ({ name: 'take-order', query: { tab: 'dashboard' } }))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => router,
}))

vi.mock('@/utils/printer', async (importOriginal) => ({
  ...(await importOriginal()),
  restorePrinter: vi.fn(),
}))

vi.mock('@/composables/useOrderRealtime', () => ({
  useOrderRealtime: () => ({ stop: vi.fn() }),
}))

vi.mock('@/composables/useStockRealtime', () => ({
  useStockRealtime: () => ({ stop: vi.fn() }),
}))

function mountDashboard(role, pinia) {
  useAuthStore().user = { full_name: 'Test User', user_role: role }
  return mount(OrderTakerDashboard, {
    global: {
      plugins: [pinia, i18n],
      stubs: { 'router-link': { template: '<a><slot /></a>' } },
    },
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  route.query = { tab: 'dashboard' }
  vi.clearAllMocks()
  api.dayClose.mockResolvedValue({
    data: {
      close_date: '2026-09-25',
      open_date: '2026-11-13',
      timezone: 'Africa/Dar_es_Salaam',
    },
  })
  api.orderIndex.mockResolvedValue({ data: { data: [] } })
  api.menuIndex.mockResolvedValue({ data: { data: [] } })
  api.tables.mockResolvedValue({ data: { data: [] } })
  api.accompaniments.mockResolvedValue({ data: { data: [] } })
  api.staffDashboard.mockImplementation(async (params) => ({
    data: { range: { from: params.from, to: params.to }, sales: {}, stock: {}, requisitions: {} },
  }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('cashier/bartender dashboard business date', () => {
  it('waits for an in-flight Day Close read instead of querying the browser date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T12:00:00Z'))
    let releaseDayClose
    api.dayClose.mockReturnValue(new Promise((resolve) => { releaseDayClose = resolve }))

    const pinia = createPinia()
    setActivePinia(pinia)
    // CashierLayout starts the same request before the page mounts.
    const layoutLoad = useWorkingDateStore().ensureLoaded()
    const wrapper = mountDashboard('bartender', pinia)
    await flushPromises()

    expect(api.staffDashboard).not.toHaveBeenCalled()

    releaseDayClose({
      data: {
        close_date: '2026-11-09',
        open_date: '2026-11-13',
        timezone: 'Africa/Dar_es_Salaam',
      },
    })
    await layoutLoad
    await flushPromises()

    expect(wrapper.find('.dash-date').element.value).toBe('2026-11-09')
    expect(api.staffDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ department: 'bar', from: '2026-11-09', to: '2026-11-09' }),
    )
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('opens the low-stock page scoped to the department on screen', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mountDashboard('cashier', pinia)
    await flushPromises()

    await wrapper.find('.kpi-arrow').trigger('click')

    expect(router.push).toHaveBeenCalledWith({
      name: 'cashier-low-stock',
      query: { department: 'restaurant' },
    })
    wrapper.unmount()
  })

  it('opens the low-stock page on the department that was on screen', async () => {
    route.query = { department: 'bar' }
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { full_name: 'Test User', user_role: 'cashier' }
    api.staffDashboard.mockResolvedValue({ data: { menu_stock: { rows: [], low_stock_count: 0 } } })

    const wrapper = mount(CashierLowStockPage, {
      global: { plugins: [pinia, i18n] },
    })
    await flushPromises()

    expect(api.staffDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ department: 'bar' }),
    )
    wrapper.unmount()
  })

  it('shows the SI unit in its own column and the menu reorder level as a number', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    api.staffDashboard.mockResolvedValue({
      data: {
        range: { from: '2026-09-25', to: '2026-09-25' },
        sales: {},
        stock: {},
        requisitions: {},
        menu_stock: {
          low_stock_count: 1,
          low_stock: [{
            item_id: 'menu-1',
            item_name: 'Bar Gin',
            si_unit: 'BTL',
            unit: 'BTL',
            quantity: 2,
            reorder_level: 5,
          }],
        },
      },
    })

    const wrapper = mountDashboard('bartender', pinia)
    await flushPromises()

    const lowStockCard = wrapper.findAll('.dash-card')[0]
    expect(lowStockCard.findAll('thead th').map((th) => th.text()))
      .toEqual(['Item', 'SI Unit', 'Qty', 'Reorder level'])
    expect(lowStockCard.findAll('tbody td').map((td) => td.text()))
      .toEqual(['Bar Gin', 'BTL', '2', '5'])

    wrapper.unmount()
  })

  it('renders the full low-stock page with SI unit and numeric reorder columns', async () => {
    route.query = { department: 'bar' }
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().user = { full_name: 'Test User', user_role: 'cashier' }
    api.staffDashboard.mockResolvedValue({
      data: {
        menu_stock: {
          low_stock_count: 1,
          rows: [{
            item_id: 'menu-1',
            item_name: 'Bar Gin',
            si_unit: 'BTL',
            quantity: 2,
            reorder_level: 5,
            value: 10000,
            low: true,
          }],
        },
      },
    })

    const wrapper = mount(CashierLowStockPage, {
      global: { plugins: [pinia, i18n] },
    })
    await flushPromises()

    expect(wrapper.findAll('thead th').slice(0, 4).map((th) => th.text()))
      .toEqual(['Item', 'SI Unit', 'Qty', 'Reorder level'])
    expect(wrapper.findAll('tbody td').slice(0, 4).map((td) => td.text()))
      .toEqual(['Bar Gin', 'BTL', '2.00', '5.00'])

    wrapper.unmount()
  })

  it.each([
    ['cashier', 'restaurant'],
    ['bartender', 'bar'],
  ])('loads any calendar date selected by the %s', async (role, department) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mountDashboard(role, pinia)
    await flushPromises()

    const dateInput = wrapper.find('.dash-date')
    expect(dateInput.element.value).toBe('2026-09-25')
    expect(api.staffDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ department, from: '2026-09-25', to: '2026-09-25' }),
    )

    await dateInput.setValue('2026-08-17')
    await dateInput.trigger('change')
    await flushPromises()

    expect(dateInput.element.value).toBe('2026-08-17')
    expect(api.staffDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({ department, from: '2026-08-17', to: '2026-08-17' }),
    )
    wrapper.unmount()
  })
})
