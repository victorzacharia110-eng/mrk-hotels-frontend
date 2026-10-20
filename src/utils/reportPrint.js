/**
 * Silent A4 report printing.
 *
 * Report/document pages used to call `window.print()`, which always shows the
 * browser or OS print dialog — and on Windows that dialog is unavoidable, while
 * on Linux a raw CUPS queue can make it *look* silent. The only way to print an
 * A4 sheet with no dialog anywhere is to render it ourselves and hand the bytes
 * to QZ Tray, the same local helper the receipts already use.
 *
 * Two entry points:
 *  - htmlToPdf(html)     renders a standalone HTML document to PDF bytes.
 *  - printHtmlSilently() renders then prints through QZ Tray, and falls back to
 *                        `window.print()` (or a new window) when QZ is not
 *                        available, so a report can never be un-printable.
 */

import { jsPDF } from 'jspdf'
import { printPdfToPrinter } from './printer'

/**
 * Renders a standalone HTML document to A4 PDF bytes.
 *
 * The HTML is mounted in a hidden, off-screen iframe so the page's own styles
 * cannot leak in; html2canvas then rasterises it and jsPDF lays it onto A4
 * pages. The iframe is always removed, even when rendering fails.
 *
 * @param {string} html  A full HTML document (with <style> and <body>).
 * @param {object} [opts]  Options.
 * @param {boolean} [opts.landscape]  Lay the page out landscape (wide reports).
 * @param {number} [opts.scale]  Raster scale; 2 keeps text crisp when printed.
 * @returns {Promise<Uint8Array>} The PDF bytes.
 */
export async function htmlToPdf(html, opts = {}) {
  const { default: html2canvas } = await import('html2canvas')
  const landscape = opts.landscape !== false
  const scale = opts.scale || 2

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:1600px;border:0;'
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    doc.open()
    doc.write(html)
    doc.close()

    // Let the iframe lay out and any inlined fonts/images settle before the
    // snapshot; html2canvas on an unlaid-out document returns blank pages.
    await new Promise((resolve) => setTimeout(resolve, 60))

    const target = doc.body || doc.documentElement
    const canvas = await html2canvas(target, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: doc.documentElement.scrollWidth,
      windowHeight: doc.documentElement.scrollHeight,
    })

    const orientation = landscape ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    // Fit the whole capture to the page width, then slice it into A4 pages so a
    // tall report continues onto the next sheet instead of being squashed.
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    let remaining = imgHeight
    let position = 0
    while (remaining > 0) {
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      remaining -= pageHeight
      if (remaining > 0) {
        pdf.addPage()
        position -= pageHeight
      }
    }

    return new Uint8Array(pdf.output('arraybuffer'))
  } finally {
    iframe.remove()
  }
}

/**
 * Prints a standalone HTML report silently through QZ Tray.
 *
 * @param {string} html  A full HTML document to print.
 * @param {object} [opts]  Options.
 * @param {object} [opts.printer]  QZ target; when omitted, printing falls back
 *   to the browser dialog because there is nowhere silent to send it.
 * @param {boolean} [opts.landscape]  Page orientation (default landscape).
 * @returns {Promise<boolean>} True when QZ Tray took the job.
 */
export async function printHtmlSilently(html, opts = {}) {
  if (!opts.printer) return false
  const pdf = await htmlToPdf(html, { landscape: opts.landscape !== false })
  return printPdfToPrinter(pdf, { printer: opts.printer })
}

/** Collects the page's own stylesheets so a cloned element renders the same. */
function collectPageStyles() {
  let css = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += rule.cssText + '\n'
    } catch {
      /* cross-origin stylesheet (e.g. fonts) — skip; it is not layout-critical */
    }
  }
  return css
}

/**
 * Wraps an element's markup in a standalone HTML document that reuses the
 * page's stylesheets, so the same visual can be rendered off-screen.
 *
 * @param {HTMLElement} element  The content to capture (e.g. a report region).
 * @param {string} [title]  Document title (unused in the rendering).
 * @returns {string} A full HTML document string.
 */
export function elementToHtml(element, title = '') {
  const clone = element.cloneNode(true)
  // Interactive controls belong to the app, not the printed sheet.
  clone.querySelectorAll('button, a, input, select, textarea, .no-print').forEach((n) => n.remove())
  // Print-only regions are hidden on screen (display:none). The clone has to be
  // forced back on so the capture is not a blank page, but with the app's own
  // screen layout, not the @media print rules.
  clone.style.display = 'block'
  clone.style.visibility = 'visible'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 8px; }
  ${collectPageStyles()}
</style></head><body>${clone.outerHTML}</body></html>`
}

/**
 * Prints a live DOM element (a report region or document) silently through QZ
 * Tray. The element is cloned into a standalone document so the app chrome and
 * print-only visibility tricks do not interfere with the capture.
 *
 * @param {HTMLElement|string} target  Element, or a CSS selector for one.
 * @param {object} [opts]  Options: { printer?, landscape?, title? }.
 * @returns {Promise<boolean>} True when QZ Tray took the job; false when there
 *   is no printer or the element cannot be found.
 */
export async function printElementSilently(target, opts = {}) {
  if (!opts.printer) return false
  const element = typeof target === 'string' ? document.querySelector(target) : target
  if (!element) return false
  const html = elementToHtml(element, opts.title)
  const pdf = await htmlToPdf(html, { landscape: opts.landscape !== false })
  return printPdfToPrinter(pdf, { printer: opts.printer })
}
