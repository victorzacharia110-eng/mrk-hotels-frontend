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
  fbDayCloseApi: { index: vi.fn().mockResolvedValue({ data: {} }) },
  notificationApi: {
    unreadCount: vi.fn().mockResolvedValue({ data: {} }),
    alerts: vi.fn().mockResolvedValue({ data: { alerts: [] } }),
    index: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}))

const store = {
  outlet_id: 'outlet-store-a',
  name: 'Store A',
  type: 'store',
  is_active: true,
}

async function mountLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
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

  it('auto-selects the only store without showing the gate', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [store] } })

    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
    expect(selectedOutlet.value.outlet_id).toBe('outlet-store-a')
    expect(selectedStore.value.outlet_id).toBe('outlet-store-a')
  })

  it('shows the exact store after choosing the Store outlet type', async () => {
    outletApi.index.mockResolvedValue({
      data: {
        outlets: [
          store,
          { outlet_id: 'outlet-store-b', name: 'Store B', type: 'store', is_active: true },
          { outlet_id: 'outlet-bar', name: 'Bar 1', type: 'bar', is_active: true },
        ],
      },
    })

    const wrapper = await mountLayout()

    const gateList = wrapper.find('.sm-outlet-gate-list')
    expect(gateList.text()).toContain('Bar')
    expect(gateList.text()).toContain('Store')
    expect(gateList.text()).not.toContain('Store A')

    const storeType = gateList.findAll('.sm-outlet-option').find((button) => button.text().includes('Store'))
    await storeType.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Which Store?')
    expect(wrapper.find('.sm-outlet-gate-list').text()).toContain('Store A')
    expect(wrapper.find('.sm-outlet-gate-list').text()).toContain('Store B')
  })

  it('asks which store supplies a selling outlet after it is chosen', async () => {
    outletApi.index.mockResolvedValue({
      data: {
        outlets: [
          store,
          { outlet_id: 'outlet-store-b', name: 'Store B', type: 'store', is_active: true },
          { outlet_id: 'outlet-bar', name: 'Bar 1', type: 'bar', is_active: true },
        ],
      },
    })

    const wrapper = await mountLayout()

    const barType = wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Bar'))
    await barType.trigger('click')
    await flushPromises()

    const bar = wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Bar 1'))
    await bar.trigger('click')
    await flushPromises()

    expect(selectedOutlet.value.outlet_id).toBe('outlet-bar')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(true)
    expect(wrapper.text()).toContain('Which store are you working with?')

    const chosenStore = wrapper.findAll('.sm-outlet-option').find((button) => button.text().includes('Store A'))
    await chosenStore.trigger('click')
    await flushPromises()

    expect(selectedStore.value.outlet_id).toBe('outlet-store-a')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
  })
})
