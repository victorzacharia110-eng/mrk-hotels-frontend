import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RequisitionPage from '@/pages/requisitions/RequisitionPage.vue'
import i18n from '@/locales/i18n'

/**
 * The requisition notify flow. A requisition is pushed to a recipient over
 * e-mail, SMS or both; the recipient may be typed in, and "both" defers to the
 * hotel's contacts on file (so it sends no single `to`).
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
  useAuthStore: () => ({ user: { user_role: 'store_manager', full_name: 'Keeper' }, can: () => true }),
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

const INDENT = { indent_id: 3, indent_number: 'IND-0003', items: [] }

describe('RequisitionPage notify', () => {
  afterEach(() => vi.clearAllMocks())

  it('opens the notify dialog from the detail with e-mail preselected', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.openDetail(INDENT)
    wrapper.vm.emailDetail()

    expect(wrapper.vm.modal).toBe('notify')
    expect(wrapper.vm.notifyIndent).toEqual(INDENT)
    expect(wrapper.vm.notifyChannel).toBe('email')
  })

  it('sends by e-mail to a typed-in recipient', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.openNotify(INDENT)
    wrapper.vm.notifyChannel = 'email'
    wrapper.vm.notifyTo = 'head@example.com'
    await wrapper.vm.submitNotify()

    expect(api.inventoryOpsApi.emailIndent).toHaveBeenCalledWith(3, 'head@example.com', 'email')
  })

  it('sends an SMS to a typed-in phone number', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.openNotify(INDENT)
    wrapper.vm.notifyChannel = 'sms'
    wrapper.vm.notifyTo = ' 0712345678 '
    await wrapper.vm.submitNotify()

    expect(api.inventoryOpsApi.emailIndent).toHaveBeenCalledWith(3, '0712345678', 'sms')
  })

  it('sends both to the hotel contacts (no single recipient)', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.openNotify(INDENT)
    wrapper.vm.notifyChannel = 'both'
    wrapper.vm.notifyTo = 'ignored@example.com'
    await wrapper.vm.submitNotify()

    expect(api.inventoryOpsApi.emailIndent).toHaveBeenCalledWith(3, null, 'both')
  })

  it('leaves the recipient blank so the backend uses the hotel contact', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.openNotify(INDENT)
    wrapper.vm.notifyChannel = 'email'
    wrapper.vm.notifyTo = ''
    await wrapper.vm.submitNotify()

    expect(api.inventoryOpsApi.emailIndent).toHaveBeenCalledWith(3, null, 'email')
  })

  it('surfaces a delivery error inside the dialog and keeps it open', async () => {
    const wrapper = mountPage()
    await flushPromises()
    api.inventoryOpsApi.emailIndent.mockRejectedValueOnce({ response: { data: { message: 'No valid phone number.' } } })

    wrapper.vm.openNotify(INDENT)
    wrapper.vm.notifyChannel = 'sms'
    await wrapper.vm.submitNotify()

    expect(wrapper.vm.notifyErr).toBe('No valid phone number.')
    expect(wrapper.vm.modal).toBe('notify')
  })

  it('offers the notify dialog right after sending a requisition', async () => {
    const wrapper = mountPage()
    await flushPromises()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await wrapper.vm.send(INDENT)

    expect(api.inventoryOpsApi.sendIndent).toHaveBeenCalledWith(3)
    expect(wrapper.vm.modal).toBe('notify')
    expect(wrapper.vm.notifyIndent).toEqual(INDENT)
  })
})
