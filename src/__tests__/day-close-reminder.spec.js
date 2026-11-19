import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import i18n from '@/locales/i18n'

const index = vi.fn()
vi.mock('@/api', () => ({
  fbDayCloseApi: { index: () => index() },
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/app/take-order' }),
  useRouter: () => ({ push }),
}))

const { useWorkingDateStore } = await import('@/stores/workingDate')
const { default: DayCloseReminderModal } = await import('@/components/cashier/DayCloseReminderModal.vue')

/**
 * Review item 18: the business date and the Day Close reminder.
 *
 * The reminder used to be a `ref` inside each of three components, each with
 * its own sessionStorage key, so the cashier panel rendered the layout modal
 * AND the page banner on top of each other, and the "a new day has started"
 * test compared the open date against the BROWSER's calendar day instead of
 * the hotel's.
 */

const TZ = 'Africa/Dar_es_Salaam'
const CAN_PROCEED = ['cashier', 'bartender', 'waiter', 'store_manager', 'hotel_admin', 'manager']

let pinia

const mountModal = (role, proceedRoute = 'cashier-day-close', newOrderRoute = '') =>
  mount(DayCloseReminderModal, {
    props: { proceedRoute, canProceedRoles: CAN_PROCEED, role, newOrderRoute },
    // The SAME pinia the assertions read from — a second instance here would
    // give the component an empty store.
    global: { plugins: [pinia, i18n] },
  })

describe('workingDate store — the hotel clock, not the browser clock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    index.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the day closed once the hotel date has moved on', async () => {
    // 22:30 UTC on the 25th is 01:30 on the 26th in Dar es Salaam (+3). A
    // browser sitting in UTC still calls this the 25th, so nothing would ever
    // remind the 25th to be closed.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T22:30:00Z'))
    index.mockResolvedValue({
      data: { close_date: '2026-09-25', open_date: '2026-09-26', timezone: TZ },
    })

    const store = useWorkingDateStore()
    await store.ensureLoaded()

    expect(store.today).toBe('2026-09-26')
    expect(store.needsDayClose).toBe(true)
    // The working date stays on the open business day until it is closed.
    expect(store.workingDate).toBe('2026-09-25')
  })

  it('stays quiet while the hotel is still on the open date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T20:00:00Z')) // 23:00 hotel time
    index.mockResolvedValue({ data: { open_date: '2026-09-25', timezone: TZ } })

    const store = useWorkingDateStore()
    await store.ensureLoaded()

    expect(store.today).toBe('2026-09-25')
    expect(store.needsDayClose).toBe(false)
  })

  it('keeps the panels usable when the endpoint is unreachable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T12:00:00Z'))
    index.mockRejectedValue(new Error('offline'))

    const store = useWorkingDateStore()
    await store.ensureLoaded()

    expect(store.workingDate).toBe(store.today)
    expect(store.needsDayClose).toBe(false)
  })
})

describe('workingDate store — one shared reminder', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    index.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('remembers a dismissal across every panel in the session', async () => {
    index.mockResolvedValue({ data: { open_date: '2026-09-25', timezone: TZ } })
    const store = useWorkingDateStore()

    await store.initDayCloseReminder()
    expect(store.dayCloseReminderVisible).toBe(true)

    store.dismissDayCloseReminder()
    expect(store.dayCloseReminderVisible).toBe(false)

    // A second panel shell mounting in the same session must NOT raise it
    // again — the separate keys are what let two modals stack up.
    const otherPanel = useWorkingDateStore()
    await otherPanel.initDayCloseReminder()
    expect(otherPanel.dayCloseReminderVisible).toBe(false)
  })

  it('does not raise it on a day that needs no close', async () => {
    index.mockResolvedValue({ data: { open_date: '2026-09-26', timezone: TZ } })
    const store = useWorkingDateStore()

    await store.initDayCloseReminder()
    expect(store.dayCloseReminderVisible).toBe(false)
  })

  it('raises it on login when previous-date orders are still blocking', async () => {
    index.mockResolvedValue({
      data: { open_date: '2026-09-26', timezone: TZ, blocking_orders_count: 5 },
    })
    const store = useWorkingDateStore()

    await store.initDayCloseReminder()
    expect(store.needsDayClose).toBe(false)
    expect(store.blockingOrdersCount).toBe(5)
    expect(store.hasUnsettledOrders).toBe(true)
    expect(store.dayCloseReminderVisible).toBe(true)
  })

  it('raises it on login when orders are still unsettled', async () => {
    index.mockResolvedValue({
      data: { open_date: '2026-09-26', timezone: TZ, unsettled_orders_count: 3 },
    })
    const store = useWorkingDateStore()

    await store.initDayCloseReminder()
    expect(store.needsDayClose).toBe(false)
    expect(store.hasUnsettledOrders).toBe(true)
    expect(store.dayCloseReminderVisible).toBe(true)
  })
})

describe('DayCloseReminderModal', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    sessionStorage.clear()
    push.mockReset()
    const store = useWorkingDateStore()
    store.dayCloseReminderVisible = true
    store.openDate = '2026-09-25'
    store.unsettledOrdersCount = 0
    store.runningOrdersCount = 0
    store.blockingOrdersCount = 0
  })

  it('states the date the new orders are filed under', () => {
    const wrapper = mountModal('cashier')

    expect(wrapper.text()).toContain('September 25, 2026')
  })

  it('gives the waiter the PROCEED button the review shows them', () => {
    // "CASHIER | BAR TENDER | WAITER | INVENTORY MANAGER PANEL will get these
    // pop up info" — the popup has CONFIRM and PROCEED TO DAY CLOSE.
    const wrapper = mountModal('waiter')

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(wrapper.text()).toContain('Proceed to Day Close')
    expect(wrapper.text()).toContain('Confirm')
  })

  it('hides PROCEED from a role that may not close the day', () => {
    const wrapper = mountModal('receptionist')

    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Proceed to Day Close')
  })

  it('dismisses and navigates on the two buttons', async () => {
    const store = useWorkingDateStore()

    await mountModal('cashier').findAll('button')[1].trigger('click')
    expect(store.dayCloseReminderVisible).toBe(false)
    expect(push).not.toHaveBeenCalled()

    store.dayCloseReminderVisible = true
    await mountModal('cashier').findAll('button')[0].trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'cashier-day-close' })
  })

  it('explains blocking orders and offers both actions from the modal', async () => {
    const store = useWorkingDateStore()
    store.blockingOrdersCount = 5

    const wrapper = mountModal('cashier', 'cashier-day-close', 'cashier-dine-in')

    expect(wrapper.text()).toContain('Unsettled orders')
    expect(wrapper.text()).toContain('5 order(s) from a previous business date are still running or unpaid.')
    expect(wrapper.text()).toContain(`new working date (${store.today})`)
    expect(wrapper.text()).toContain('Proceed to Day Close')
    expect(wrapper.text()).toContain('Take New Orders')

    await wrapper.findAll('button')[0].trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'cashier-day-close' })
    expect(store.dayCloseReminderVisible).toBe(false)
  })

  it('opens the new-order tab straight from the blocking-orders modal', async () => {
    const store = useWorkingDateStore()
    store.blockingOrdersCount = 1

    const wrapper = mountModal('bartender', 'cashier-day-close', 'cashier-dine-in')
    await wrapper.findAll('button')[1].trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'cashier-dine-in' })
    expect(store.dayCloseReminderVisible).toBe(false)
  })
})
