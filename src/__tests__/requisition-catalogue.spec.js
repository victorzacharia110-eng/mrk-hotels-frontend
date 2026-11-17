import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RequisitionPage from '@/pages/requisitions/RequisitionPage.vue'
import i18n from '@/locales/i18n'

/**
 * The requisition picker stays department-scoped: it offers the requester's
 * own shelf plus shared store stock, and hides items registered only to other
 * departments. The shelf figure on each option is the requester's balance.
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

  it('hides other departments items while showing the requesters shelf stock', async () => {
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
            departments: [{ department_id: 'bar-1', name: 'Bar' }],
          },
          {
            item_id: 'out-1',
            item_name: 'Lime Juice',
            unit: 'BTL',
            quantity_in_stock: 0,
            shelf_quantity_in_stock: 0,
            reorder_level: 2,
            shelf_status: 'out_of_stock',
            department_id: 'bar-1',
            departments: [{ department_id: 'bar-1', name: 'Bar' }],
          },
          {
            item_id: 'rest-1',
            item_name: 'Bleach',
            unit: 'LTR',
            quantity_in_stock: 5,
            shelf_quantity_in_stock: 0,
            department_id: 'rest-1',
            departments: [{ department_id: 'rest-1', name: 'Restaurant' }],
          },
          {
            item_id: 'shared-1',
            item_name: 'Mineral Water',
            unit: 'BTL',
            quantity_in_stock: 40,
            shelf_quantity_in_stock: 40,
            department_id: null,
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
    expect(wrapper.vm.itemOptions.map((option) => option.value)).toEqual(['bar-1', 'out-1', 'shared-1'])
    expect(wrapper.vm.itemOptions.find((option) => option.value === 'bar-1').label).toContain('10 BTL')
    expect(wrapper.vm.itemOptions.find((option) => option.value === 'shared-1').label).toContain('40 BTL')

    const empty = wrapper.vm.itemOptions.find((option) => option.value === 'out-1')
    expect(empty.status).toBe('out_of_stock')
    expect(empty.label).toContain('Out of Stock')
  })
})
