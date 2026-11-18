import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'

const api = vi.hoisted(() => ({
  items: vi.fn(),
  formOptions: vi.fn(),
  store: vi.fn(),
  update: vi.fn(),
  addItems: vi.fn(),
  driverIndex: vi.fn(),
}))

vi.mock('@/api', () => ({
  orderApi: {
    store: api.store,
    update: api.update,
    addItems: api.addItems,
    show: vi.fn(),
    formOptions: api.formOptions,
  },
  menuItemApi: { index: api.items, categories: vi.fn(), items: api.items },
  deliveryDriverApi: { index: api.driverIndex },
  menuAccompanimentApi: {
    index: vi.fn().mockResolvedValue({ data: { data: [] } }),
    store: vi.fn(),
    update: vi.fn(),
    reorder: vi.fn(),
    destroy: vi.fn(),
  },
  fbDayCloseApi: { index: vi.fn().mockRejectedValue(new Error('offline')) },
}))

const ITEM = (over = {}) => ({
  menu_item_id: 1,
  item_name: 'Chicken Wrap',
  selling_price: 5000,
  price: 5000,
  category: 'Snacks',
  is_available: true,
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.items.mockResolvedValue({ data: { data: [ITEM()] } })
  api.formOptions.mockResolvedValue({
    data: {
      waiters: [{ full_name: 'Jane Waiter' }],
      in_house_guests: [],
      drivers: [{ driver_id: 'd1', full_name: 'Ali Driver', phone: '0712345678' }],
    },
  })
  api.driverIndex.mockResolvedValue({ data: { drivers: [] } })
})

afterEach(() => {
  document.body.innerHTML = ''
})

function mountModal(props = {}) {
  return mount(NewOrderModal, {
    props: { mode: 'delivery', title: 'New Delivery Order', ...props },
    global: { plugins: [i18n] },
  })
}

describe('NewOrderModal delivery drivers', () => {
  it('offers the registered driver roster instead of the waiter list', async () => {
    const wrapper = mountModal()
    await flushPromises()

    const selects = wrapper.findAllComponents(SearchableSelect)
    const driverSelect = selects.find((select) => select.props('placeholder') === i18n.global.t('cashier.order.driverPlaceholder'))
    expect(driverSelect).toBeTruthy()
    expect(driverSelect.props('options')).toEqual([
      { value: 'Ali Driver', label: 'Ali Driver — 0712345678' },
    ])

    wrapper.unmount()
  })

  it('allows an unavailable item on a delivery ticket', async () => {
    api.items.mockResolvedValue({ data: { data: [ITEM({ is_available: false })] } })
    const wrapper = mountModal()
    await flushPromises()

    const tile = document.body.querySelector('.cat-item')
    expect(tile.classList.contains('out-of-stock')).toBe(false)
    expect(tile.textContent).not.toContain(i18n.global.t('orderTaker.outOfStock'))

    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('.lines')?.textContent).toContain('Chicken Wrap')

    wrapper.unmount()
  })
})

describe('NewOrderModal existing ticket continuation', () => {
  it('updates the header and appends only the new lines', async () => {
    const existing = {
      order_id: 'o1',
      order_number: 'DL-0007',
      order_type: 'delivery',
      total_amount: 5000,
      guest_name: 'Mary Guest',
      waiter_name: 'Jane Waiter',
      delivery_phone: '0700000000',
      delivery_address: '12 Market Street',
      driver_name: 'Ali Driver',
      expected_minutes: 25,
      items: [
        { order_item_id: 'i1', item_name: 'Chicken Wrap', quantity: 1, unit_price: 5000, subtotal: 5000 },
      ],
    }
    api.update.mockResolvedValue({ data: { order: existing } })
    api.addItems.mockResolvedValue({ data: { order: { ...existing, total_amount: 10000 } } })

    const wrapper = mountModal({ existingOrder: existing })
    await flushPromises()

    expect(document.body.textContent).toContain(i18n.global.t('cashier.order.existingItems'))
    expect(document.body.textContent).toContain('Chicken Wrap')

    const tile = document.body.querySelector('.cat-item')
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const submit = document.body.querySelector('.submit-btn')
    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(api.update).toHaveBeenCalledWith('o1', expect.objectContaining({
      guest_name: 'Mary Guest',
      driver_name: 'Ali Driver',
      delivery_phone: '0700000000',
      delivery_address: '12 Market Street',
    }))
    expect(api.addItems).toHaveBeenCalledWith('o1', {
      items: [{ menu_item_id: 1, quantity: 1, accompaniment: null }],
    })
    expect(api.store).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
