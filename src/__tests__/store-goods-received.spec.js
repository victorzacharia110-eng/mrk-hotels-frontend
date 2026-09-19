import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StoreGoodsReceivedPage from '@/pages/store/StoreGoodsReceivedPage.vue'
import i18n from '@/locales/i18n'

const api = vi.hoisted(() => {
  const mk = (initial = {}) =>
    new Proxy(initial, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined
        if (!(prop in target)) target[prop] = vi.fn().mockResolvedValue({ data: {} })
        return target[prop]
      },
    })
  return {
    goodsReceivedNoteApi: mk(),
    purchaseOrderApi: mk(),
    storeApi: mk(),
  }
})

vi.mock('@/api', () => ({
  goodsReceivedNoteApi: api.goodsReceivedNoteApi,
  purchaseOrderApi: api.purchaseOrderApi,
  storeApi: api.storeApi,
}))

const route = vi.hoisted(() => ({ query: {} }))
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
}))

const stubs = {
  CalendarInput: { template: '<div />', props: ['modelValue', 'placeholder', 'min'] },
  SearchableSelect: { template: '<div />', props: ['modelValue', 'options', 'forceSearch', 'emptyLabel'] },
  'router-link': { template: '<a><slot /></a>' },
}

function mountPage() {
  setActivePinia(createPinia())
  return mount(StoreGoodsReceivedPage, {
    global: { plugins: [i18n], stubs },
  })
}

describe('StoreGoodsReceivedPage', () => {
  afterEach(() => {
    route.query = {}
    vi.restoreAllMocks()
  })

  it('opens the browser print-setup page with the GRN print area instead of a silent PDF download', async () => {
    const grn = {
      grn_id: 5,
      grn_number: 'GRN-0005',
      received_date: '2026-09-19',
      items: [{ item_name: 'Rice 25kg', quantity_received: 4, unit_cost: 120000 }],
    }
    api.goodsReceivedNoteApi.index.mockResolvedValue({ data: { data: [grn], meta: { current_page: 1, last_page: 1 } } })
    api.goodsReceivedNoteApi.show.mockResolvedValue({ data: { grn } })
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.vm.openDetail(grn)
    await flushPromises()

    await wrapper.vm.printDetail()
    await flushPromises()

    expect(printSpy).toHaveBeenCalledOnce()
    expect(api.goodsReceivedNoteApi.printPdf).not.toHaveBeenCalled()
    expect(wrapper.find('.print-area').exists()).toBe(true)
    expect(wrapper.find('.print-area').text()).toContain('GRN-0005')
  })

  it('renders the Stock Ledger detail view with date, time and reference per movement', async () => {
    route.query = { view: 'ledger-detail' }
    api.storeApi.movements.mockResolvedValue({
      data: {
        data: [
          {
            movement_id: 11,
            created_at: '2026-09-19T09:24:00',
            item_name: 'Rice 25kg',
            type: 'in',
            quantity: 4,
            reference: 'GRN-0005',
            user_name: 'Store Keeper',
          },
          {
            movement_id: 12,
            created_at: '2026-09-19T14:02:00',
            item_name: 'Cooking Oil 20L',
            movement_type: 'out',
            quantity: 2,
            notes: 'Indent IND-0042',
            user_name: 'Store Keeper',
          },
        ],
        meta: { current_page: 1, last_page: 1 },
      },
    })

    const wrapper = mountPage()
    await flushPromises()

    expect(api.storeApi.movements).toHaveBeenCalled()
    const html = wrapper.html()
    expect(html).toContain('Rice 25kg')
    expect(html).toContain('GRN-0005')
    expect(html).toContain('Indent IND-0042')
    expect(html).toContain(new Date('2026-09-19T09:24:00').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
    expect(html).toContain(new Date('2026-09-19T14:02:00').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
  })

  it('shows the empty ledger message when no movements exist for the date', async () => {
    route.query = { view: 'ledger-detail' }
    api.storeApi.movements.mockResolvedValue({ data: { data: [], meta: { current_page: 1, last_page: 1 } } })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain(i18n.global.t('storeManager.reports.ledgerEmpty'))
  })
})
