import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import OrderTakerDashboard from '@/pages/dashboards/OrderTakerDashboard.vue'
import { useAuthStore } from '@/stores/auth'

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
  api.tables.mockResolvedValue({ data: { data: [{ table_id: 1, table_name: '4', section: 'restaurant', is_active: 1 }] } })
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
      expect.objectContaining({ transport: 'network', endpoint: 'http://10.0.0.5:9720' }),
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

    // A search reveals the menu tiles, which only render for a category/search.
    const search = wrapper.find('.cat-search')
    search.element.value = 'ugali'
    await search.trigger('input')
    await nextTick()

    await wrapper.find('.table-chip').trigger('click')
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
      expect.objectContaining({ endpoint: 'http://10.0.0.7:9720' }),
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
