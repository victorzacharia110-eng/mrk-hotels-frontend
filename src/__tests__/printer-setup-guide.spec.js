import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import PrinterSettingsPage from '@/pages/printer/PrinterSettingsPage.vue'

/**
 * The setup guide is the client's installation path: four numbered steps, each
 * with a live status chip (Done / To do / Optional / Not needed) and a jump to
 * the section it is talking about. Printing now goes through QZ Tray, so the
 * steps are: install QZ Tray, connect, choose the till printer, test. These
 * tests read the rendered guide so the statuses on screen are what is asserted
 * on — a chip that says "Done" while the underlying condition is unmet is
 * exactly the lie this guards against.
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
  listPrinters: vi.fn().mockResolvedValue([]),
  restorePrinter: vi.fn().mockResolvedValue(true),
  printToPrinter: vi.fn().mockResolvedValue(true),
}))

const { printerState, printToPrinter, connectPrinter } = await import('@/utils/printer')

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

const TILL = { kind: 'system', printer: 'ZyWell Zy-Q822', label: 'ZyWell Zy-Q822' }

describe('PrinterSettingsPage — setup guide', () => {
  it('renders the four steps with their titles', async () => {
    const wrapper = await mountPage()

    expect(titles(wrapper)).toEqual([
      'Install QZ Tray',
      'Connect to QZ Tray',
      'Choose the till printer',
      'Test the connection',
    ])
  })

  it('starts with every step to do', async () => {
    const wrapper = await mountPage()

    expect(chips(wrapper)).toEqual(['To do', 'To do', 'To do', 'To do'])
  })

  it('marks the connect steps done once QZ Tray is connected', async () => {
    const wrapper = await mountPage()

    const connectBtn = wrapper.findAll('button').find((b) => b.text().includes('Connect'))
    expect(connectBtn).toBeTruthy()
    await connectBtn.trigger('click')
    await flushPromises()

    expect(connectPrinter).toHaveBeenCalled()
    expect(chips(wrapper)[0]).toBe('Done')
    expect(chips(wrapper)[1]).toBe('Done')
  })

  it('marks the printer step done once a till printer is chosen', async () => {
    usePrintSettingsStore().saveSettings({ tillPrinter: TILL })

    const wrapper = await mountPage()

    expect(chips(wrapper)[2]).toBe('Done')
  })

  it('marks step 4 done only after a test print comes back', async () => {
    usePrintSettingsStore().saveSettings({ tillPrinter: TILL })
    const wrapper = await mountPage()

    const testBtn = wrapper.findAll('button').find((b) => b.text().includes('Test Print'))
    expect(testBtn).toBeTruthy()
    await testBtn.trigger('click')
    await flushPromises()

    expect(chips(wrapper)[3]).toBe('Done')
    expect(printToPrinter).toHaveBeenCalled()
  })

  it('states the requirements and the QZ Tray setup', async () => {
    const wrapper = await mountPage()

    expect(wrapper.find('.reqs').text()).toContain('ESC/POS thermal')
    expect(wrapper.find('.reqs').text()).toContain('QZ Tray')
  })

  it('jumps to the section its step talks about', async () => {
    const wrapper = await mountPage()

    // Every step's jump target must exist on the page, or the button no-ops.
    expect(wrapper.find('#ticket-printers').exists()).toBe(true)
    expect(wrapper.find('#connection').exists()).toBe(true)
    expect(wrapper.find('#downloads').exists()).toBe(true)
    expect(wrapper.find('#when-to-print').exists()).toBe(true)

    const openBtn = wrapper.findAll('.steps .step')[1].find('.link-btn')
    expect(openBtn.text()).toContain('Open this section')
    await openBtn.trigger('click')
  })

  it('makes the QZ Tray download the one obvious download', async () => {
    const wrapper = await mountPage()

    // A single primary button, so the client is never asked to choose.
    const cards = wrapper.findAll('.downloads .download-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].attributes('href')).toContain('qz.io/download')
    expect(cards[0].text()).toContain('Download QZ Tray')
    expect(cards[0].text()).toContain('Recommended')

    // The setup guide and the QZ Tray docs remain as quiet fallback links.
    const alt = wrapper.findAll('.download-alt a')
    expect(alt).toHaveLength(2)
    expect(alt[0].attributes('href')).toBe('/MRK_Hotels_Printer_Setup_Guide.pdf')
    expect(alt[1].attributes('href')).toBe('https://qz.io/docs')
  })
})
