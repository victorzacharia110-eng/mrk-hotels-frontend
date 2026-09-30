import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import i18n from '@/locales/i18n'

// Web Serial is unavailable in the test environment, so the printer transport
// is stubbed and every call is inspected rather than sent to real hardware.
const printToPrinter = vi.fn().mockResolvedValue(true)
// True so the serial path is exercised: the point of the fallback test is that
// a ticket with no profile still reaches *a* printer.
const printerSupported = vi.fn().mockReturnValue(true)
const printerState = { connected: false, reason: '', info: '' }

vi.mock('@/utils/printer', () => ({
  printerState,
  printerSupported: (...a) => printerSupported(...a),
  printToPrinter: (...a) => printToPrinter(...a),
  connectPrinter: vi.fn(),
  disconnectPrinter: vi.fn(),
  restorePrinter: vi.fn(),
}))

const { usePrintSettingsStore } = await import('@/stores/printSettings')

describe('print settings — when to print', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
    printerSupported.mockReturnValue(true)
    i18n.global.locale.value = 'en'
  })

  it('defaults to printing a receipt on save and settle, and a food ticket on order', () => {
    const store = usePrintSettingsStore()

    expect(store.settings.printOnSave).toBe(true)
    expect(store.settings.printOnSettle).toBe(true)
    // "Print on order" is the review's kitchen ticket: separate from the receipt.
    expect(store.settings.printFoodTicketOnOrder).toBe(true)
    // Reprinting a whole ticket per added item is the noisy default, so it is off.
    expect(store.settings.printFoodTicketOnItemAdded).toBe(false)
  })

  it('persists a toggled flag to localStorage', () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ printFoodTicketOnOrder: false })

    expect(store.settings.printFoodTicketOnOrder).toBe(false)
    expect(JSON.parse(localStorage.getItem('mrk_print_settings')).printFoodTicketOnOrder).toBe(false)
  })
})

describe('print settings — routing food tickets to a service line', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
    printerSupported.mockReturnValue(true)
  })

  it('adds a named printer and gives it a stable id', () => {
    const store = usePrintSettingsStore()
    const id = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })

    expect(id).toBeTruthy()
    expect(store.ticketPrinters).toHaveLength(1)
    expect(store.ticketPrinters[0]).toMatchObject({ name: 'Kitchen', transport: 'network' })
  })

  it('sends a food ticket to the printer routed for that service line', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    const bar = store.addTicketPrinter({ name: 'Bar', transport: 'network', endpoint: 'http://10.0.0.6:9720' })
    store.saveSettings({ departmentRouting: { restaurant: kitchen, bar } })

    await store.printFoodTicket(['2xUgali'], 'restaurant')
    expect(printToPrinter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ transport: 'network', endpoint: 'http://10.0.0.5:9720' }),
    )

    await store.printFoodTicket(['1xWhisky'], 'bar')
    expect(printToPrinter).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ endpoint: 'http://10.0.0.6:9720' }),
    )
  })

  it('uses the default printer for a service line with no route of its own', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    store.saveSettings({ departmentRouting: {}, defaultTicketPrinterId: kitchen })

    await store.printFoodTicket(['1xUgali'], 'restaurant')
    expect(printToPrinter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ endpoint: 'http://10.0.0.5:9720' }),
    )
  })

  it('falls back to the default when a route points at a deleted printer', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    store.saveSettings({ departmentRouting: { restaurant: kitchen } })

    // The route outlives the printer it named.
    store.removeTicketPrinter(kitchen)
    expect(store.departmentRouting.restaurant).toBeUndefined()

    // A dropped ticket is worse than a ticket on the wrong printer, so with no
    // profile left it goes to the till.
    await store.printFoodTicket(['1xUgali'], 'restaurant')
    expect(printToPrinter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ transport: 'serial' }),
    )
  })

  it('clears the default when the printer it named is removed', () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    store.saveSettings({ defaultTicketPrinterId: kitchen })

    store.removeTicketPrinter(kitchen)
    expect(store.defaultTicketPrinterId).toBe('')
  })
})

describe('print settings — routing each line to its own pass', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
    printerSupported.mockReturnValue(true)
    printToPrinter.mockResolvedValue(true)
  })

  const kitchenLines = [['KITCHEN ORDER TICKET'], ['1 x Mchemsho']]
  const barLines = [['BAR ORDER TICKET'], ['2 x Kilimanjaro']]

  /** Builds the rows a pass would print, and says which passes have content. */
  const build = (kitchen, bar) => async (station) =>
    station === 'kitchen' ? kitchen : bar
  const has = (kitchen, bar) => (station) => station === 'kitchen' ? kitchen : bar

  it('prints one ticket per pass and skips the pass with no lines', async () => {
    const store = usePrintSettingsStore()

    const sent = await store.printFoodTicketsByStation(build(kitchenLines, []), 'restaurant', { hasLinesFor: has(true, false) })

    expect(sent).toEqual(['kitchen'])
    expect(printToPrinter).toHaveBeenCalledTimes(1)
    expect(printToPrinter.mock.calls[0][0]).toBe(kitchenLines)
  })

  it('sends both passes when the order holds food and drinks', async () => {
    const store = usePrintSettingsStore()

    const sent = await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    expect(sent).toEqual(['kitchen', 'bar'])
    expect(printToPrinter).toHaveBeenCalledTimes(2)
    expect(printToPrinter.mock.calls[0][0]).toBe(kitchenLines)
    expect(printToPrinter.mock.calls[1][0]).toBe(barLines)
  })

  it('sends nothing when every line is switched off print-on-order', async () => {
    const store = usePrintSettingsStore()

    // Not a printer failure: there was simply nothing to cook or pour, and a
    // blank slip in the kitchen reads as a real ticket for nothing.
    const sent = await store.printFoodTicketsByStation(build([], []), 'restaurant', { hasLinesFor: has(false, false) })

    expect(sent).toEqual([])
    expect(printToPrinter).not.toHaveBeenCalled()
  })

  it('a station route beats the service line route', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      ticketPrinters: [
        { id: 'p-kitchen', transport: 'serial', endpoint: '' },
        { id: 'p-bar', transport: 'network', endpoint: 'http://10.0.0.9:9720' },
        { id: 'p-default', transport: 'serial', endpoint: '' },
      ],
      departmentRouting: { restaurant: 'p-kitchen' },
      stationRouting: { bar: 'p-bar' },
      defaultTicketPrinterId: 'p-default',
    })

    await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    // The kitchen ticket went to the restaurant route; the bar ticket used its
    // own station route and therefore the network bridge agent.
    const [kitchenCall, barCall] = printToPrinter.mock.calls
    expect(kitchenCall[1].endpoint).toBe('')
    expect(barCall[1].transport).toBe('network')
    expect(barCall[1].endpoint).toBe('http://10.0.0.9:9720')
  })

  it('a station route pointing at a deleted printer falls back, never drops', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      ticketPrinters: [{ id: 'p-default', transport: 'serial', endpoint: '' }],
      stationRouting: { bar: 'p-removed' },
      defaultTicketPrinterId: 'p-default',
    })

    await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    // Both passes still printed rather than the bar ticket vanishing.
    expect(printToPrinter).toHaveBeenCalledTimes(2)
  })
})
