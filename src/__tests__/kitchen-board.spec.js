import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KitchenBoardPage from '@/pages/kitchen/KitchenBoardPage.vue'
import i18n from '@/locales/i18n'

const api = vi.hoisted(() => {
  const created = []
  const mk = (initial = {}) =>
    new Proxy(initial, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined
        if (!(prop in target)) {
          target[prop] = vi.fn().mockResolvedValue({ data: {} })
          created.push(target[prop])
        }
        return target[prop]
      },
    })
  return { created, orderApi: mk() }
})

vi.mock('@/api', () => ({ orderApi: api.orderApi }))

const iso = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

let wrapper

async function mountBoard() {
  setActivePinia(createPinia())
  for (const fn of api.created) fn.mockReset().mockResolvedValue({ data: {} })
  api.orderApi.index.mockResolvedValue({ data: [] })
  wrapper = mount(KitchenBoardPage, { global: { plugins: [i18n] } })
  await flushPromises()
  await wrapper.vm.$nextTick()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('KitchenBoardPage', () => {
  it('defaults the board calendar to today (local ISO)', async () => {
    await mountBoard()
    const input = wrapper.find('input[type="date"]')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe(iso(new Date()))
  })

  it('renders today\'s open grid and the closed-ticket history for a past date', async () => {
    await mountBoard()
    const past = iso(new Date(Date.now() - 86400000))
    api.orderApi.index.mockImplementation((params = {}) =>
      params.status === 'completed'
        ? Promise.resolve({
            data: [
              {
                order_id: 501,
                order_number: 'KB-501',
                department: 'restaurant',
                table_number: '5',
                items: [{ quantity: 2 }, { quantity: 1 }],
                total_amount: 25000,
                status: 'completed',
                waiter_name: 'Neema',
                settled_at: '2026-09-11T12:34:00Z',
                created_at: '2026-09-11T12:00:00Z',
              },
              {
                order_id: 502,
                order_number: 'KB-502',
                department: 'restaurant',
                room_number: '12',
                items: [{ quantity: 1 }],
                total_amount: 8000,
                status: 'completed',
                waiter_name: 'Juma',
                settled_at: '2026-09-11T13:10:00Z',
                created_at: '2026-09-11T12:45:00Z',
              },
            ],
          })
        : Promise.resolve({ data: [] }),
    )

    // Today: no closed-ticket history on the page yet.
    expect(wrapper.find('.kb-closed').exists()).toBe(false)

    wrapper.vm.boardDate = past
    await wrapper.vm.loadClosed()
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.kb-closed').exists()).toBe(true)
    const closedText = wrapper.find('.kb-closed').text()
    expect(closedText).toContain('KB-501')
    expect(closedText).toContain('KB-502')
    expect(closedText).toContain('25,000.00')
    expect(closedText).toContain('8,000.00')
    expect(closedText).toContain('Neema')

    // The history query went out scoped to completed + the picked date.
    const closedCall = api.orderApi.index.mock.calls.find(([p]) => p.status === 'completed')
    expect(closedCall).toBeTruthy()
    expect(closedCall[0].date).toBe(past)
    // The open grid still loaded today's tickets (no status/date filter).
    const openCall = api.orderApi.index.mock.calls.find(([p]) => !p.status)
    expect(openCall).toBeTruthy()
    expect(openCall[0].per_page).toBe(100)
  })

  it('shows the empty message when a past date has no closed tickets', async () => {
    await mountBoard()
    const past = iso(new Date(Date.now() - 86400000))
    api.orderApi.index.mockImplementation((params = {}) =>
      params.status === 'completed' ? Promise.resolve({ data: [] }) : Promise.resolve({ data: [] }),
    )
    wrapper.vm.boardDate = past
    await wrapper.vm.loadClosed()
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.kb-closed').exists()).toBe(true)
    expect(wrapper.find('.kb-closed .cat-empty').exists()).toBe(true)
    expect(wrapper.find('.kb-closed .cat-empty').text()).toContain('No closed tickets')
  })
})