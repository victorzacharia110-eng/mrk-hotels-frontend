import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'
import { outletApi } from '@/api'
import { outlets, selectedOutlet, loaded } from '@/composables/useOutletContext'
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
    loaded.value = false
  })

  it('always opens the gate, even when the property has one store', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [store] } })

    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(true)
    expect(wrapper.text()).toContain('Store A')

    await wrapper.find('.sm-outlet-option').trigger('click')
    await flushPromises()

    expect(selectedOutlet.value.outlet_id).toBe('outlet-store-a')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
  })

  it('shows store outlets to the inventory user', async () => {
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

    expect(wrapper.text()).toContain('Store A')
    expect(wrapper.text()).toContain('Store B')
  })
})
