import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RequisitionListPage from '@/pages/procurement/RequisitionListPage.vue'
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
    inventoryOpsApi: mk(),
    inventoryApi: mk(),
    purchaseRequisitionApi: mk(),
  }
})

vi.mock('@/api', () => ({
  inventoryOpsApi: api.inventoryOpsApi,
  inventoryApi: api.inventoryApi,
  purchaseRequisitionApi: api.purchaseRequisitionApi,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ can: () => true, canOperate: true, user: null }),
}))

const stubs = {
  SearchableSelect: {
    template: '<div />',
    props: ['modelValue', 'options', 'placeholder', 'searchPlaceholder', 'emptyLabel', 'required', 'searchable'],
  },
  TableExportButton: { template: '<div />' },
}

function mountPage() {
  setActivePinia(createPinia())
  return mount(RequisitionListPage, {
    global: { plugins: [i18n], stubs },
  })
}

const ITEM = {
  item_id: 'item-1',
  item_name: 'Cooking oil',
  category: 'restaurant',
  unit: 'litre',
  unit_cost: 45000,
  si_units: [
    { unit: 'litre', factor: 1 },
    { unit: 'CTN', factor: 12 },
  ],
}

describe('RequisitionListPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads every inventory page for the item picker', async () => {
    api.inventoryApi.index
      .mockResolvedValueOnce({ data: { data: [ITEM], meta: { last_page: 2 } } })
      .mockResolvedValueOnce({ data: { data: [{ ...ITEM, item_id: 'item-2' }], meta: { last_page: 2 } } })

    const wrapper = mountPage()
    await flushPromises()

    expect(api.inventoryApi.index).toHaveBeenNthCalledWith(1, { per_page: 100, page: 1 })
    expect(api.inventoryApi.index).toHaveBeenNthCalledWith(2, { per_page: 100, page: 2 })
    expect(wrapper.vm.itemOptions).toHaveLength(2)
  })

  it('links a picked inventory item and fills its unit and estimated price', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.inventoryItems = [ITEM]
    wrapper.vm.form.items = [wrapper.vm.emptyItem()]

    wrapper.vm.onPickItem(0, { value: ITEM.item_id })

    const line = wrapper.vm.form.items[0]
    expect(line.item_id).toBe(ITEM.item_id)
    expect(line.item_name).toBe('Cooking oil')
    expect(line.unit).toBe('litre')
    expect(line.estimated_price).toBe(45000)
    expect(wrapper.vm.unitOptionsFor(line)).toEqual([
      { value: 'litre', label: 'litre' },
      { value: 'CTN', label: 'CTN' },
    ])
  })

  it('computes line subtotals and the requisition total', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.form.items = [
      { ...wrapper.vm.emptyItem(), quantity: 2, estimated_price: 45000 },
      { ...wrapper.vm.emptyItem(), quantity: 1, estimated_price: 30000 },
    ]

    expect(wrapper.vm.lineSubtotal(wrapper.vm.form.items[0])).toBe(90000)
    expect(wrapper.vm.prTotal).toBe(120000)
  })

  it('blocks adding the same item twice to one requisition', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.inventoryItems = [ITEM]

    wrapper.vm.form.items = [wrapper.vm.emptyItem(), wrapper.vm.emptyItem()]
    wrapper.vm.onPickItem(0, { value: ITEM.item_id })
    wrapper.vm.onPickItem(1, { value: ITEM.item_id })

    expect(wrapper.vm.modalError).toBe(i18n.global.t('requisitions.duplicateItem'))
    expect(wrapper.vm.form.items[1].item_id).toBe('')
  })

  it('sends the picked item_id with the requisition', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.inventoryItems = [ITEM]
    wrapper.vm.form.department = 'kitchen'
    wrapper.vm.form.items = [wrapper.vm.emptyItem()]
    wrapper.vm.onPickItem(0, { value: ITEM.item_id })
    Object.assign(wrapper.vm.form.items[0], { quantity: 2 })

    await wrapper.vm.save()

    expect(api.purchaseRequisitionApi.store).toHaveBeenCalledWith(
      expect.objectContaining({
        department: 'kitchen',
        items: [
          expect.objectContaining({
            item_id: ITEM.item_id,
            item_name: 'Cooking oil',
            quantity: 2,
            unit: 'litre',
            estimated_price: 45000,
          }),
        ],
      }),
    )
  })

  it('refuses to save a requisition without items', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.form.department = 'kitchen'
    wrapper.vm.form.items = []

    await wrapper.vm.save()

    expect(wrapper.vm.modalError).toBe(i18n.global.t('requisitions.addItemError'))
    expect(api.purchaseRequisitionApi.store).not.toHaveBeenCalled()
  })
})
