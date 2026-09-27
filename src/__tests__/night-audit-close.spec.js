import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const close = vi.fn()
const report = vi.fn()
const history = vi.fn()

vi.mock('@/api', () => ({
  nightAuditApi: {
    report: (...a) => report(...a),
    history: (...a) => history(...a),
    close: (...a) => close(...a),
  },
  fbDayCloseApi: { index: vi.fn().mockResolvedValue({ data: {} }) },
}))

const NightAuditPage = (await import('@/pages/reception/NightAuditPage.vue')).default

const REPORT_OPEN = {
  closed: false,
  revenue: { rooms: 0, fnb: 0, laundry: 0, fun_games: 0, total: 0 },
  collections: { by_method: { cash: 0 }, total: 0 },
  counts: { arrivals: 0, departures: 0, in_house: 0, reservations_created: 0 },
}

async function mountPage() {
  const wrapper = mount(NightAuditPage, { global: { plugins: [i18n, createPinia()] } })
  await flushPromises()
  return wrapper
}

/*
  The page's own close action is the only .btn-lg on it; the confirm dialog
  teleports to the body, so it is addressed separately via .confirm-modal-foot.
*/
const closeButton = (w) => w.find('.btn-lg')
const confirmButton = () =>
  document.querySelector('.confirm-modal-foot .btn-primary') ||
  document.querySelector('.confirm-modal-foot button:last-child')

describe('NightAuditPage — closing a business day', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed: false, due_outs: [] } })
    history.mockResolvedValue({ data: { day_closes: [] } })
    close.mockResolvedValue({ data: {} })
  })

  /*
    The backend refuses to close a business day that has not fully passed
    (`if ($date->isAfter(now()->subDay()->endOfDay()))` -> 422). The page used to
    default to today and offer the button anyway, so the one action the page
    exists to perform always came back 422.
  */
  it('will not offer to close the current business date', async () => {
    const wrapper = await mountPage()

    const button = closeButton(wrapper)
    expect(button).toBeDefined()
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('after midnight')
  })

  it('offers the close action once the selected date has passed', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const asInput = yesterday.toISOString().slice(0, 10)

    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(asInput)
    await flushPromises()

    expect(closeButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('does not send a request the backend is bound to reject', async () => {
    const wrapper = await mountPage()

    // The button is disabled, so a click cannot reach the API at all.
    await closeButton(wrapper).trigger('click')
    await flushPromises()

    expect(document.querySelector('.confirm-modal')).toBeNull()
    expect(close).not.toHaveBeenCalled()
  })

  it('closes a date that has passed', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const asInput = yesterday.toISOString().slice(0, 10)

    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(asInput)
    await flushPromises()

    await closeButton(wrapper).trigger('click')
    await flushPromises()

    const confirm = confirmButton()
    expect(confirm).not.toBeNull()
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(close).toHaveBeenCalledWith({ date: asInput })
  })

  it('reads the date in the browser timezone, not UTC', async () => {
    // toISOString() is UTC. For part of every evening the hotel is on the next
    // calendar day already, so the page used to open on yesterday.
    await mountPage()
    const sent = report.mock.calls[0][0].date
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    // The store may supply the hotel's business date; it must never be a UTC
    // reading a day ahead of the browser.
    expect(sent <= local).toBe(true)
  })
})
