import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'
import { inventoryApi, inventoryOpsApi, supplierApi, unitsApi } from '@/api'
import { selectedDepartment, selectedOutlet, selectedStore } from '@/composables/useOutletContext'
import StoreInventoryPage from '@/pages/store/StoreInventoryPage.vue'

vi.mock('@/api', () => ({
  inventoryApi: {
    index: vi.fn(),
    store: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    adjust: vi.fn(),
  },
  inventoryOpsApi: {
    departments: vi.fn(),
    categories: vi.fn(),
  },
  supplierApi: { index: vi.fn() },
  unitsApi: { index: vi.fn() },
}))

const storeA = { outlet_id: 'outlet-store-a', name: 'Store A', type: 'store' }

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/store-manager/inventory', component: { template: '<div />' } }],
  })
  await router.push('/store-manager/inventory')
  await router.isReady()

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: 'store_manager', name: 'Sam Store' }

  const wrapper = mount(StoreInventoryPage, {
    global: {
      plugins: [i18n, router, pinia],
      stubs: { SearchableSelect: true, DeleteConfirmModal: true },
    },
  })
  await flushPromises()
  return wrapper
}

describe('store inventory department scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectedOutlet.value = storeA
    selectedStore.value = storeA
    selectedDepartment.value = { department_id: 'dept-housekeeping', name: 'Housekeeping' }
    inventoryApi.index.mockResolvedValue({ data: { data: [], meta: { current_page: 1, last_page: 1 } } })
    inventoryOpsApi.departments.mockResolvedValue({ data: { departments: [] } })
    inventoryOpsApi.categories.mockResolvedValue({ data: { data: {} } })
    supplierApi.index.mockResolvedValue({ data: [] })
    unitsApi.index.mockResolvedValue({ data: { units: [] } })
  })

  it('filters the selected store inventory by the chosen department', async () => {
    const wrapper = await mountPage()

    expect(inventoryApi.index).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      department_id: 'dept-housekeeping',
    }))
    expect(wrapper.find('.dept-btn').text()).toContain('Housekeeping')
  })

  it('reloads inventory when a different department is chosen', async () => {
    const wrapper = await mountPage()
    inventoryApi.index.mockClear()

    selectedDepartment.value = { department_id: 'dept-bar', name: 'Bar' }
    await flushPromises()

    expect(inventoryApi.index).toHaveBeenCalledWith(expect.objectContaining({
      department_id: 'dept-bar',
    }))
    expect(wrapper.find('.dept-btn').text()).toContain('Bar')
  })
})
