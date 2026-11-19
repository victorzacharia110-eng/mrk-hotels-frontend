import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'
import { departmentApi, outletApi } from '@/api'
import { outlets, selectedOutlet, selectedStore, selectedDepartment, loaded } from '@/composables/useOutletContext'
import StoreManagerLayout from '@/layouts/StoreManagerLayout.vue'

vi.mock('@/api', () => ({
  outletApi: { index: vi.fn() },
  departmentApi: { index: vi.fn() },
  authApi: { logout: vi.fn().mockResolvedValue({ data: {} }) },
  fbDayCloseApi: { index: vi.fn().mockResolvedValue({ data: {} }) },
  notificationApi: {
    unreadCount: vi.fn().mockResolvedValue({ data: {} }),
    alerts: vi.fn().mockResolvedValue({ data: { alerts: [] } }),
    index: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}))

const storeA = {
  outlet_id: 'outlet-store-a',
  name: 'Store A',
  type: 'store',
  is_active: true,
}

const storeB = {
  outlet_id: 'outlet-store-b',
  name: 'Store B',
  type: 'store',
  is_active: true,
}

const bar = {
  outlet_id: 'outlet-bar',
  name: 'Bar 1',
  type: 'bar',
  is_active: true,
}

const housekeeping = { department_id: 'dept-housekeeping', name: 'Housekeeping' }
const barDepartment = { department_id: 'dept-bar', name: 'Bar' }

async function mountLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/store-manager')
  await router.isReady()

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: 'store_manager', name: 'Sam Store' }

  const wrapper = mount(StoreManagerLayout, {
    global: {
      plugins: [i18n, router, pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
  await flushPromises()

  return wrapper
}

describe('store manager outlet gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    departmentApi.index.mockResolvedValue({ data: { departments: [housekeeping, barDepartment] } })
    outlets.value = []
    selectedOutlet.value = null
    selectedStore.value = null
    selectedDepartment.value = null
    loaded.value = false
  })

  it('asks for the store before the department even when there is only one store', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [bar, storeA] } })

    const wrapper = await mountLayout()

    expect(selectedOutlet.value).toBe(null)
    expect(selectedStore.value).toBe(null)
    expect(wrapper.text()).toContain('Which store are you working with?')
    expect(wrapper.text()).not.toContain('Which department are you working with?')
    expect(wrapper.findAll('.sm-outlet-option').map((button) => button.text())).toEqual([
      expect.stringContaining('Store A'),
    ])

    await wrapper.findAll('.sm-outlet-option')[0].trigger('click')
    await flushPromises()

    expect(selectedOutlet.value.outlet_id).toBe('outlet-store-a')
    expect(selectedStore.value.outlet_id).toBe('outlet-store-a')
    expect(wrapper.text()).toContain('Which department are you working with?')
    expect(wrapper.findAll('.sm-department-option').map((button) => button.text())).toEqual([
      expect.stringContaining('Housekeeping'),
      expect.stringContaining('Bar'),
    ])
  })

  it('shows only stores in the gate and no add-outlet action', async () => {
    outletApi.index.mockResolvedValue({
      data: { outlets: [storeA, storeB, bar] },
    })

    const wrapper = await mountLayout()

    const gateList = wrapper.find('.sm-outlet-gate-list')
    expect(gateList.text()).toContain('Store A')
    expect(gateList.text()).toContain('Store B')
    expect(gateList.text()).not.toContain('Bar 1')
    expect(wrapper.text()).not.toContain('Add another outlet')
  })

  it('opens the department gate after a store is chosen', async () => {
    outletApi.index.mockResolvedValue({
      data: { outlets: [storeA, storeB, bar] },
    })

    const wrapper = await mountLayout()

    const storeOption = wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Store B'))
    await storeOption.trigger('click')
    await flushPromises()

    expect(selectedOutlet.value.outlet_id).toBe('outlet-store-b')
    expect(selectedStore.value.outlet_id).toBe('outlet-store-b')
    expect(wrapper.text()).toContain('Which department are you working with?')
    expect(departmentApi.index).toHaveBeenCalled()

    const departmentOption = wrapper.findAll('.sm-department-option').find((button) => button.text().includes('Housekeeping'))
    await departmentOption.trigger('click')
    await flushPromises()

    expect(selectedDepartment.value.department_id).toBe('dept-housekeeping')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
    expect(wrapper.find('.sm-dept-picker').text()).toContain('Housekeeping')
  })

  it('shows the header picker only when there is more than one store', async () => {
    outletApi.index.mockResolvedValue({
      data: { outlets: [storeA, storeB, bar] },
    })

    const wrapper = await mountLayout()

    const picker = wrapper.find('.sm-outlet-picker select')
    expect(picker.exists()).toBe(true)
    expect(picker.findAll('option').map((option) => option.text())).toEqual([
      expect.any(String),
      'Store A',
      'Store B',
    ])
  })

  it('asks for a department again when the store changes', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [storeA, storeB] } })

    const wrapper = await mountLayout()
    await wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Store A')).trigger('click')
    await flushPromises()
    await wrapper.findAll('.sm-department-option').find((button) => button.text().includes('Housekeeping')).trigger('click')
    await flushPromises()

    expect(selectedDepartment.value.department_id).toBe('dept-housekeeping')

    await wrapper.find('.sm-outlet-picker select').setValue('outlet-store-b')
    await flushPromises()

    expect(selectedStore.value.outlet_id).toBe('outlet-store-b')
    expect(selectedDepartment.value).toBe(null)
    expect(wrapper.text()).toContain('Which department are you working with?')
  })

  it('lets the user change department from the header', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [storeA, storeB] } })

    const wrapper = await mountLayout()
    await wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Store A')).trigger('click')
    await flushPromises()
    await wrapper.findAll('.sm-department-option').find((button) => button.text().includes('Housekeeping')).trigger('click')
    await flushPromises()

    await wrapper.find('.sm-dept-picker').trigger('click')
    await flushPromises()
    await wrapper.findAll('.sm-department-option').find((button) => button.text().includes('Bar')).trigger('click')
    await flushPromises()

    expect(selectedDepartment.value.department_id).toBe('dept-bar')
    expect(wrapper.find('.sm-dept-picker').text()).toContain('Bar')
  })

  it('lets the user log out while the outlet gate is open', async () => {
    outletApi.index.mockResolvedValue({
      data: { outlets: [storeA, storeB] },
    })

    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(true)
    const logout = wrapper.find('.sm-gate-logout')
    expect(logout.exists()).toBe(true)

    await logout.trigger('click')
    await flushPromises()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
  })
})

describe('store manager sidebar labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    departmentApi.index.mockResolvedValue({ data: { departments: [housekeeping, barDepartment] } })
    outlets.value = []
    selectedOutlet.value = null
    selectedStore.value = null
    selectedDepartment.value = null
    loaded.value = false
  })

  it('shows labels when the mobile drawer is open', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [storeA] } })
    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-brand-text').attributes('style')).toContain('display: none')

    wrapper.vm.mobileOpen = true
    await flushPromises()

    expect(wrapper.find('.sm-brand-text').attributes('style') || '').not.toContain('display: none')
    for (const span of wrapper.findAll('.sm-nav-link span')) {
      expect(span.attributes('style') || '').not.toContain('display: none')
    }
    expect(wrapper.find('.sm-subnav').attributes('style') || '').not.toContain('display: none')
  })
})
