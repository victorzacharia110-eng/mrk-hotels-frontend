import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import i18n from '@/locales/i18n'
import { useAuthStore } from '@/stores/auth'

/**
 * Blocked Devices is muted by default and the switch is tenant-wide. A manager
 * or administrator turns it on; every other user sees the resulting state but
 * cannot change it.
 */

const devices = vi.fn()
const unblockDevice = vi.fn()
const showSettings = vi.fn()
const updateSettings = vi.fn()

vi.mock('@/api', () => ({
  authApi: {},
  posApi: {
    devices: (...a) => devices(...a),
    unblockDevice: (...a) => unblockDevice(...a),
  },
  hotelSettingsApi: {
    show: (...a) => showSettings(...a),
    update: (...a) => updateSettings(...a),
  },
}))

const { default: CashierBlockedDevicesPage } = await import('@/pages/cashier/CashierBlockedDevicesPage.vue')

let pinia
let authStore

function settingsPayload(enabled) {
  return { data: { hotel: { blocked_devices_enabled: enabled } } }
}

function mountPage() {
  return mount(CashierBlockedDevicesPage, { global: { plugins: [pinia, i18n] } })
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  authStore = useAuthStore()
  authStore.user = { user_role: 'manager' }

  devices.mockReset().mockResolvedValue({
    data: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 },
  })
  unblockDevice.mockReset()
  showSettings.mockReset().mockResolvedValue(settingsPayload(false))
  updateSettings.mockReset().mockResolvedValue({ data: {} })
})

describe('cashier blocked devices toggle', () => {
  it('starts off and does not fetch devices', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(showSettings).toHaveBeenCalled()
    expect(wrapper.find('.toggle-btn').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(devices).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('lets a manager turn it on for the tenant', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('.toggle-btn').trigger('click')
    await flushPromises()

    expect(updateSettings).toHaveBeenCalledWith({ blocked_devices_enabled: true })
    expect(devices).toHaveBeenCalledWith({ status: 'blocked', per_page: 25, page: 1 })
    expect(wrapper.find('.toggle-btn').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('table').exists()).toBe(true)

    wrapper.unmount()
  })

  it('loads devices when the tenant setting is already on', async () => {
    showSettings.mockResolvedValue(settingsPayload(true))

    const wrapper = mountPage()
    await flushPromises()

    expect(devices).toHaveBeenCalled()
    expect(wrapper.find('table').exists()).toBe(true)

    wrapper.unmount()
  })

  it('shows the state without a switch to non-managers', async () => {
    authStore.user = { user_role: 'cashier' }

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.toggle-btn').exists()).toBe(false)
    expect(wrapper.find('.toggle-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('Only a manager or administrator can change this.')

    wrapper.unmount()
  })
})
