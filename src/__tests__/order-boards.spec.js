import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { formatOrderDateTime, formatDateHuman, formatTime, todayISO, addDays } from '@/utils/dates'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import CashierTakeAwayPage from '@/pages/cashier/CashierTakeAwayPage.vue'
import CashierNoChargePage from '@/pages/cashier/CashierNoChargePage.vue'

const api = vi.hoisted(() => ({
  orderIndex: vi.fn(),
  formOptions: vi.fn(),
  categories: vi.fn(),
  items: vi.fn(),
  waiterIndex: vi.fn(),
  accIndex: vi.fn(),
}))

vi.mock('@/api', () => ({
  orderApi: {
    index: api.orderIndex,
    formOptions: api.formOptions,
    show: vi.fn(),
  },
  menuItemApi: { index: api.items, categories: api.categories, items: api.items },
  waiterApi: { index: api.waiterIndex },
  menuAccompanimentApi: {
    index: api.accIndex,
    store: vi.fn(),
    update: vi.fn(),
    reorder: vi.fn(),
    destroy: vi.fn(),
  },
  fbDayCloseApi: { index: vi.fn().mockRejectedValue(new Error('offline')) },
}))

const ORDER = (over = {}) => ({
  order_id: 1,
  order_number: 'TA-0001',
  status: 'pending',
  payment_status: 'unpaid',
  order_type: 'takeaway',
  total_amount: 12000,
  order_date: '2026-09-20',
  created_at: '2026-09-20T14:35:00',
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.orderIndex.mockResolvedValue({ data: { data: [] } })
  api.formOptions.mockResolvedValue({ data: { tables: [], in_house_guests: [] } })
  api.categories.mockResolvedValue({ data: { data: [] } })
  api.items.mockResolvedValue({ data: { data: [] } })
  api.waiterIndex.mockResolvedValue({ data: { data: [] } })
  api.accIndex.mockResolvedValue({ data: { data: [] } })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('dates utils — human-readable order date/time', () => {
  it('formats an ISO timestamp as a human date + time', () => {
    const stamp = '2026-09-20T14:35:00'
    const out = formatOrderDateTime(stamp)
    expect(out).toContain(formatDateHuman(stamp))
    expect(out).toContain(formatTime(stamp))
    expect(out).toContain('·')
  })

  it('returns an em dash for empty or invalid input', () => {
    expect(formatOrderDateTime('')).toBe('—')
    expect(formatOrderDateTime(null)).toBe('—')
    expect(formatDateHuman('not-a-date')).toBe('—')
    expect(formatTime('')).toBe('—')
  })
})

describe('OrderDateNav', () => {
  function mountNav(props = {}) {
    return mount(OrderDateNav, {
      props: { modelValue: '2026-09-20', ...props },
      global: { plugins: [i18n] },
    })
  }

  it('renders a plain date input with no stepper or Today shortcut', () => {
    const wrapper = mountNav()
    expect(wrapper.find('input[type="date"].date-nav-input').exists()).toBe(true)
    expect(wrapper.find('.nav-btn').exists()).toBe(false)
    expect(wrapper.find('.today-btn').exists()).toBe(false)
  })

  it('emits the picked date through v-model and change', async () => {
    const wrapper = mountNav()
    await wrapper.find('input[type="date"]').setValue('2026-09-21')
    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('2026-09-21')

    const picked = mountNav({ modelValue: '2026-09-21' })
    await picked.find('input[type="date"]').trigger('change')
    expect(picked.emitted('change')[0][0]).toBe('2026-09-21')
  })
})

describe('NewOrderModal — grills "served with" popup', () => {
  it('renders the teleported backdrop and popup above the layout chrome', async () => {
    api.items.mockResolvedValue({
      data: {
        data: [
          { menu_item_id: 1, item_name: 'Beef Mshikaki', selling_price: 5000, category: 'Grills', available: true, tax_rate: 0 },
        ],
      },
    })
    const wrapper = mount(NewOrderModal, {
      props: { mode: 'takeaway', title: 'New Take Away Order' },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const backdrop = document.body.querySelector('.order-modal-backdrop')
    expect(backdrop).toBeTruthy()

    const tile = backdrop.querySelector('.cat-item')
    expect(tile).toBeTruthy()
    expect(tile.textContent).toContain('Beef Mshikaki')
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    const popup = document.body.querySelector('.cat-pop')
    expect(popup).toBeTruthy()
    expect(popup.textContent).toContain('Beef Mshikaki')

    const option = popup.querySelector('.accomp-option')
    expect(option).toBeTruthy()
    option.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(document.body.querySelector('.cat-pop')).toBeNull()
    expect(backdrop.textContent).toContain('Beef Mshikaki')

    wrapper.unmount()
  })
})

describe('Cashier order boards — previous orders by date', () => {
  it('Take Away filters today by business order date and shows time only', async () => {
    const today = todayISO()
    const yesterday = addDays(today, -1)
    const todays = ORDER({ order_id: 1, order_number: 'TA-TODAY', order_date: today, created_at: `${today}T10:00:00` })
    const old = ORDER({ order_id: 2, order_number: 'TA-OLD', order_date: yesterday, created_at: `${yesterday}T09:00:00` })
    api.orderIndex.mockResolvedValueOnce({ data: { data: [todays, old] } })

    const wrapper = mount(CashierTakeAwayPage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(wrapper.text()).toContain('TA-TODAY')
    expect(wrapper.text()).not.toContain('TA-OLD')
    expect(wrapper.text()).toContain(formatTime(todays.created_at))
    expect(wrapper.text()).not.toContain('·')

    api.orderIndex.mockResolvedValue({ data: { data: [old] } })
    const input = wrapper.find('.date-nav-input')
    await input.setValue(yesterday)
    await flushPromises()
    await input.trigger('change')
    await flushPromises()

    expect(api.orderIndex).toHaveBeenLastCalledWith(
      expect.objectContaining({ order_type: 'takeaway', date: yesterday }),
    )
    expect(wrapper.text()).toContain('TA-OLD')

    wrapper.unmount()
  })

  it('No Charge lists only the picked date instead of dumping every ticket', async () => {
    const today = todayISO()
    const todays = ORDER({ order_id: 3, order_number: 'NC-TODAY', order_type: 'no_charge', order_date: today, created_at: `${today}T09:00:00` })
    const old = ORDER({ order_id: 4, order_number: 'NC-OLD', order_type: 'no_charge', order_date: addDays(today, -3), created_at: `${addDays(today, -3)}T09:00:00` })
    api.orderIndex.mockResolvedValueOnce({ data: { data: [todays, old] } })

    const wrapper = mount(CashierNoChargePage, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(api.orderIndex).toHaveBeenCalledWith(
      expect.objectContaining({ order_type: 'no_charge' }),
    )
    expect(wrapper.text()).toContain('NC-TODAY')
    expect(wrapper.text()).not.toContain('NC-OLD')
    expect(wrapper.text()).toContain(formatTime(todays.created_at))
    expect(wrapper.find('.date-nav-input').exists()).toBe(true)

    wrapper.unmount()
  })
})

describe('Cashier Room Service board — business date', () => {
  it('waits for the working-date store before loading the board', async () => {
    const ensureLoaded = vi.fn().mockResolvedValue()
    vi.resetModules()
    vi.doMock('@/stores/workingDate', () => ({
      useWorkingDateStore: () => ({ workingDate: '2026-09-20', ensureLoaded }),
    }))

    api.orderIndex.mockResolvedValueOnce({ data: { data: [] } })

    const RoomService = (await import('@/pages/cashier/CashierRoomServicePage.vue')).default
    const wrapper = mount(RoomService, { global: { plugins: [i18n] } })
    await flushPromises()

    expect(ensureLoaded).toHaveBeenCalled()
    expect(wrapper.find('.date-nav-input').exists()).toBe(true)
    expect(wrapper.find('.date-nav-input').element.value).toBe('2026-09-20')
    expect(api.orderIndex).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-20' }))

    wrapper.unmount()
    vi.doUnmock('@/stores/workingDate')
    vi.resetModules()
  })
})
