import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'
import { outletApi } from '@/api'
import { outlets, selectedOutlet, loaded } from '@/composables/useOutletContext'
import CashierLayout from '@/layouts/CashierLayout.vue'

vi.mock('@/api', () => ({
  outletApi: {
    index: vi.fn(),
    verifyAccess: vi.fn(),
    storeSellingPoint: vi.fn(),
    claimAccess: vi.fn(),
  },
  fbDayCloseApi: { index: vi.fn().mockResolvedValue({ data: {} }) },
  cashierApi: { shift: vi.fn().mockResolvedValue({ data: {} }) },
  printerApi: { settings: vi.fn().mockResolvedValue({ data: {} }) },
  orderApi: { live: vi.fn().mockResolvedValue({ data: [] }) },
  authApi: { me: vi.fn().mockResolvedValue({ data: {} }) },
}))

const bar = {
  outlet_id: 'outlet-bar-1',
  name: 'Bar 1',
  type: 'bar',
  is_active: true,
  has_access_code: true,
  created_by_name: 'Cathy Cashier',
  created_at: '2026-11-10T10:00:00Z',
  stock_department: { name: 'Bar 1' },
}

async function mountLayout() {
  setActivePinia(createPinia())

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/cashier')
  await router.isReady()

  const wrapper = mount(CashierLayout, {
    global: {
      plugins: [i18n, router, createPinia()],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
  await flushPromises()

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: 'cashier', name: 'Cathy Cashier' }
  useAuthStore().tenant = { hotel_name: 'Brand Hotel' }
  await flushPromises()

  return wrapper
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

describe('cashier outlet gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    outlets.value = []
    selectedOutlet.value = null
    loaded.value = false
  })

  it('always opens the gate and asks for the counter access code', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [bar] } })
    outletApi.verifyAccess.mockResolvedValue({ data: { outlet: bar } })

    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(true)
    expect(wrapper.text()).toContain('Choose a selling point')

    await wrapper.find('.outlet-option').trigger('click')
    expect(wrapper.find('#gate-access-code').exists()).toBe(true)

    await wrapper.find('#gate-access-code').setValue('THB-BAR-1-ABC123')
    await buttonByText(wrapper, 'Unlock counter').trigger('click')
    await flushPromises()

    expect(outletApi.verifyAccess).toHaveBeenCalledWith('outlet-bar-1', {
      access_code: 'THB-BAR-1-ABC123',
    })
    expect(selectedOutlet.value.outlet_id).toBe('outlet-bar-1')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
  })

  it('lets a cashier create the first counter and shows the default code once', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [] } })
    outletApi.storeSellingPoint.mockResolvedValue({
      data: {
        access_code: 'THB-BAR-1-NEW123',
        outlet: { ...bar, has_access_code: true },
      },
    })

    const wrapper = await mountLayout()

    expect(wrapper.text()).toContain('No selling points have been created yet')

    await wrapper.find('.gate-create-link').trigger('click')
    await wrapper.find('#gate-counter-name').setValue('Bar 1')
    await buttonByText(wrapper, 'Create selling point').trigger('click')
    await flushPromises()

    expect(outletApi.storeSellingPoint).toHaveBeenCalledWith({ name: 'Bar 1', type: 'bar' })
    expect(wrapper.find('.gate-code').text()).toBe('THB-BAR-1-NEW123')

    await buttonByText(wrapper, 'I saved it, continue').trigger('click')
    await flushPromises()

    expect(selectedOutlet.value.outlet_id).toBe('outlet-bar-1')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
  })

  it('shows who already created a duplicate counter and when', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [] } })
    outletApi.storeSellingPoint.mockRejectedValue({
      response: {
        data: {
          existing: {
            ...bar,
            created_by_name: 'Cathy Cashier',
            created_at: '2026-11-10T10:00:00Z',
          },
        },
      },
    })

    const wrapper = await mountLayout()

    await wrapper.find('.gate-create-link').trigger('click')
    await wrapper.find('#gate-counter-name').setValue('Bar 1')
    await buttonByText(wrapper, 'Create selling point').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Selling point already exists')
    expect(wrapper.text()).toContain('Cathy Cashier')
    expect(wrapper.text()).toContain('Bar 1')
  })
})
