import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import i18n from '@/locales/i18n'

/**
 * The F&B Day Close screen lists the actual orders holding a business date
 * open — not just a count — so a blocked operator can settle or void the
 * offending ticket from the same page instead of hunting for order numbers.
 */

const index = vi.fn()
const history = vi.fn()
const pay = vi.fn()
const voidOrder = vi.fn()

vi.mock('@/api', () => ({
  fbDayCloseApi: {
    index: (...a) => index(...a),
    history: (...a) => history(...a),
    store: vi.fn(),
    updateTimezone: vi.fn(),
  },
  orderApi: {
    pay: (...a) => pay(...a),
    voidOrder: (...a) => voidOrder(...a),
  },
}))

const { default: CashierDayClosePage } = await import('@/pages/cashier/CashierDayClosePage.vue')

const blocking = [
  {
    order_id: 'o1',
    order_number: 'ORD-1',
    business_date: '2026-10-11',
    table_number: 'T1',
    waiter_name: 'Amina',
    status: 'pending',
    payment_status: 'unpaid',
    total_amount: 20000,
    can_settle: true,
    can_void: true,
  },
  {
    order_id: 'o2',
    order_number: 'ORD-2',
    business_date: '2026-10-12',
    room_number: '101',
    waiter_name: 'Juma',
    status: 'served',
    payment_status: 'unpaid',
    total_amount: 15000,
    can_settle: true,
    can_void: true,
  },
]

let pinia

function statusPayload(overrides = {}) {
  return {
    data: {
      open_date: '2026-10-13',
      close_date: '2026-10-12',
      timezone: 'Africa/Dar_es_Salaam',
      running_orders_count: 2,
      unsettled_orders_count: 2,
      can_close: false,
      close_day_has_ended: true,
      latest_closed_date: null,
      blocking_orders: blocking,
      blocking_orders_count: 2,
      ...overrides,
    },
  }
}

async function mountPage() {
  const wrapper = mount(CashierDayClosePage, { global: { plugins: [pinia, i18n] } })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find((b) => b.text().includes(text))
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  index.mockReset().mockResolvedValue(statusPayload())
  history.mockReset().mockResolvedValue({ data: { day_closes: [] } })
  pay.mockReset().mockResolvedValue({ data: {} })
  voidOrder.mockReset().mockResolvedValue({ data: {} })
})

describe('cashier day close — blocking orders', () => {
  it('lists each blocking ticket with its table, waiter and amount', async () => {
    const wrapper = await mountPage()

    const text = wrapper.text()
    expect(text).toContain('ORD-1')
    expect(text).toContain('ORD-2')
    expect(text).toContain('Amina')
    expect(text).toContain('Juma')
    expect(text).toContain('101')
    expect(text).toContain('20,000')
    // The business date column shows which previous day each orphan belongs to.
    expect(text).toContain('Oct 11, 2026')
    expect(text).toContain('Oct 12, 2026')

    wrapper.unmount()
  })

  it('settles a blocking ticket from the page and refreshes', async () => {
    const wrapper = await mountPage()

    await buttonByText(wrapper, 'Settle').trigger('click')
    await flushPromises()

    const modal = wrapper.find('.sm-modal')
    expect(modal.text()).toContain('Collect payment')

    await modal.findAll('button').find((b) => b.text().includes('Settle')).trigger('click')
    await flushPromises()

    expect(pay).toHaveBeenCalledWith('o1', { method: 'cash', provider: undefined })
    // A settlement must refetch the close state so the list shrinks.
    expect(index.mock.calls.length).toBeGreaterThan(1)

    wrapper.unmount()
  })

  it('voids a blocking ticket only once a reason is given', async () => {
    const wrapper = await mountPage()

    await buttonByText(wrapper, 'Void').trigger('click')
    await flushPromises()

    const modal = wrapper.find('.sm-modal')
    expect(modal.text()).toContain('Void this order?')

    // No reason yet — the action stays disabled.
    let confirm = modal.findAll('button').find((b) => b.text().includes('Void'))
    expect(confirm.attributes('disabled')).toBeDefined()

    await wrapper.find('#dc-void-reason').setValue('guest left')
    confirm = wrapper.find('.sm-modal').findAll('button').find((b) => b.text().includes('Void'))
    await confirm.trigger('click')
    await flushPromises()

    expect(voidOrder).toHaveBeenCalledWith('o1', { reason: 'guest left' })

    wrapper.unmount()
  })
})
