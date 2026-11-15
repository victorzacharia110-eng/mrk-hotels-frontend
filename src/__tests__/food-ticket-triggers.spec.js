import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import OrderTakerDashboard from '@/pages/dashboards/OrderTakerDashboard.vue'
import { useAuthStore } from '@/stores/auth'
import { selectedOutlet } from '@/composables/useOutletContext'

/**
 * The review's "print a food ticket" flags were dead settings: the store
 * exposed printFoodTicketOnOrder / printFoodTicketOnItemAdded and nothing ever
 * called printFoodTicket, so a manager could turn the kitchen ticket on or off
 * and no ticket would ever appear either way.
 *
 * These tests drive the real order-placement components and assert on what
 * reaches the printer transport, because that is the only thing the kitchen
 * cares about.
 */

// Web Serial is unavailable under jsdom, so the transport is stubbed and the
// emitted job is inspected rather than sent to hardware. vi.hoisted keeps these
// initialised before the module mock that reads them is hoisted into place.
const { printToPrinter, printerSupported, printerState } = vi.hoisted(() => ({
  printToPrinter: vi.fn(),
  printerSupported: vi.fn(),
  printerState: { connected: true, reason: '', info: '' },
}))

vi.mock('@/utils/printer', async (importOriginal) => ({
  // The row formatters stay real: the assertions read the text the kitchen
  // would actually see, so stubbing them would test nothing.
  ...(await importOriginal()),
  printerState,
  printerSupported: (...a) => printerSupported(...a),
  printToPrinter: (...a) => printToPrinter(...a),
  connectPrinter: vi.fn(),
  disconnectPrinter: vi.fn(),
  restorePrinter: vi.fn().mockResolvedValue(true),
}))

const api = vi.hoisted(() => ({
  store: vi.fn(),
  show: vi.fn(),
  addItems: vi.fn(),
  index: vi.fn(),
  formOptions: vi.fn(),
  categories: vi.fn(),
  items: vi.fn(),
  tables: vi.fn(),
  reports: vi.fn(),
  hotelShow: vi.fn(),
}))

vi.mock('@/api', () => ({
  orderApi: { store: api.store, show: api.show, addItems: api.addItems, index: api.index },
  menuItemApi: { index: api.items, categories: api.categories, items: api.items },
  menuAccompanimentApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  waiterApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  fbDayCloseApi: { index: vi.fn().mockRejectedValue(new Error('offline')) },
  hotelSettingsApi: { show: api.hotelShow },
  orderItemApi: { destroy: vi.fn() },
  paymentApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  roomApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  tableApi: { index: api.tables },
  reportApi: { index: api.reports },
  tableLocationApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}))

vi.mock('@/composables/useOrderRealtime', () => ({ useOrderRealtime: vi.fn() }))
vi.mock('@/composables/useStockRealtime', () => ({ useStockRealtime: vi.fn() }))
vi.mock('@/composables/useAccompaniments', () => ({
  useAccompaniments: () => ({ load: vi.fn(), items: { value: [] }, saving: { value: false } }),
}))

const ORDER = (over = {}) => ({
  order_id: 'o-1',
  order_number: 'TA-0001',
  department: 'restaurant',
  table_number: '4',
  order_type: 'dine_in',
  status: 'pending',
  payment_status: 'unpaid',
  waiter_name: 'LYDIA MANASE',
  items: [{ menu_item_id: 1, item_name: 'Ugali', quantity: 2, accompaniment: 'Sukuma Wiki' }],
  ...over,
})

/** The ESC/POS rows handed to the transport, flattened to plain text. */
function printedText(callIndex = 0) {
  return printToPrinter.mock.calls[callIndex][0].map((row) => String(row[0])).join('\n')
}

/**
 * Whether a print job contains a row with this exact text, ignoring the
 * centring padding. The letterhead shifts the ticket title off index 0, so
 * call sites look for the row rather than assume a position.
 */
function printedRow(index, text) {
  return printToPrinter.mock.calls[index][0].some((row) => String(row[0]).trim() === text)
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  selectedOutlet.value = null
  vi.clearAllMocks()
  printerSupported.mockReturnValue(true)
  printToPrinter.mockResolvedValue(true)
  api.formOptions.mockResolvedValue({ data: { tables: [], in_house_guests: [], waiters: [] } })
  api.categories.mockResolvedValue({ data: { data: [{ category: 'Mains', category_id: 1 }] } })
  // One menu row shaped for both consumers: the cashier modal reads
  // `available`/`selling_price`, the waiter panel `is_available`/`price`.
  api.items.mockResolvedValue({
    data: {
      data: [
        {
          menu_item_id: 1,
          item_name: 'Ugali',
          category: 'Mains',
          selling_price: 3000,
          price: 3000,
          available: true,
          is_available: true,
          is_in_stock: true,
        },
      ],
    },
  })
  api.store.mockResolvedValue({ data: { order: ORDER() } })
  api.show.mockResolvedValue({ data: { order: ORDER() } })
  api.index.mockResolvedValue({ data: { data: [] } })
  api.tables.mockResolvedValue({
    data: { data: [{ table_id: 1, table_name: '4', section: 'restaurant', outlet_id: 1, is_active: 1 }] },
  })
  api.reports.mockResolvedValue({ data: { data: [] } })
  // Printed documents resolve the hotel's saved letterhead; this hotel has one.
  api.hotelShow.mockResolvedValue({
    data: { hotel: { hotel_name: 'MRK Grand Hotel', phone: '+255 700 000 111' } },
  })
})

describe('food ticket on order — cashier new-order modal', () => {
  /**
   * Mounts the modal, queues one menu line, and submits the order.
   *
   * The modal teleports into document.body, so it is unmounted and the body
   * reset here: otherwise the next test's `querySelector('.submit-btn')` finds
   * the previous test's still-open modal, and the test silently measures the
   * wrong component's print settings.
   */
  async function placeOrder() {
    const wrapper = mount(NewOrderModal, {
      props: { mode: 'dine_in', title: 'New Order', tableNumber: '4' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    const tile = document.body.querySelector('.cat-item')
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    // The modal body is teleported to document.body, so the submit button is
    // queried from the teleported DOM rather than the wrapper.
    document.body.querySelector('.submit-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    wrapper.unmount()
    document.body.innerHTML = ''
    return wrapper
  }

  it('prints a kitchen ticket routed to the order\'s service line', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    store.saveSettings({ printOnSave: false, departmentRouting: { restaurant: kitchen } })

    await placeOrder()

    expect(printToPrinter).toHaveBeenCalledTimes(1)
    const text = printedText()
    expect(text).toContain('KITCHEN ORDER TICKET')
    expect(text).toContain('2 x Ugali')
    expect(text).toContain('Sukuma Wiki')
    // Routed to the kitchen printer, not the till.
    expect(printToPrinter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ printer: expect.objectContaining({ name: 'Kitchen' }) }),
    )
  })

  it('sends the ticket even when the guest check is switched off', async () => {
    // The whole point of a separate flag: the kitchen cooks while the guest is
    // still ordering, so "print on save" may be off.
    const store = usePrintSettingsStore()
    store.saveSettings({ printOnSave: false, printGuestCheckWhenUnsettled: false })

    await placeOrder()

    expect(printToPrinter).toHaveBeenCalledTimes(1)
    expect(printedText()).toContain('KITCHEN ORDER TICKET')
  })

  it('prints nothing when the manager turns the food ticket off', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ printFoodTicketOnOrder: false, printOnSave: false, printGuestCheckWhenUnsettled: false })

    await placeOrder()

    expect(printToPrinter).not.toHaveBeenCalled()
  })

  it('prints the guest check only when print-on-save is on and no ticket is due', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ printFoodTicketOnOrder: false, printOnSave: true })

    await placeOrder()

    expect(printToPrinter).toHaveBeenCalledTimes(1)
    expect(printedText()).not.toContain('KITCHEN ORDER TICKET')
  })

  it('prints both a kitchen ticket and a guest check when both flags are on', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ printFoodTicketOnOrder: true, printOnSave: true })

    await placeOrder()

    expect(printToPrinter).toHaveBeenCalledTimes(2)
    expect(printedRow(0, 'KITCHEN ORDER TICKET')).toBe(true)
    expect(printedRow(1, 'KITCHEN ORDER TICKET')).toBe(false)
  })
})

describe('food ticket on the waiter order-taker panel', () => {
  /**
   * Mounts the waiter panel, picks table 4, queues one menu line and sends.
   *
   * `ownLiveOrder` seeds a live ticket on that table under the signed-in
   * waiter's name, which is what puts the panel into "continue this order"
   * mode so the item-added trigger is exercised.
   */
  async function sendTicket({ ownLiveOrder = null } = {}) {
    useAuthStore().user = { full_name: 'LYDIA MANASE', user_role: 'waiter' }
    api.index.mockResolvedValue({ data: { data: ownLiveOrder ? [ownLiveOrder] : [] } })

    const wrapper = mount(OrderTakerDashboard, { global: { plugins: [i18n] } })
    await flushPromises()

    // Categories/search stay hidden until a table is chosen.
    await wrapper.find('.table-chip').trigger('click')
    await nextTick()

    const search = wrapper.find('.cat-search')
    search.element.value = 'ugali'
    await search.trigger('input')
    await nextTick()

    await wrapper.find('.cat-item').trigger('click')
    await nextTick()
    await wrapper.find('.send-btn').trigger('click')
    await flushPromises()

    wrapper.unmount()
    return wrapper
  }

  it('prints a food ticket when the waiter places a new order', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.7:9720' })
    store.saveSettings({ departmentRouting: { restaurant: kitchen } })

    await sendTicket()

    expect(api.store).toHaveBeenCalledTimes(1)
    expect(printToPrinter).toHaveBeenCalledTimes(1)
    expect(printedText()).toContain('KITCHEN ORDER TICKET')
    // The whole order goes out, exactly as the API returned it.
    expect(printedText()).toContain('2 x Ugali')
    expect(printToPrinter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ printer: expect.objectContaining({ name: 'Kitchen' }) }),
    )
  })

  it('prints nothing when the food-ticket flag is off', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ printFoodTicketOnOrder: false })

    await sendTicket()

    expect(api.store).toHaveBeenCalledTimes(1)
    expect(printToPrinter).not.toHaveBeenCalled()
  })

  it('prints only the newly added lines when items go onto a live ticket', async () => {
    const store = usePrintSettingsStore()
    // Off by default: most kitchens reprint the whole ticket.
    store.saveSettings({ printFoodTicketOnItemAdded: true })
    api.addItems.mockResolvedValue({
      data: {
        order: ORDER({
          items: [
            { menu_item_id: 9, item_name: 'Pizza', quantity: 1 },
            { menu_item_id: 1, item_name: 'Ugali', quantity: 2 },
          ],
        }),
      },
    })

    await sendTicket({
      ownLiveOrder: ORDER({
        order_id: 'o-live',
        items: [{ menu_item_id: 9, item_name: 'Pizza', quantity: 1, unit_price: 8000, subtotal: 8000 }],
      }),
    })

    expect(api.addItems).toHaveBeenCalledTimes(1)
    expect(printToPrinter).toHaveBeenCalledTimes(1)
    const text = printedText()
    // The new line is on the ticket; the pre-existing one must not be, or the
    // kitchen cooks the starter twice.
    expect(text).toContain('1 x Ugali')
    expect(text).not.toContain('Pizza')
  })

  it('stays silent on item-added while the flag is off (the default)', async () => {
    api.addItems.mockResolvedValue({ data: { order: ORDER() } })

    await sendTicket({
      ownLiveOrder: ORDER({
        order_id: 'o-live',
        items: [{ menu_item_id: 9, item_name: 'Pizza', quantity: 1, unit_price: 8000, subtotal: 8000 }],
      }),
    })

    expect(api.addItems).toHaveBeenCalledTimes(1)
    expect(printToPrinter).not.toHaveBeenCalled()
  })
})

describe('waiter live tickets and table release', () => {
  const pizzaLine = (quantity = 2) => ({
    menu_item_id: 9,
    item_name: 'Pizza',
    quantity,
    unit_price: 8000,
    subtotal: 8000 * quantity,
  })

  async function mountPanel() {
    useAuthStore().user = { full_name: 'LYDIA MANASE', user_role: 'waiter' }
    const wrapper = mount(OrderTakerDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    return wrapper
  }

  it('appends only the extra quantity and protects the sent quantity', async () => {
    const liveOrder = ORDER({ order_id: 'o-live', items: [pizzaLine(2)] })
    api.index.mockResolvedValue({ data: { data: [liveOrder] } })
    api.addItems.mockResolvedValue({ data: { order: ORDER() } })

    const wrapper = await mountPanel()
    await wrapper.find('.table-chip').trigger('click')
    await flushPromises()

    // Nothing is pending merely because an existing ticket was opened.
    expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.lines-table .line-remove').exists()).toBe(false)
    const quantityButtons = wrapper.findAll('.lines-table .qty-step button')
    expect(quantityButtons[0].attributes('disabled')).toBeDefined()

    await quantityButtons[1].trigger('click')
    expect(wrapper.find('.lines-table .qty-step span').text()).toBe('3')
    await wrapper.find('.send-btn').trigger('click')
    await flushPromises()

    expect(api.addItems).toHaveBeenCalledWith('o-live', {
      items: [{ menu_item_id: 9, quantity: 1, accompaniment: null }],
    })
    // The full summary stays visible, with no unsent units left.
    expect(wrapper.find('.lines-table .qty-step span').text()).toBe('3')
    expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.lines-table .qty-step button')[0].attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('prints only the extra units when an existing line is increased', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.7:9720' })
    store.saveSettings({ printFoodTicketOnItemAdded: true, departmentRouting: { restaurant: kitchen } })
    const liveOrder = ORDER({ order_id: 'o-live', items: [pizzaLine(2)] })
    api.index.mockResolvedValue({ data: { data: [liveOrder] } })
    api.addItems.mockResolvedValue({
      data: { order: ORDER({ order_id: 'o-live', items: [pizzaLine(3)] }) },
    })

    const wrapper = await mountPanel()
    await wrapper.find('.table-chip').trigger('click')
    await flushPromises()
    await wrapper.findAll('.lines-table .qty-step button')[1].trigger('click')
    await wrapper.find('.send-btn').trigger('click')
    await flushPromises()

    expect(printToPrinter).toHaveBeenCalledTimes(1)
    const text = printedText()
    expect(text).toContain('1 x Pizza')
    expect(text).not.toContain('2 x Pizza')
    expect(text).not.toContain('3 x Pizza')
    wrapper.unmount()
  })

  it('reloads the visible stock quantity when the outlet changes', async () => {
    selectedOutlet.value = { outlet_id: 1, name: 'Main Bar', type: 'bar' }
    api.items.mockImplementation(({ outlet_id }) => Promise.resolve({
      data: {
        data: [{
          menu_item_id: 1,
          item_name: 'Ugali',
          category: 'Mains',
          price: 3000,
          is_available: true,
          is_in_stock: true,
          quantity_on_hand: outlet_id === 1 ? 4 : 9,
          linked_item_unit: 'PC',
        }],
      },
    }))

    const wrapper = await mountPanel()
    await wrapper.find('.table-chip').trigger('click')
    await flushPromises()
    await wrapper.find('.cat-btn').trigger('click')
    await nextTick()
    expect(wrapper.find('.cat-item-stock').text()).toContain('4')

    selectedOutlet.value = { outlet_id: 2, name: 'Pool Bar', type: 'bar' }
    await flushPromises()

    expect(api.items).toHaveBeenLastCalledWith(expect.objectContaining({ outlet_id: 2, page: 1 }))
    expect(wrapper.find('.cat-item-stock').text()).toContain('9')
    wrapper.unmount()
  })

  it('releases the table and clears category and search state', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('.table-chip').trigger('click')
    await flushPromises()

    const search = wrapper.find('.cat-search')
    await search.setValue('ugali')
    expect(wrapper.find('.inline-items').exists()).toBe(true)

    await wrapper.find('.table-unselect').trigger('click')

    expect(wrapper.find('.table-unselect').exists()).toBe(false)
    expect(wrapper.find('.cat-rail').exists()).toBe(false)
    expect(wrapper.find('.inline-items').exists()).toBe(false)
    expect(wrapper.find('.cat-search').element.value).toBe('')
    wrapper.unmount()
  })

  it('loads an own live order from the API when only occupancy is cached', async () => {
    const liveOrder = ORDER({ order_id: 'o-live', items: [pizzaLine()] })
    api.index.mockImplementation((params = {}) => Promise.resolve({
      data: { data: params.occupancy ? [liveOrder] : [] },
    }))
    api.show.mockResolvedValue({ data: { order: liveOrder } })

    const wrapper = await mountPanel()
    await wrapper.find('.table-chip').trigger('click')
    await flushPromises()

    expect(api.show).toHaveBeenCalledWith('o-live')
    expect(wrapper.text()).toContain('Pizza')
    expect(wrapper.find('.lines-table .qty-step span').text()).toBe('2')
    expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('ignores an occupied-table response that arrives after release', async () => {
    const liveOrder = ORDER({ order_id: 'o-live', table_number: '4', items: [pizzaLine()] })
    api.index.mockImplementation((params = {}) => Promise.resolve({
      data: { data: params.occupancy ? [liveOrder] : [] },
    }))
    api.tables.mockResolvedValue({
      data: {
        data: [
          { table_id: 1, table_name: '4', section: 'restaurant', outlet_id: 1, is_active: 1 },
          { table_id: 2, table_name: '5', section: 'restaurant', outlet_id: 1, is_active: 1 },
        ],
      },
    })
    let resolveShow
    api.show.mockImplementation(() => new Promise((resolve) => { resolveShow = resolve }))

    const wrapper = await mountPanel()
    const chips = wrapper.findAll('.table-chip')
    await chips[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('.table-unselect').exists()).toBe(true)

    // Table 4 needs an asynchronous fetch; table 5 remains selected meanwhile.
    await chips[0].trigger('click')
    expect(api.show).toHaveBeenCalledWith('o-live')
    await wrapper.find('.table-unselect').trigger('click')
    resolveShow({ data: { data: liveOrder } })
    await flushPromises()

    expect(wrapper.find('.table-unselect').exists()).toBe(false)
    expect(wrapper.find('.table-chip-tick').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Pizza')
    expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})


describe('waiter order-taker panel: the red row X clears its food card', () => {
  /**
   * Adds one menu tile, then taps the red X at the end of the order-lines row.
   *
   * A footgun here is the OTHER red X with the same class: the one in the
   * food-list header (`closeCategory`). It hides the list but keeps the line, so
   * if the selector ever matched it instead, the card would still read as
   * selected and this test would catch that.
   */
  async function addThenRemove() {
    useAuthStore().user = { full_name: 'LYDIA MANASE', user_role: 'waiter' }
    const wrapper = mount(OrderTakerDashboard, { global: { plugins: [i18n] } })
    await flushPromises()
    await wrapper.find('.table-chip').trigger('click')
    await nextTick()
    const search = wrapper.find('.cat-search')
    search.element.value = 'ugali'
    await search.trigger('input')
    await nextTick()
    await wrapper.find('.cat-item').trigger('click')
    await nextTick()
    const before = {
      onOrder: wrapper.findAll('.cat-item.on-order').length,
      badges: wrapper.findAll('.cat-item-qty').length,
      rows: wrapper.findAll('.lines-table tbody tr').length,
    }
    await wrapper.find('.lines-table .line-remove').trigger('click')
    await nextTick()
    const after = {
      onOrder: wrapper.findAll('.cat-item.on-order').length,
      badges: wrapper.findAll('.cat-item-qty').length,
    }
    wrapper.unmount()
    return { before, after }
  }

  it('deselects the card and drops its ×N badge without a refresh', async () => {
    const { before, after } = await addThenRemove()

    expect(before).toEqual({ onOrder: 1, badges: 1, rows: 1 })
    expect(after.onOrder).toBe(0)
    expect(after.badges).toBe(0)
  })
})
