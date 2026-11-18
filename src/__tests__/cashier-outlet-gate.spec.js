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

async function mountLayout(
  user = { user_id: 'user-cathy', user_role: 'cashier', name: 'Cathy Cashier' },
) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = user
  useAuthStore().tenant = { hotel_name: 'Brand Hotel' }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/cashier')
  await router.isReady()

  const wrapper = mount(CashierLayout, {
    global: {
      plugins: [i18n, router, pinia],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
  await flushPromises()

  return wrapper
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

async function enterPin(wrapper, pin) {
  for (const digit of pin) {
    const key = wrapper.findAll('.gate-key').find((button) => button.text() === digit)
    await key.trigger('click')
  }
}

describe('cashier outlet gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    outlets.value = []
    selectedOutlet.value = null
    loaded.value = false
  })

  it('opens the gate for a fresh session and asks for the counter PIN', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [bar] } })
    outletApi.verifyAccess.mockResolvedValue({ data: { outlet: bar } })

    const wrapper = await mountLayout()

    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(true)
    expect(wrapper.text()).toContain('Choose a selling point')

    await wrapper.find('.outlet-option').trigger('click')
    expect(wrapper.text()).toContain('Which Bar?')

    await wrapper.find('.outlet-option').trigger('click')
    expect(wrapper.find('#gate-access-code').exists()).toBe(false)
    expect(wrapper.findAll('.gate-pin-slot')).toHaveLength(4)
    expect(wrapper.findAll('.gate-key')).toHaveLength(12)

    expect(buttonByText(wrapper, 'Unlock counter')).toBeUndefined()
    await enterPin(wrapper, '482')
    expect(wrapper.findAll('.gate-pin-slot.filled')).toHaveLength(3)
    await enterPin(wrapper, '1')
    await flushPromises()

    expect(outletApi.verifyAccess).toHaveBeenCalledWith('outlet-bar-1', {
      access_code: '4821',
    })
    expect(selectedOutlet.value.outlet_id).toBe('outlet-bar-1')
    expect(wrapper.find('.sm-modal-backdrop').exists()).toBe(false)
  })

  it('keeps the unlocked counter across a refresh while the user stays signed in', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [bar] } })
    outletApi.verifyAccess.mockResolvedValue({ data: { outlet: bar } })

    const first = await mountLayout()
    await first.find('.outlet-option').trigger('click')
    await first.find('.outlet-option').trigger('click')
    await enterPin(first, '4821')
    await flushPromises()

    expect(first.find('.sm-modal-backdrop').exists()).toBe(false)
    expect(selectedOutlet.value.outlet_id).toBe('outlet-bar-1')
    first.unmount()

    const second = await mountLayout()

    expect(second.find('.sm-modal-backdrop').exists()).toBe(false)
    expect(selectedOutlet.value.outlet_id).toBe('outlet-bar-1')
  })

  it('keeps the unlock for the same user but not for a different user', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [bar] } })
    outletApi.verifyAccess.mockResolvedValue({ data: { outlet: bar } })

    const first = await mountLayout()
    await first.find('.outlet-option').trigger('click')
    await first.find('.outlet-option').trigger('click')
    await enterPin(first, '4821')
    await flushPromises()
    first.unmount()

    const sameUser = await mountLayout()
    expect(sameUser.find('.sm-modal-backdrop').exists()).toBe(false)
    sameUser.unmount()

    const otherUser = await mountLayout({
      user_id: 'user-dan',
      user_role: 'cashier',
      name: 'Dan Cashier',
    })
    expect(otherUser.find('.sm-modal-backdrop').exists()).toBe(true)
  })

  it('lets a cashier create the first counter and shows the default PIN once', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [] } })
    outletApi.storeSellingPoint.mockResolvedValue({
      data: {
        access_code: '4821',
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
    expect(wrapper.find('.gate-code').text()).toBe('4821')

    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await wrapper.find('.gate-code-copy').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('4821')
    expect(wrapper.text()).toContain('PIN copied')

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
