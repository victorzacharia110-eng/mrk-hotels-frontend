import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InsertTransactionPage from '@/pages/reception/InsertTransactionPage.vue'
import i18n from '@/locales/i18n'

const api = vi.hoisted(() => {
  const mk = () => new Proxy({}, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      if (!(prop in target)) target[prop] = vi.fn().mockResolvedValue({ data: {} })
      return target[prop]
    },
  })
  return {
    businessDateApi: mk(),
    nightAuditApi: mk(),
    reservationApi: mk(),
  }
})

vi.mock('@/api', () => ({
  businessDateApi: api.businessDateApi,
  nightAuditApi: api.nightAuditApi,
  reservationApi: api.reservationApi,
}))

const inHouse = {
  reservation_id: 'r1',
  guest_name: 'Amina Hassan',
  status: 'checked_in',
  room: { room_number: '101' },
}

let wrapper

beforeEach(() => {
  setActivePinia(createPinia())
  api.businessDateApi.show.mockReset()
  api.nightAuditApi.transactions.mockReset()
  api.nightAuditApi.report.mockReset()
  api.reservationApi.index.mockReset()
  api.businessDateApi.show.mockResolvedValue({ data: { business_date: '2026-11-21', today: '2026-11-22' } })
  api.nightAuditApi.transactions.mockResolvedValue({ data: { adjustments: [] } })
  api.nightAuditApi.report.mockResolvedValue({ data: { closed: false } })
  api.reservationApi.index.mockResolvedValue({ data: { data: [inHouse] } })
})

afterEach(() => {
  wrapper?.unmount()
})

describe('insert transaction guest lookup', () => {
  it('loads in-house guests when the search opens and follows the business date', async () => {
    wrapper = mount(InsertTransactionPage, { global: { plugins: [i18n, createPinia()] } })
    await flushPromises()

    expect(wrapper.vm.form.audit_date).toBe('2026-11-21')
    expect(api.reservationApi.index).toHaveBeenCalledWith({ status: 'checked_in', per_page: 50 })
    expect(wrapper.vm.reservationOptions).toHaveLength(1)
    expect(wrapper.vm.reservationOptions[0].label).toContain('Amina Hassan')
  })

  it('filters in-house guests and reloads them from the refresh button', async () => {
    wrapper = mount(InsertTransactionPage, { global: { plugins: [i18n, createPinia()] } })
    await flushPromises()

    api.reservationApi.index.mockClear()
    await wrapper.vm.searchReservations('Amina')
    expect(api.reservationApi.index).toHaveBeenCalledWith({ search: 'Amina', status: 'checked_in', per_page: 50 })

    api.nightAuditApi.transactions.mockClear()
    api.nightAuditApi.report.mockClear()
    api.reservationApi.index.mockClear()
    await wrapper.find('[data-test="insert-transaction-refresh"]').trigger('click')
    await flushPromises()

    expect(api.nightAuditApi.transactions).toHaveBeenCalledWith({ date: '2026-11-21' })
    expect(api.nightAuditApi.report).toHaveBeenCalledWith({ date: '2026-11-21' })
    expect(api.reservationApi.index).toHaveBeenCalledWith({ status: 'checked_in', per_page: 50 })
  })

  it('ignores stale search responses', async () => {
    wrapper = mount(InsertTransactionPage, { global: { plugins: [i18n, createPinia()] } })
    await flushPromises()

    let resolveOld
    api.reservationApi.index.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    const oldSearch = wrapper.vm.searchReservations('old')
    await wrapper.vm.searchReservations('new')
    await flushPromises()
    resolveOld({ data: { data: [{ ...inHouse, guest_name: 'Old Guest', reservation_id: 'r0' }] } })
    await oldSearch
    await flushPromises()

    expect(wrapper.vm.reservationOptions.map((o) => o.value)).toEqual(['r1'])
  })
})
