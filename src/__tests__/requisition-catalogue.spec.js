import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RequisitionPage from '@/pages/requisitions/RequisitionPage.vue'
import i18n from '@/locales/i18n'

/**
 * The requisition picker offers the whole catalogue to every outlet. An item
 * registered to another department is still requestable; the shelf figure on
 * the option is what tells the requester their own outlet holds none.
 */

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
  useAuthStore: () => ({
    user: {
      user_role: 'cashier',
      department_id: 'bar-1',
      department: 'Bar',
      full_name: 'Cashier',
    },
    can: () => true,
  }),
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

function mountPage() {
  setActivePinia(createPinia())
  return mount(RequisitionPage, {
    global: { plugins: [i18n], stubs },
  })
}

describe('RequisitionPage catalogue', () => {
  afterEach(() => vi.clearAllMocks())

  it('offers other departments items while showing the requesters shelf stock', async () => {
    api.inventoryOpsApi.requisitionItems.mockResolvedValue({
      data: {
        data: [
          {
            item_id: 'bar-1',
            item_name: 'Vodka',
            unit: 'BTL',
            quantity_in_stock: 10,
            shelf_quantity_in_stock: 10,
            department_id: 'bar-1',
            departments: [],
          },
          {
            item_id: 'rest-1',
            item_name: 'Bleach',
            unit: 'LTR',
            quantity_in_stock: 5,
            shelf_quantity_in_stock: 0,
            department_id: 'rest-1',
            departments: [],
          },
        ],
        last_page: 1,
      },
    })
    api.inventoryOpsApi.departments.mockResolvedValue({
      data: {
        departments: [
          { department_id: 'bar-1', name: 'Bar' },
          { department_id: 'rest-1', name: 'Restaurant' },
        ],
      },
    })
    api.inventoryOpsApi.indents.mockResolvedValue({ data: { indents: [] } })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.vm.restricted).toBe(true)
    expect(wrapper.vm.itemOptions.map((option) => option.value)).toEqual(['bar-1', 'rest-1'])
    expect(wrapper.vm.itemOptions[1].label).toContain('Bleach')
    expect(wrapper.vm.itemOptions[1].label).toContain('0 LTR')
  })
})
