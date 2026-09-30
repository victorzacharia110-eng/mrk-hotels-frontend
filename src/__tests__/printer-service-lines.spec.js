import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import PrinterSettingsPage from '@/pages/printer/PrinterSettingsPage.vue'

/**
 * The service-line routing table used to be a hardcoded ['restaurant', 'bar']
 * while `department` had already become free text. A hotel that filed its menu
 * under "KITCHEN" or "ROOM SERVICE" therefore had no row to route, and its
 * tickets silently fell through to the default printer.
 *
 * These tests mount the real page and read the rendered table, so the list on
 * screen is what is asserted on.
 */

const categoryIndex = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  menuCategoryApi: { index: (...a) => categoryIndex(...a) },
}))

// The transport is stubbed: the page probes support on mount.
vi.mock('@/utils/printer', async (importOriginal) => ({
  ...(await importOriginal()),
  printerState: { connected: false, reason: '', info: '' },
  printerSupported: () => true,
  connectPrinter: vi.fn().mockResolvedValue(true),
  disconnectPrinter: vi.fn(),
  restorePrinter: vi.fn().mockResolvedValue(true),
  printToPrinter: vi.fn().mockResolvedValue(true),
}))

const CATEGORY = (department, name) => ({ category_id: `${department}-${name}`, department, name, item_count: 1 })

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
  categoryIndex.mockResolvedValue({
    data: { data: [CATEGORY('restaurant', 'Mains'), CATEGORY('bar', 'Drinks')] },
  })
  // The routing table is hidden until at least one ticket printer exists, so
  // every test starts with one in place.
  usePrintSettingsStore().addTicketPrinter({
    name: 'Kitchen',
    transport: 'network',
    endpoint: 'http://10.0.0.5:9720',
  })
})

async function mountPage() {
  const wrapper = mount(PrinterSettingsPage, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper
}

/**
 * The first cell of every service-line row in the routing table.
 *
 * Scoped to the FIRST table: the page also carries a pass-routing table (the
 * kitchen and bar printers), so reading every table would mix the two and make
 * this assert on rows it is not about.
 */
function renderedLines(wrapper) {
  return wrapper.findAll('table')[0].findAll('tbody tr').map((tr) => tr.findAll('td')[0].text())
}

/** The first cell of every pass row in the pass-routing table. */
function renderedPasses(wrapper) {
  return wrapper.findAll('table')[1].findAll('tbody tr').map((tr) => tr.findAll('td')[0].text())
}

describe('PrinterSettingsPage — service lines', () => {
  it('lists the service lines the hotel actually files its menu under', async () => {
    categoryIndex.mockResolvedValue({
      data: {
        data: [
          CATEGORY('restaurant', 'Mains'),
          CATEGORY('bar', 'Drinks'),
          CATEGORY('KITCHEN', 'Grills'),
          CATEGORY('Room Service', 'In-room'),
        ],
      },
    })

    const wrapper = await mountPage()

    const lines = renderedLines(wrapper)
    expect(lines).toContain('KITCHEN')
    expect(lines).toContain('Room Service')
  })

  it('deduplicates categories that share a service line', async () => {
    categoryIndex.mockResolvedValue({
      data: { data: [CATEGORY('restaurant', 'Mains'), CATEGORY('restaurant', 'Starters'), CATEGORY('bar', 'Drinks')] },
    })

    const wrapper = await mountPage()

    const lines = renderedLines(wrapper)
    expect(lines.filter((l) => l === 'restaurant')).toHaveLength(1)
    expect(lines).toEqual(['restaurant', 'bar'])
  })

  it('keeps the two default lines when the menu cannot be read', async () => {
    // A failed load must not leave the page with nothing to configure.
    categoryIndex.mockRejectedValue(new Error('offline'))

    const wrapper = await mountPage()

    expect(renderedLines(wrapper)).toEqual(['restaurant', 'bar'])
  })

  it('keeps a routed line listed after its last menu category is removed', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    store.saveSettings({ departmentRouting: { KITCHEN: kitchen } })
    // The hotel deleted its last KITCHEN category, so the API no longer mentions
    // that line — but a printer is still routed to it and must stay editable.
    categoryIndex.mockResolvedValue({ data: { data: [CATEGORY('restaurant', 'Mains')] } })

    const wrapper = await mountPage()

    const lines = renderedLines(wrapper)
    expect(lines).toContain('KITCHEN')
    expect(lines).toContain('restaurant')
  })

  it('offers a routing row for each printer pass a menu item can be filed under', async () => {
    // Manager review item 4 lets a menu item choose KITCHEN or BAR as the printer
    // that receives its order ticket. That choice is only honoured if there is
    // somewhere to point it, so the passes need rows of their own -- distinct
    // from the service lines, which are a different axis entirely.
    const wrapper = await mountPage()

    expect(renderedPasses(wrapper)).toEqual(['Kitchen pass', 'Bar pass'])
  })

  it('saves the pass a printer is routed to', async () => {
    const store = usePrintSettingsStore()
    const bar = store.addTicketPrinter({ name: 'Bar', transport: 'network', endpoint: 'http://10.0.0.6:9720' })

    const wrapper = await mountPage()
    const barRow = wrapper.findAll('table')[1].findAll('tbody tr').find((tr) => tr.text().includes('Bar pass'))
    await barRow.find('select').setValue(bar)

    expect(store.stationRouting.bar).toBe(bar)
  })

  it('leaves a pass following the service line until it is set', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen 2', transport: 'network', endpoint: 'http://10.0.0.7:9720' })

    const wrapper = await mountPage()
    const kitchenRow = wrapper.findAll('table')[1].findAll('tbody tr').find((tr) => tr.text().includes('Kitchen pass'))
    // Unset means "use the service line's printer", so it is stored as an
    // absent key rather than as an empty printer id.
    expect(kitchenRow.find('select').element.value).toBe('')

    await kitchenRow.find('select').setValue(kitchen)
    expect(store.stationRouting.kitchen).toBe(kitchen)

    await kitchenRow.find('select').setValue('')
    expect(store.stationRouting.kitchen).toBeUndefined()
  })

  it('routes a food ticket for a dynamically discovered line', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({ name: 'Kitchen', transport: 'network', endpoint: 'http://10.0.0.5:9720' })
    const grill = store.addTicketPrinter({ name: 'Grill', transport: 'network', endpoint: 'http://10.0.0.6:9720' })
    store.saveSettings({ departmentRouting: { KITCHEN: kitchen, GRILL: grill } })
    categoryIndex.mockResolvedValue({ data: { data: [CATEGORY('KITCHEN', 'Mains'), CATEGORY('GRILL', 'Grills')] } })

    const wrapper = await mountPage()

    const rows = wrapper.findAll('table tbody tr')
    const kitchenRow = rows.find((tr) => tr.text().includes('KITCHEN'))
    expect(kitchenRow.find('select').element.value).toBe(kitchen)
    const grillRow = rows.find((tr) => tr.text().includes('GRILL'))
    expect(grillRow.find('select').element.value).toBe(grill)
  })
})
