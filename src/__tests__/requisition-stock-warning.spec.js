import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RequisitionPage from '@/pages/requisitions/RequisitionPage.vue'
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
  return { inventoryOpsApi: mk() }
})

vi.mock('@/api', () => ({ inventoryOpsApi: api.inventoryOpsApi }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { user_role: 'store_manager', full_name: 'Keeper' }, can: () => true }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/utils/reportPrint', () => ({
  printElementSilently: vi.fn().mockResolvedValue(false),
}))

const stubs = {
  CalendarInput: { template: '<div />', props: ['modelValue', 'placeholder', 'min'] },
  SearchableSelect: { template: '<div />', props: ['modelValue', 'options', 'placeholder', 'searchPlaceholder', 'emptyLabel', 'required'] },
  'router-link': { template: '<a><slot /></a>' },
}

const OUT_OF_STOCK = [
  { item_id: 'lime', item_name: 'Fresh Lime', quantity: 3, unit: 'KG' },
]
const INDENT = { indent_id: 'indent-1', indent_number: 'IND-0001', items: [] }

function mountPage() {
  setActivePinia(createPinia())
  return mount(RequisitionPage, {
    global: { plugins: [i18n], stubs },
  })
}

async function preparePage() {
  api.inventoryOpsApi.requisitionItems.mockResolvedValue({
    data: {
      data: [{ item_id: 'lime', item_name: 'Fresh Lime', unit: 'KG', quantity_in_stock: 0, shelf_status: 'out_of_stock', departments: [] }],
      last_page: 1,
    },
  })
  api.inventoryOpsApi.departments.mockResolvedValue({
    data: { departments: [{ department_id: 'bar-1', name: 'Bar' }] },
  })
  api.inventoryOpsApi.indents.mockResolvedValue({ data: { indents: [] } })

  const wrapper = mountPage()
  await flushPromises()
  return wrapper
}

describe('RequisitionPage out-of-stock warning', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('warns after submitting an out-of-stock line and then continues to notify', async () => {
    const wrapper = await preparePage()
    api.inventoryOpsApi.storeIndent.mockResolvedValue({
      data: { indent: { ...INDENT, business_date: '2026-11-18' }, out_of_stock_items: OUT_OF_STOCK },
    })

    wrapper.vm.openCreate()
    wrapper.vm.form.lines = [{ item_id: 'lime', quantity: 3 }]
    await wrapper.vm.save('pending')
    await flushPromises()

    expect(wrapper.vm.modal).toBe(null)
    expect(wrapper.vm.outOfStockNotice.items).toEqual(OUT_OF_STOCK)
    expect(wrapper.text()).toContain('Items currently out of stock')
    expect(wrapper.text()).toContain('Fresh Lime')
    expect(wrapper.text()).toContain('The department will be alerted here')

    wrapper.vm.dismissOutOfStock()
    await flushPromises()

    expect(wrapper.vm.outOfStockNotice).toBe(null)
    expect(wrapper.vm.modal).toBe('notify')
  })

  it('warns after sending a draft and then continues to notify', async () => {
    const wrapper = await preparePage()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.inventoryOpsApi.sendIndent.mockResolvedValue({
      data: { indent: { ...INDENT, business_date: '2026-11-18' }, out_of_stock_items: OUT_OF_STOCK },
    })

    await wrapper.vm.send(INDENT)
    await flushPromises()

    expect(wrapper.vm.outOfStockNotice.items).toEqual(OUT_OF_STOCK)
    expect(wrapper.text()).toContain('Fresh Lime')

    wrapper.vm.dismissOutOfStock()
    await flushPromises()

    expect(wrapper.vm.modal).toBe('notify')
    expect(wrapper.vm.notifyIndent.indent_id).toBe('indent-1')
  })

  it('does not warn when every line is in stock', async () => {
    const wrapper = await preparePage()
    api.inventoryOpsApi.storeIndent.mockResolvedValue({
      data: { indent: { ...INDENT, business_date: '2026-11-18' }, out_of_stock_items: [] },
    })

    wrapper.vm.openCreate()
    wrapper.vm.form.lines = [{ item_id: 'lime', quantity: 1 }]
    await wrapper.vm.save('pending')
    await flushPromises()

    expect(wrapper.vm.outOfStockNotice).toBe(null)
    expect(wrapper.vm.modal).toBe('notify')
  })
})
