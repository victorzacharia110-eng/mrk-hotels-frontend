import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StoreStockAdjustPage from '@/pages/store/StoreStockAdjustPage.vue'
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
  return { inventoryOpsApi: mk(), inventoryApi: mk(), fbDayCloseApi: mk() }
})

vi.mock('@/api', () => ({
  inventoryOpsApi: api.inventoryOpsApi,
  inventoryApi: api.inventoryApi,
  fbDayCloseApi: api.fbDayCloseApi,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { full_name: 'Amina Store', user_role: 'store_manager' } }),
}))

const stubs = {
  CalendarInput: { template: '<div />', props: ['modelValue', 'clearable'] },
  SearchableSelect: { template: '<div />', props: ['modelValue', 'options', 'placeholder'] },
}

function mountPage() {
  setActivePinia(createPinia())
  return mount(StoreStockAdjustPage, {
    global: { plugins: [i18n], stubs },
  })
}

const ITEM = {
  item_id: 'item-1',
  item_name: 'Bavaria 500ml',
  unit: 'BTL',
  unit_cost: 3000,
  quantity_in_stock: 10,
}

const SHEET = {
  adjustment_id: 'adj-1',
  adjustment_number: 'AD-WS-2026-0001',
  type: 'wastage',
  business_date: '2026-10-27',
  status: 'saved',
  total_cost: 6000,
  creator_name: 'Amina Store',
  items: [
    {
      adjustment_item_id: 'line-1',
      item_id: 'item-1',
      item_name: 'Bavaria 500ml',
      unit: 'BTL',
      quantity: 2,
      quantity_before: 10,
      quantity_after: 8,
      unit_cost: 3000,
      total_cost: 6000,
      note: 'Broken bottles',
    },
  ],
}

describe('StoreStockAdjustPage', () => {
  afterEach(() => vi.clearAllMocks())

  it('lists sheets for the working business date', async () => {
    api.inventoryOpsApi.stockAdjustments.mockResolvedValue({ data: { adjustments: [SHEET] } })
    const wrapper = mountPage()
    await flushPromises()

    expect(api.inventoryOpsApi.stockAdjustments).toHaveBeenCalledWith(
      expect.objectContaining({ date: expect.any(String), per_page: 250 }),
    )
    expect(wrapper.vm.adjustments).toHaveLength(1)
    expect(wrapper.vm.adjustments[0].adjustment_number).toBe('AD-WS-2026-0001')
  })

  it('voids a saved sheet with a required reason', async () => {
    api.inventoryOpsApi.stockAdjustments.mockResolvedValue({ data: { adjustments: [SHEET] } })
    api.inventoryOpsApi.voidStockAdjustment.mockResolvedValue({ data: { message: 'ok' } })
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.openDetail(SHEET)
    wrapper.vm.askVoid(SHEET)
    wrapper.vm.voidReason = 'Entered in error'
    await wrapper.vm.confirmVoid()

    expect(api.inventoryOpsApi.voidStockAdjustment).toHaveBeenCalledWith('adj-1', 'Entered in error')
    expect(wrapper.vm.voidTarget).toBeNull()
  })

  it('saves a new wastage sheet with item-level reasons', async () => {
    api.inventoryOpsApi.stockAdjustments.mockResolvedValue({ data: { adjustments: [] } })
    api.inventoryOpsApi.storeStockAdjustment.mockResolvedValue({
      data: { adjustment: { adjustment_id: 'adj-2', adjustment_number: 'AD-WS-2026-0002' } },
    })
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.allItems = [ITEM]
    wrapper.vm.openCreate()
    wrapper.vm.draft.item_id = ITEM.item_id
    wrapper.vm.draft.quantity = 2
    wrapper.vm.addLine()
    wrapper.vm.form.lines[0].note = 'Dropped during service'
    await wrapper.vm.saveSheet()

    expect(api.inventoryOpsApi.storeStockAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'wastage',
        business_date: expect.any(String),
        items: [{ item_id: 'item-1', quantity: 2, note: 'Dropped during service' }],
      }),
    )
    expect(wrapper.vm.sheetOpen).toBe(false)
  })

  it('blocks duplicate items on one sheet', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.allItems = [ITEM]
    wrapper.vm.openCreate()
    wrapper.vm.draft.item_id = ITEM.item_id
    wrapper.vm.draft.quantity = 1
    wrapper.vm.addLine()
    wrapper.vm.draft.item_id = ITEM.item_id
    wrapper.vm.draft.quantity = 2

    expect(wrapper.vm.canAddLine).toBe(false)
  })
})
