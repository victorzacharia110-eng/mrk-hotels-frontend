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

    const result = await store.printFoodTicketsByStation(build(kitchenLines, []), 'restaurant', { hasLinesFor: has(true, false) })

    expect(result.attempted).toEqual(['kitchen'])
    expect(result.failed).toEqual([])
    expect(printToPrinter).toHaveBeenCalledTimes(1)
    expect(printToPrinter.mock.calls[0][0]).toBe(kitchenLines)
  })

  it('sends both passes when the order holds food and drinks', async () => {
    const store = usePrintSettingsStore()

    const result = await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    expect(result.attempted).toEqual(['kitchen', 'bar'])
    expect(result.failed).toEqual([])
    expect(printToPrinter).toHaveBeenCalledTimes(2)
    expect(printToPrinter.mock.calls[0][0]).toBe(kitchenLines)
    expect(printToPrinter.mock.calls[1][0]).toBe(barLines)
  })

  it('sends nothing when every line is switched off print-on-order', async () => {
    const store = usePrintSettingsStore()

    // Not a printer failure: there was simply nothing to cook or pour, and a
    // blank slip in the kitchen reads as a real ticket for nothing.
    const result = await store.printFoodTicketsByStation(build([], []), 'restaurant', { hasLinesFor: has(false, false) })

    // Nothing attempted and nothing failed: the manager is not told the printer
    // is broken when the order simply had no ticket to send.
    expect(result.attempted).toEqual([])
    expect(result.failed).toEqual([])
    expect(printToPrinter).not.toHaveBeenCalled()
  })

  it('reports a refused print instead of calling it delivered', async () => {
    const store = usePrintSettingsStore()
    // The printer takes the job but the write fails: the manager has to hear
    // about it, because the kitchen never heard about the order.
    printToPrinter.mockResolvedValueOnce(false)

    const result = await store.printFoodTicketsByStation(build(kitchenLines, []), 'restaurant', { hasLinesFor: has(true, false) })

    expect(result.attempted).toEqual(['kitchen'])
    expect(result.failed).toEqual(['kitchen'])
  })

  it('one dead printer does not cost the other pass its ticket', async () => {
    const store = usePrintSettingsStore()
    // A broken kitchen printer used to throw out of the loop before the bar
    // ticket was built, so drinks on a mixed order went missing exactly when
    // the kitchen was already in trouble.
    printToPrinter.mockImplementationOnce(() => Promise.reject(new Error('kitchen offline')))

    const result = await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    expect(result.failed).toEqual(['kitchen'])
    expect(result.attempted).toEqual(['kitchen', 'bar'])
    // The bar ticket still went out.
    expect(printToPrinter).toHaveBeenCalledTimes(2)
    expect(printToPrinter.mock.calls[1][0]).toBe(barLines)
  })

  it('a network ticket profile carries receipts even when the till transport is serial', async () => {
    const store = usePrintSettingsStore()
    // The till's own transport was left on Web Serial, but a network profile is
    // configured. Receipts must use the same agent the reception documents do,
    // instead of trying the (absent) serial port and reporting "not connected".
    store.saveSettings({
      transport: 'serial',
      endpoint: '',
      ticketPrinters: [{ id: 'p-bar', transport: 'network', endpoint: 'http://10.0.0.9:9720' }],
    })

    const sent = await store.print([['x']])

    expect(sent).toBe(true)
    expect(printToPrinter).toHaveBeenCalledWith([['x']], { transport: 'network', endpoint: 'http://10.0.0.9:9720' })
  })

  it('the top-level network endpoint wins over a ticket profile', () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      transport: 'network',
      endpoint: 'http://127.0.0.1:9720',
      ticketPrinters: [{ id: 'p-bar', transport: 'network', endpoint: 'http://10.0.0.9:9720' }],
    })

    expect(store.networkEndpoint).toBe('http://127.0.0.1:9720')
  })

  it('falls back to serial when no network endpoint is configured', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ transport: 'serial', endpoint: '', ticketPrinters: [] })

    await store.print([['x']])

    expect(printToPrinter).toHaveBeenCalledWith([['x']], { transport: 'serial' })
  })

  it('probeNetwork marks the agent connected and reports the reason when it is down', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ transport: 'network', endpoint: 'http://127.0.0.1:9720' })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('connection refused'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(store.probeNetwork()).resolves.toBe(true)
    expect(printerState.connected).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9720/status', { method: 'GET' })

    await expect(store.probeNetwork()).resolves.toBe(false)
    expect(printerState.connected).toBe(false)
    expect(printerState.reason).toContain('http://127.0.0.1:9720')

    vi.unstubAllGlobals()
  })

  it('deleting a printer clears the station routes that pointed at it', () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      ticketPrinters: [
        { id: 'p-kitchen', transport: 'serial', endpoint: '' },
        { id: 'p-bar', transport: 'network', endpoint: 'http://10.0.0.9:9720' },
      ],
      departmentRouting: { restaurant: 'p-kitchen' },
      stationRouting: { bar: 'p-bar' },
    })

    store.removeTicketPrinter('p-bar')

    // The station map points at the same profiles, so it has to be cleaned up
    // too -- otherwise the settings screen keeps offering a printer that is
    // gone.
    expect(store.stationRouting.bar).toBeUndefined()
    expect(store.departmentRouting.bar).toBeUndefined()
    expect(store.departmentRouting.restaurant).toBe('p-kitchen')
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
