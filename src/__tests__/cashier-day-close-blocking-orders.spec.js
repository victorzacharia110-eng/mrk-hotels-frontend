import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'

/**
 * The F&B Day Close screen lists the actual orders holding a business date
 * open, but settlement now happens on the Order Summary page. Voiding can still
 * be done in place, and history is capped at the last 30 closed days.
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
let router

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
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/cashier/order-summary', name: 'cashier-order-summary', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/cashier/day-close')
  await router.isReady()

  const wrapper = mount(CashierDayClosePage, { global: { plugins: [pinia, i18n, router] } })
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
    expect(text).toContain('Oct 11, 2026')
    expect(text).toContain('Oct 12, 2026')

    wrapper.unmount()
  })

  it('sends settlement to the Order Summary page instead of settling inline', async () => {
    const wrapper = await mountPage()
    const push = vi.spyOn(router, 'push')

    await buttonByText(wrapper, 'Order Summary').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'cashier-order-summary', query: { order: 'o1' } })
    expect(pay).not.toHaveBeenCalled()
    expect(wrapper.find('.sm-modal').exists()).toBe(false)

    wrapper.unmount()
  })

  it('voids a blocking ticket only once a reason is given', async () => {
    const wrapper = await mountPage()

    await buttonByText(wrapper, 'Void Order').trigger('click')
    await flushPromises()

    const modal = wrapper.find('.sm-modal')
    expect(modal.text()).toContain('Void blocking order')

    let confirm = modal.findAll('button').find((b) => b.text().includes('Void Order'))
    expect(confirm.attributes('disabled')).toBeDefined()

    await wrapper.find('#dc-void-reason').setValue('guest left')
    confirm = wrapper.find('.sm-modal').findAll('button').find((b) => b.text().includes('Void Order'))
    await confirm.trigger('click')
    await flushPromises()

    expect(voidOrder).toHaveBeenCalledWith('o1', { reason: 'guest left' })
    expect(index.mock.calls.length).toBeGreaterThan(1)

    wrapper.unmount()
  })

  it('caps history at the last 30 closed days', async () => {
    const dayCloses = Array.from({ length: 35 }, (_, i) => ({
      fb_day_close_id: `dc-${i}`,
      close_date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      closed_by: { name: 'Manager' },
      closed_at: `2026-08-${String(i + 1).padStart(2, '0')}T23:00:00`,
      running_orders_count: 0,
    }))
    history.mockResolvedValue({ data: { day_closes: dayCloses } })

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('30 records')
    expect(wrapper.text()).not.toContain('Aug 31, 2026')
    expect(wrapper.text()).not.toContain('Aug 35, 2026')

    wrapper.unmount()
  })
})
