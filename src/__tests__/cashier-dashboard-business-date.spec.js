import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import OrderTakerDashboard from '@/pages/dashboards/OrderTakerDashboard.vue'
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

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'take-order', query: { tab: 'dashboard' } }),
  useRouter: () => ({ replace: vi.fn() }),
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
  vi.clearAllMocks()
  api.dayClose.mockResolvedValue({
    data: { open_date: '2026-09-25', timezone: 'Africa/Dar_es_Salaam' },
  })
  api.orderIndex.mockResolvedValue({ data: { data: [] } })
  api.menuIndex.mockResolvedValue({ data: { data: [] } })
  api.tables.mockResolvedValue({ data: { data: [] } })
  api.accompaniments.mockResolvedValue({ data: { data: [] } })
  api.staffDashboard.mockImplementation(async (params) => ({
    data: { range: { date: params.date }, sales: {}, stock: {}, requisitions: {} },
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
      data: { open_date: '2026-09-25', timezone: 'Africa/Dar_es_Salaam' },
    })
    await layoutLoad
    await flushPromises()

    expect(wrapper.find('.dash-date').element.value).toBe('2026-09-25')
    expect(api.staffDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ department: 'bar', date: '2026-09-25' }),
    )
    wrapper.unmount()
    vi.useRealTimers()
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
      expect.objectContaining({ department, date: '2026-09-25' }),
    )

    await dateInput.setValue('2026-08-17')
    await dateInput.trigger('change')
    await flushPromises()

    expect(dateInput.element.value).toBe('2026-08-17')
    expect(api.staffDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({ department, date: '2026-08-17' }),
    )
    wrapper.unmount()
  })
})
