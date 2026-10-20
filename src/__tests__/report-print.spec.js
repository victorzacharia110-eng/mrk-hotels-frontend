import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Silent A4 report printing. These pin the contract the report pages rely on:
 * an HTML document is turned into a PDF and handed to QZ Tray, and when no
 * printer is configured the caller gets `false` so it can fall back to the
 * browser dialog instead of dropping the print.
 */

const printer = vi.hoisted(() => ({ printPdfToPrinter: vi.fn().mockResolvedValue(true) }))
vi.mock('@/utils/printer', () => ({
  printPdfToPrinter: printer.printPdfToPrinter,
}))

const html2canvas = vi.hoisted(() => vi.fn())
vi.mock('html2canvas', () => ({ default: html2canvas }))

const pdf = vi.hoisted(() => {
  const instance = {
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    addImage: vi.fn(),
    addPage: vi.fn(),
    output: vi.fn(() => new ArrayBuffer(8)),
  }
  const ctor = vi.fn(function () {
    return instance
  })
  return { instance, ctor }
})
vi.mock('jspdf', () => ({ jsPDF: pdf.ctor }))

const { htmlToPdf, printHtmlSilently, elementToHtml, printElementSilently } = await import(
  '@/utils/reportPrint'
)

// A canvas stub with the surface html2canvas would return.
function fakeCanvas() {
  return { width: 1200, height: 1600, toDataURL: () => 'data:image/jpeg;base64,AAAA' }
}

beforeEach(() => {
  vi.clearAllMocks()
  printer.printPdfToPrinter.mockResolvedValue(true)
  html2canvas.mockResolvedValue(fakeCanvas())
})

describe('reportPrint', () => {
  it('renders an HTML document to PDF bytes', async () => {
    const bytes = await htmlToPdf('<html><body><h1>Report</h1></body></html>')

    expect(html2canvas).toHaveBeenCalledOnce()
    expect(pdf.ctor).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  it('removes the off-screen iframe it rendered in', async () => {
    const before = document.querySelectorAll('iframe').length
    await htmlToPdf('<html><body>x</body></html>')
    expect(document.querySelectorAll('iframe').length).toBe(before)
  })

  it('prints HTML silently through the configured printer', async () => {
    const ok = await printHtmlSilently('<html><body>x</body></html>', {
      printer: { kind: 'system', printer: 'Front desk' },
    })

    expect(ok).toBe(true)
    expect(printer.printPdfToPrinter).toHaveBeenCalledOnce()
  })

  it('returns false without printing when no printer is configured', async () => {
    const ok = await printHtmlSilently('<html><body>x</body></html>', { printer: null })

    expect(ok).toBe(false)
    expect(printer.printPdfToPrinter).not.toHaveBeenCalled()
  })

  it('strips interactive controls from a captured element', () => {
    const el = document.createElement('div')
    el.innerHTML = '<button>Print</button><a href="#">Link</a><p>Keep me</p>'
    const html = elementToHtml(el, 'T')

    expect(html).toContain('Keep me')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<a ')
  })

  it('prints a DOM element silently, forcing a print-only region visible', async () => {
    const el = document.createElement('div')
    el.className = 'print-area'
    el.style.display = 'none'
    el.textContent = 'Purchase order'
    document.body.appendChild(el)

    const ok = await printElementSilently('.print-area', {
      printer: { kind: 'system', printer: 'Front desk' },
    })

    expect(ok).toBe(true)
    expect(printer.printPdfToPrinter).toHaveBeenCalledOnce()
    el.remove()
  })

  it('does nothing when the target element cannot be found', async () => {
    const ok = await printElementSilently('#missing-element', {
      printer: { kind: 'system', printer: 'Front desk' },
    })

    expect(ok).toBe(false)
    expect(printer.printPdfToPrinter).not.toHaveBeenCalled()
  })
})
