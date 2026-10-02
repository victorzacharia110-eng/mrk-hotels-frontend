import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StorePurchaseOrdersPage from '@/pages/store/StorePurchaseOrdersPage.vue'
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
    purchaseOrderApi: mk(),
    purchaseRequisitionApi: mk(),
    supplierApi: mk(),
    inventoryApi: mk(),
    fbDayCloseApi: mk(),
  }
})

vi.mock('@/api', () => ({
  purchaseOrderApi: api.purchaseOrderApi,
  purchaseRequisitionApi: api.purchaseRequisitionApi,
  supplierApi: api.supplierApi,
  inventoryApi: api.inventoryApi,
  fbDayCloseApi: api.fbDayCloseApi,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ can: () => true, user: null }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const stubs = {
  CalendarInput: { template: '<div />', props: ['modelValue', 'placeholder', 'min'] },
  SearchableSelect: { template: '<div />', props: ['modelValue', 'options', 'placeholder', 'searchPlaceholder', 'emptyLabel', 'required'] },
  'router-link': { template: '<a><slot /></a>' },
}

function mountPage() {
  setActivePinia(createPinia())
  return mount(StorePurchaseOrdersPage, {
    global: { plugins: [i18n], stubs },
  })
}

const ITEM = {
  item_id: 1,
  item_name: 'Bavaria',
  unit: 'BTL',
  unit_cost: 3000,
  si_units: [
    { unit: 'BTL', factor: 1 },
    { unit: 'CTN', factor: 24 },
  ],
}

describe('StorePurchaseOrdersPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('collapses workflow statuses onto the three display states', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.vm.poStatusLabel('pending')).toBe('PENDING')
    expect(wrapper.vm.poStatusLabel('manager_approved')).toBe('PENDING')
    expect(wrapper.vm.poStatusLabel('approved')).toBe('PENDING')
    expect(wrapper.vm.poStatusLabel('received')).toBe('RECEIVED')
    expect(wrapper.vm.poStatusLabel('partially_received')).toBe('RECEIVED')
    expect(wrapper.vm.poStatusLabel('voided')).toBe('VOID')
    expect(wrapper.vm.poStatusLabel('cancelled')).toBe('VOID')
    expect(wrapper.vm.poStatusLabel('rejected')).toBe('VOID')
  })

  it('searches on the server and filters by display status group', async () => {
    const wrapper = mountPage()
    await flushPromises()
    api.purchaseOrderApi.index.mockClear()

    wrapper.vm.q = 'Acme'
    wrapper.vm.statusFilter = 'received'
    await wrapper.vm.load(1)

    expect(api.purchaseOrderApi.index).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Acme', status_group: 'received' }),
    )
  })

  it('blocks adding the same item twice to one purchase order', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.inventoryItems = [ITEM]

    const line = wrapper.vm.emptyItem()
    wrapper.vm.onPickItem(line, { value: 1 })
    wrapper.vm.form.items = [line]

    const duplicate = wrapper.vm.emptyItem()
    wrapper.vm.onPickItem(duplicate, { value: 1 })

    expect(wrapper.vm.formError).toBe(i18n.global.t('purchaseOrders.duplicateItem'))
  })

  it('scales the inherited price by the selected SI unit factor', async () => {
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.inventoryItems = [ITEM]

    const line = wrapper.vm.emptyItem()
    wrapper.vm.onPickItem(line, { value: 1 })
    expect(line.unit_price).toBe(3000)

    line.unit = 'CTN'
    wrapper.vm.onUnitChange(line)
    expect(line.unit_price).toBe(72000)
  })

  it('opens the browser print dialog for a purchase order', async () => {
    vi.useFakeTimers()
    const wrapper = mountPage()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    wrapper.vm.detail = { po_id: 5, po_number: 'PO-0005', items: [] }
    wrapper.vm.printDetail()
    vi.advanceTimersByTime(60)

    expect(printSpy).toHaveBeenCalledOnce()
    expect(wrapper.vm.printData.po_number).toBe('PO-0005')
  })
})
