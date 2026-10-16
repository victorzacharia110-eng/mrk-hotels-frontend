import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import PrinterSettingsPage from '@/pages/printer/PrinterSettingsPage.vue'

/**
 * The setup guide is the client's installation path: four numbered steps, each
 * with a live status chip (Done / To do / Optional / Not needed) and a jump to
 * the section it is talking about. These tests read the rendered guide so the
 * statuses on screen are what is asserted on — a chip that says "Done" while
 * the underlying condition is unmet is exactly the lie this guards against.
 */

const categoryIndex = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  menuCategoryApi: { index: (...a) => categoryIndex(...a) },
}))

vi.mock('@/utils/printer', async (importOriginal) => ({
  ...(await importOriginal()),
  printerState: { connected: false, reason: '', info: '' },
  printerSupported: () => true,
  connectPrinter: vi.fn().mockResolvedValue(true),
  disconnectPrinter: vi.fn(),
  restorePrinter: vi.fn().mockResolvedValue(true),
  printToPrinter: vi.fn().mockResolvedValue(true),
}))

const { printerState, printToPrinter } = await import('@/utils/printer')

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
  printerState.connected = false
  categoryIndex.mockResolvedValue({
    data: { data: [{ category_id: 'c1', department: 'restaurant', name: 'Mains', item_count: 1 }] },
  })
})

async function mountPage() {
  const wrapper = mount(PrinterSettingsPage, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper
}

/** Chip label per step, in step order (the guide renders steps as <li>s). */
function chips(wrapper) {
  return wrapper.findAll('.steps .step').map((li) => li.find('.chip').text())
}

/** Titles per step, in step order. */
function titles(wrapper) {
  return wrapper.findAll('.steps .step').map((li) => li.find('strong').text())
}

describe('PrinterSettingsPage — setup guide', () => {
  it('renders the four steps with their titles', async () => {
    const wrapper = await mountPage()

    expect(titles(wrapper)).toEqual([
      'Set the print agent endpoint',
      'Add the kitchen & bar printers',
      'Route service lines and passes',
      'Test the connection',
    ])
  })

  it('starts with the till and test steps to do, and the printer steps skippable', async () => {
    const wrapper = await mountPage()

    expect(chips(wrapper)).toEqual(['To do', 'Optional', 'Not needed', 'To do'])
  })

  it('marks step 2 done once a ticket printer exists, which makes step 3 relevant', async () => {
    usePrintSettingsStore().addTicketPrinter({
      name: 'Kitchen',
      transport: 'network',
      endpoint: 'http://10.0.0.5:9720',
    })

    const wrapper = await mountPage()

    expect(chips(wrapper)).toEqual(['To do', 'Done', 'To do', 'To do'])
  })

  it('marks step 3 done when a default printer catches every unrouted line', async () => {
    const store = usePrintSettingsStore()
    const kitchen = store.addTicketPrinter({
      name: 'Kitchen',
      transport: 'network',
      endpoint: 'http://10.0.0.5:9720',
    })
    store.saveSettings({ defaultTicketPrinterId: kitchen })

    const wrapper = await mountPage()

    expect(chips(wrapper)[2]).toBe('Done')
  })

  it('marks step 4 done only after a test print comes back', async () => {
    // The till prints over the network, so an agent endpoint must be set first.
    usePrintSettingsStore().saveSettings({ transport: 'network', endpoint: 'http://10.0.0.9:9720' })
    const wrapper = await mountPage()

    const testBtn = wrapper.findAll('button').find((b) => b.text().includes('Test Print'))
    expect(testBtn).toBeTruthy()
    await testBtn.trigger('click')
    await flushPromises()

    expect(chips(wrapper)[3]).toBe('Done')
    expect(printToPrinter).toHaveBeenCalled()
  })

  it('states the requirements and the bridge-agent setup in order', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('.reqs').text()).toContain('ESC/POS thermal')
    const bridgeItems = wrapper.findAll('.bridge-help li').map((li) => li.text())
    expect(bridgeItems).toHaveLength(3)
    expect(bridgeItems[0]).toContain('Windows setup')
    expect(bridgeItems[1]).toContain(':9720')
  })

  it('jumps to the section its step talks about', async () => {
    const wrapper = await mountPage()

    // Every step's jump target must exist on the page, or the button no-ops.
    expect(wrapper.find('#ticket-printers').exists()).toBe(true)
    expect(wrapper.find('#connection').exists()).toBe(true)
    expect(wrapper.find('#when-to-print').exists()).toBe(true)

    const openBtn = wrapper.findAll('.steps .step')[1].find('.link-btn')
    expect(openBtn.text()).toContain('Open this section')
    await openBtn.trigger('click')
  })

  it('makes the Windows .exe the one obvious download', async () => {
    const wrapper = await mountPage()

    // A single primary button, so the client is never asked to choose. It is too
    // big to ship in the repo, so it lives as a GitHub Release asset.
    const cards = wrapper.findAll('.downloads .download-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].attributes('href')).toContain('mrk-printer-bridge.exe')
    expect(cards[0].text()).toContain('Download for Windows')
    expect(cards[0].text()).toContain('Recommended')

    // The guide and the source zip remain as quiet fallback links, served from
    // public/ as downloads rather than navigating the app away.
    const alt = wrapper.findAll('.download-alt a')
    expect(alt).toHaveLength(2)
    expect(alt[0].attributes('href')).toBe('/MRK_Hotels_Printer_Setup_Guide.pdf')
    expect(alt[0].attributes()).toHaveProperty('download')
    expect(alt[1].attributes('href')).toBe('/MRK_Printer_Bridge.zip')
    expect(alt[1].attributes()).toHaveProperty('download')
  })
})
