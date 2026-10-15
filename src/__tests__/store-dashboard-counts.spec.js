import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StoreDashboardPage from '@/pages/store/StoreDashboardPage.vue'
import i18n from '@/locales/i18n'

const api = vi.hoisted(() => {
  const mk = () =>
    new Proxy({}, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined
        if (!(prop in target)) target[prop] = vi.fn().mockResolvedValue({ data: { data: [], meta: {} } })
        return target[prop]
      },
    })
  return { inventoryApi: mk(), purchaseRequisitionApi: mk(), goodsReceivedNoteApi: mk() }
})

vi.mock('@/api', () => ({
  inventoryApi: api.inventoryApi,
  purchaseRequisitionApi: api.purchaseRequisitionApi,
  goodsReceivedNoteApi: api.goodsReceivedNoteApi,
}))

vi.mock('@/composables/useStockRealtime', () => ({
  useStockRealtime: () => ({ stop: vi.fn() }),
}))

function mountPage() {
  setActivePinia(createPinia())
  return mount(StoreDashboardPage, { global: { plugins: [i18n] } })
}

describe('StoreDashboardPage KPI counts', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reports the real server totals, not just the visible rows', async () => {
    api.inventoryApi.index.mockImplementation((params = {}) => {
      if (params.low_stock) return Promise.resolve({ data: { data: [], meta: { total: 7 } } })
      return Promise.resolve({
        data: {
          data: [
            { item_id: 1, item_name: 'Rice', quantity_in_stock: 2, reorder_level: 5 },
            { item_id: 2, item_name: 'Oil', quantity_in_stock: 40, reorder_level: 10 },
          ],
          meta: { total: 42 },
        },
      })
    })
    api.purchaseRequisitionApi.index.mockResolvedValue({ data: { data: [], meta: { total: 3 } } })
    api.goodsReceivedNoteApi.index.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })

    const wrapper = mountPage()
    await flushPromises()

    const cards = wrapper.findAll('.kpi-card')
    expect(cards[0].text()).toContain('42')
    expect(cards[1].text()).toContain('7')
    expect(cards[2].text()).toContain('3')
  })

  it('falls back to the derived count when the API omits a total', async () => {
    api.inventoryApi.index.mockImplementation((params = {}) => {
      if (params.low_stock) return Promise.resolve({ data: { data: [], meta: {} } })
      return Promise.resolve({
        data: {
          data: [
            { item_id: 1, item_name: 'Rice', quantity_in_stock: 1, reorder_level: 5 },
            { item_id: 2, item_name: 'Sugar', quantity_in_stock: 0, reorder_level: 2 },
          ],
          meta: {},
        },
      })
    })
    api.purchaseRequisitionApi.index.mockResolvedValue({ data: { data: [], meta: {} } })
    api.goodsReceivedNoteApi.index.mockResolvedValue({ data: { data: [] } })

    const wrapper = mountPage()
    await flushPromises()

    const cards = wrapper.findAll('.kpi-card')
    expect(cards[0].text()).toContain('2')
    expect(cards[1].text()).toContain('2')
  })
})
