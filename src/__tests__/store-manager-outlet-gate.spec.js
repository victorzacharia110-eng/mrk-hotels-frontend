import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'
import { outletApi } from '@/api'
import { outlets, selectedOutlet, selectedStore, loaded } from '@/composables/useOutletContext'
import StoreManagerLayout from '@/layouts/StoreManagerLayout.vue'

vi.mock('@/api', () => ({
  outletApi: { index: vi.fn() },
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
    outlets.value = []
    selectedOutlet.value = null
    selectedStore.value = null
    loaded.value = false
  })

  it('auto-selects the only store and ignores non-store outlets', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [bar, storeA] } })

    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
    expect(selectedOutlet.value.outlet_id).toBe('outlet-store-a')
    expect(selectedStore.value.outlet_id).toBe('outlet-store-a')
    expect(wrapper.find('.sm-outlet-picker').exists()).toBe(false)
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

  it('confirms the chosen store directly', async () => {
    outletApi.index.mockResolvedValue({
      data: { outlets: [storeA, storeB, bar] },
    })

    const wrapper = await mountLayout()

    const storeOption = wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Store B'))
    await storeOption.trigger('click')
    await flushPromises()

    expect(selectedOutlet.value.outlet_id).toBe('outlet-store-b')
    expect(selectedStore.value.outlet_id).toBe('outlet-store-b')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
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
    outlets.value = []
    selectedOutlet.value = null
    selectedStore.value = null
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
