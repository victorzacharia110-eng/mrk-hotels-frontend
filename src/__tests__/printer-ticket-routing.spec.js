import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import i18n from '@/locales/i18n'

// Printing goes through QZ Tray now, so the transport is stubbed and every call
// is inspected rather than sent to real hardware.
const printToPrinter = vi.fn().mockResolvedValue(true)
const listPrinters = vi.fn().mockResolvedValue([])
const printerState = { connected: false, reason: '', info: '' }

vi.mock('@/utils/printer', async (importOriginal) => ({
  // targetUsable / targetLabel / connectReason are pure helpers, so the real
  // implementations are kept and only the I/O is stubbed.
  ...(await importOriginal()),
  printerState,
  printToPrinter: (...a) => printToPrinter(...a),
  listPrinters: (...a) => listPrinters(...a),
  printerSupported: () => true,
  connectPrinter: vi.fn(),
  disconnectPrinter: vi.fn(),
  restorePrinter: vi.fn(),
}))

const { usePrintSettingsStore } = await import('@/stores/printSettings')

const KITCHEN = { name: 'Kitchen', kind: 'system', printer: 'Kitchen Printer' }
const BAR = { name: 'Bar', kind: 'socket', host: '10.0.0.6', port: 9100 }
const TILL = { kind: 'system', printer: 'Till Printer', label: 'Till Printer' }

/** The target a print call was sent to. */
function targetOf(call) {
  return call[1].printer
}

describe('print settings — when to print', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
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

describe('print settings — printer targets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
    printToPrinter.mockResolvedValue(true)
  })

  it('adds a named printer and gives it a stable id', () => {
    const store = usePrintSettingsStore()
    const id = store.addTicketPrinter(KITCHEN)

    expect(id).toBeTruthy()
    expect(store.ticketPrinters).toHaveLength(1)
    expect(store.ticketPrinters[0]).toMatchObject({ name: 'Kitchen', kind: 'system', printer: 'Kitchen Printer' })
  })

  it('migrates a legacy bridge endpoint onto a raw-socket target', () => {
    localStorage.setItem(
      'mrk_print_settings',
      JSON.stringify({ endpoint: 'http://192.168.1.100:9720', transport: 'network' }),
    )
    const store = usePrintSettingsStore()

    expect(store.tillPrinter).toMatchObject({ kind: 'socket', host: '192.168.1.100', port: 9100 })
    expect(store.settings.transport).toBeUndefined()
    expect(store.settings.endpoint).toBeUndefined()
  })
})

describe('print settings — routing food tickets to a service line', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
  })

  it('sends a food ticket to the printer routed for that service line', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter(KITCHEN)
    const bar = store.addTicketPrinter(BAR)
    store.saveSettings({ departmentRouting: { restaurant: kitchen, bar } })

    await store.printFoodTicket(['2xUgali'], 'restaurant')
    expect(targetOf(printToPrinter.mock.calls[0])).toMatchObject({ printer: 'Kitchen Printer' })

    await store.printFoodTicket(['1xWhisky'], 'bar')
    expect(targetOf(printToPrinter.mock.calls[1])).toMatchObject({ host: '10.0.0.6' })
  })

  it('uses the default printer for a service line with no route of its own', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter(KITCHEN)
    store.saveSettings({ departmentRouting: {}, defaultTicketPrinterId: kitchen })

    await store.printFoodTicket(['1xUgali'], 'restaurant')
    expect(targetOf(printToPrinter.mock.calls[0])).toMatchObject({ printer: 'Kitchen Printer' })
  })

  it('falls back to the default when a route points at a deleted printer', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter(KITCHEN)
    const bar = store.addTicketPrinter(BAR)
    store.saveSettings({ departmentRouting: { restaurant: kitchen }, defaultTicketPrinterId: bar })

    // The route outlives the printer it named.
    store.removeTicketPrinter(kitchen)
    expect(store.departmentRouting.restaurant).toBeUndefined()

    // A dropped ticket is worse than a ticket on the wrong printer, so it goes
    // to the default rather than nowhere.
    await store.printFoodTicket(['1xUgali'], 'restaurant')
    expect(targetOf(printToPrinter.mock.calls[0])).toMatchObject({ host: '10.0.0.6' })
  })

  it('sends a ticket with no printer at all to a null target rather than throwing', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ ticketPrinters: [], departmentRouting: {}, tillPrinter: null })

    await store.printFoodTicket(['1xUgali'], 'restaurant')
    expect(targetOf(printToPrinter.mock.calls[0])).toBeNull()
  })

  it('clears the default when the printer it named is removed', () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter(KITCHEN)
    store.saveSettings({ defaultTicketPrinterId: kitchen })

    store.removeTicketPrinter(kitchen)
    expect(store.defaultTicketPrinterId).toBe('')
  })
})

describe('print settings — till printer resolution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
  })

  it('prints receipts to the configured till printer', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ tillPrinter: TILL })

    const sent = await store.print([['x']])

    expect(sent).toBe(true)
    expect(printToPrinter).toHaveBeenCalledWith([['x']], { printer: TILL })
  })

  it('falls back to the default ticket printer when no till printer is set', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter(KITCHEN)
    store.saveSettings({ tillPrinter: null, defaultTicketPrinterId: kitchen })

    await store.print([['x']])
    expect(targetOf(printToPrinter.mock.calls[0])).toMatchObject({ printer: 'Kitchen Printer' })
  })

  it('probePrinter marks connected when QZ Tray answers and the printer exists', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ tillPrinter: { kind: 'system', printer: 'Till Printer' } })
    listPrinters.mockResolvedValueOnce(['Till Printer'])

    await expect(store.probePrinter()).resolves.toBe(true)
    expect(printerState.connected).toBe(true)
  })

  it('probePrinter reports a missing printer and an unreachable QZ Tray', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({ tillPrinter: { kind: 'system', printer: 'Gone' } })
    listPrinters.mockResolvedValueOnce(['Something Else'])
    await expect(store.probePrinter()).resolves.toBe(false)
    expect(printerState.reason).toContain('Gone')

    listPrinters.mockRejectedValueOnce(new Error('connection refused'))
    await expect(store.probePrinter()).resolves.toBe(false)
    expect(printerState.connected).toBe(false)
  })
})

describe('print settings — routing each line to its own pass', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    printToPrinter.mockClear()
    printToPrinter.mockResolvedValue(true)
  })

  const kitchenLines = [['KITCHEN ORDER TICKET'], ['1 x Mchemsho']]
  const barLines = [['BAR ORDER TICKET'], ['2 x Kilimanjaro']]

  /** Builds the rows a pass would print, and says which passes have content. */
  const build = (kitchen, bar) => async (station) => (station === 'kitchen' ? kitchen : bar)
  const has = (kitchen, bar) => (station) => (station === 'kitchen' ? kitchen : bar)

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

  it('deleting a printer clears the station routes that pointed at it', () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      ticketPrinters: [
        { id: 'p-kitchen', ...KITCHEN },
        { id: 'p-bar', ...BAR },
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
        { id: 'p-kitchen', ...KITCHEN },
        { id: 'p-bar', ...BAR },
        { id: 'p-default', kind: 'system', printer: 'Default Printer' },
      ],
      departmentRouting: { restaurant: 'p-kitchen' },
      stationRouting: { bar: 'p-bar' },
      defaultTicketPrinterId: 'p-default',
    })

    await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    // The kitchen ticket went to the restaurant route; the bar ticket used its
    // own station route and therefore the network printer.
    const [kitchenTarget, barTarget] = printToPrinter.mock.calls.map(targetOf)
    expect(kitchenTarget.printer).toBe('Kitchen Printer')
    expect(barTarget.host).toBe('10.0.0.6')
  })

  it('a station route pointing at a deleted printer falls back, never drops', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      ticketPrinters: [{ id: 'p-default', kind: 'system', printer: 'Default Printer' }],
      stationRouting: { bar: 'p-removed' },
      defaultTicketPrinterId: 'p-default',
    })

    await store.printFoodTicketsByStation(build(kitchenLines, barLines), 'restaurant', { hasLinesFor: has(true, true) })

    // Both passes still printed rather than the bar ticket vanishing.
    expect(printToPrinter).toHaveBeenCalledTimes(2)
  })
})
