import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { outletApi, departmentApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import OutletManagePage from '@/pages/outlets/OutletManagePage.vue'

vi.mock('@/api', () => ({
  outletApi: {
    index: vi.fn(),
    store: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    resetAccess: vi.fn(),
  },
  departmentApi: { index: vi.fn() },
}))

const outlet = {
  outlet_id: 'outlet-1',
  name: 'Terrace',
  type: 'restaurant',
  is_active: true,
  has_access_code: true,
}

function mountPage() {
  i18n.global.locale.value = 'en'
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { user_role: 'manager' }

  return mount(OutletManagePage, {
    global: {
      plugins: [i18n, pinia],
      stubs: {
        SearchableSelect: {
          props: ['modelValue', 'options'],
          template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)">' +
            '<option v-for="option in options" :key="option.value" :value="option.value">' +
            '{{ option.label }}</option></select>',
        },
        DeleteConfirmModal: true,
      },
    },
  })
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

describe('outlet manager PIN display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    outletApi.index.mockResolvedValue({ data: { outlets: [] } })
    departmentApi.index.mockResolvedValue({ data: { data: [] } })
  })

  it('shows the generated PIN once when a counter is created', async () => {
    outletApi.store.mockResolvedValue({
      data: { access_code: '4821', outlet },
    })

    const wrapper = mountPage()
    await flushPromises()

    await buttonByText(wrapper, 'New Outlet').trigger('click')
    await wrapper.find('input[type="text"]').setValue('Terrace')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(outletApi.store).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Terrace' }),
    )
    expect(wrapper.text()).toContain('Counter created. PIN for Terrace:')
    expect(wrapper.find('.pin-code').text()).toBe('4821')

    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    await wrapper.find('.pin-row button').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('4821')
    expect(wrapper.text()).toContain('PIN copied')
  })

  it('shows the new PIN after a reset', async () => {
    outletApi.index.mockResolvedValue({ data: { outlets: [outlet] } })
    outletApi.resetAccess.mockResolvedValue({
      data: { access_code: '7315', outlet },
    })

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('button[title="Reset PIN"]').trigger('click')
    await flushPromises()

    expect(outletApi.resetAccess).toHaveBeenCalledWith('outlet-1')
    expect(wrapper.text()).toContain('New PIN for Terrace:')
    expect(wrapper.find('.pin-code').text()).toBe('7315')
  })
})
