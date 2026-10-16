/**
 * Printer service — direct thermal printing through QZ Tray.
 *
 * The POS prints its receipts and kitchen tickets to an ESC/POS thermal
 * printer. Instead of a hand-rolled bridge agent, printing goes through
 * QZ Tray, the free cross-platform helper (Windows / macOS / Linux) that
 * exposes a local websocket the browser can drive over HTTPS. QZ Tray can
 * reach the printer over USB (its OS driver), Serial, or a raw network
 * socket — so one printer profile works on any till.
 *
 * A "target" is how a printer is described to QZ Tray:
 *   { kind: 'system', printer: 'ZyWell Zy-Q822', label: 'Front desk' }
 *   { kind: 'socket', host: '192.168.1.100', port: 9100, label: 'Kitchen' }
 *
 * When no target is configured (or QZ Tray is unavailable), the caller gets a
 * false result and a reason on `printerState`, so the UI can tell the operator
 * exactly what to fix rather than failing silently.
 */

import { reactive } from 'vue'
import { qzConnect, qzDisconnect, qzIsActive, qzListPrinters, qzPrintRaw, qzSupported } from './qz'

/**
 * Shared connection state so any page sees whether the till printer is usable.
 * - connected -> QZ Tray is reachable AND a print has been handed to the
 *                printer, or a connect/probe confirmed the target exists.
 * - info      -> human-readable label for the connected target.
 * - reason    -> why printing is unavailable (empty when it can).
 */
export const printerState = reactive({ connected: false, info: '', reason: '' })

/** Does this browser have the WebSocket + btoa QZ Tray needs? (all desktops do.) */
export function printerSupported() {
  return qzSupported()
}

/** ESC/POS command bytes used to build a 58/80mm receipt. */
const ESC = { init: 0x1b, feed: 0x64 }

/**
 * Wraps a text line into the byte stream for the printer.
 *
 * Double-width (size 2) text takes two columns per character, so a line that
 * was padded to the full 48-char width would overflow the roll and wrap onto
 * a second line (paper runs long). Cap those lines at half the width — the
 * exact number of columns a double-size 48-wide line can hold.
 *
 * @param {Uint8Array} out  The accumulating buffer.
 * @param {string} text     The line to print.
 * @param {boolean} bold    Bold line flag.
 * @param {number} [size]   0 = normal, 1 = double height, 2 = double width (+height).
 */
const DOUBLE_WIDTH_CHARS = Math.floor(48 / 2) // 24 columns = a full 48-char line at double size.
function pushLine(out, text = '', bold = false, size = 0) {
  if (size === 2 && text.length > DOUBLE_WIDTH_CHARS) {
    text = text.slice(0, DOUBLE_WIDTH_CHARS)
  }
  if (size) {
    // GS ! n — double height (1) and/or double width (2) characters so the
    // header and total actually fill the paper instead of a thin single line.
    out.push(0x1d, 0x21, size === 2 ? 0x11 : 0x01)
  }
  if (bold) {
    out.push(ESC.init, 0x45, 0x01) // ESC E 1 (bold on)
  }
  const bytes = new TextEncoder().encode(text)
  bytes.forEach((b) => out.push(b))
  out.push(0x0a) // LF
  if (bold) {
    out.push(ESC.init, 0x45, 0x00) // ESC E 0 (bold off)
  }
  if (size) {
    out.push(0x1d, 0x21, 0x00) // back to normal size
  }
}

/**
 * Builds the full ESC/POS byte stream for a receipt.
 *
 * @param {Array<Array<string|boolean|number>>} lines  [text, bold?, size?] rows.
 * @returns {Uint8Array} The bytes to write.
 */
export function buildRecipt(lines) {
  const out = []
  out.push(ESC.init, 0x40) // ESC @ — reset the printer.
  out.push(0x1b, 0x4d, 0x00) // ESC M 0 — Font A (12-dot) so 48-char lines fill an 80mm roll (576 dots).

  for (const [text, bold, size] of lines) {
    pushLine(out, text, bold, size || 0)
  }

  out.push(ESC.init, ESC.feed, 3) // FF 3 — a few line feeds before the cut.
  out.push(0x1d, 0x56, 0x00) // GS V 0 — full cut.

  return Uint8Array.from(out)
}

/**
 * Turns a receipt width of 48 chars into the column layout used for lines.
 * Centro-places text; `justify` pads with spaces; plain lines are kept.
 *
 * @param {string} text  The raw line.
 * @param {string} [mode]  'center' | 'justify' | 'left'.
 * @param {number} [width]  Characters per line (80mm => 48).
 * @returns {string} The padded line.
 */
export function padLine(text, mode = 'left', width = 48) {
  if (mode === 'center') {
    const pad = Math.max(0, Math.floor((width - text.length) / 2))
    return ' '.repeat(pad) + text
  }
  if (mode === 'justify') return text.padEnd(width, ' ')
  return text.padEnd(width, ' ')
}

/**
 * One receipt row: left item name, right amount.
 *
 * @param {string} item  Item label.
 * @param {string} [right]  Amount aligned right.
 * @param {number} [width]  Line width.
 * @returns {string} The composed line.
 */
export function itemRow(item, right = '', width = 48) {
  if (!right) return padLine(item, 'left', width)
  const amount = right.toString()
  const joined = item + ' '.repeat(Math.max(0, width - item.length - amount.length)) + amount
  return joined.slice(0, width)
}

/**
 * Is a target complete enough to send to QZ Tray?
 * @param {{kind?:string, printer?:string, host?:string}} target
 * @returns {boolean}
 */
export function targetUsable(target) {
  if (!target) return false
  if (target.kind === 'socket') return Boolean(target.host)
  return Boolean(target.printer)
}

/**
 * The label to show for a target.
 * @param {object} target
 * @returns {string}
 */
export function targetLabel(target) {
  if (!target) return ''
  if (target.label) return target.label
  if (target.kind === 'socket') return `${target.host}:${target.port || 9100}`
  return target.printer || ''
}

/**
 * Turns a QZ/transport error into an operator-facing sentence.
 * @param {unknown} err
 * @returns {string}
 */
export function connectReason(err) {
  const msg = String(err?.message || err || '')
  if (/websocket|unable to (open|connect)|econnrefused|refused|timed out|404|not found: qz/i.test(msg)) {
    return 'QZ Tray is not running on this computer, or the connection was blocked. Install and open QZ Tray (qz.io/download), then allow it when the browser asks.'
  }
  return msg || 'Could not reach QZ Tray.'
}

/**
 * Reconnects to a printer that was already working earlier in this session.
 *
 * Deliberately does NOT open a new QZ Tray connection: doing so on every page
 * load would fire the "Allow this site" dialog at the operator for no reason.
 * If QZ Tray's socket is already open the state is refreshed; otherwise the
 * caller prints lazily and QZ Tray connects on the first real job.
 *
 * @returns {Promise<boolean>} True when QZ Tray is already connected.
 */
export async function restorePrinter() {
  try {
    if (await qzIsActive()) {
      printerState.connected = true
      printerState.reason = ''
      printerState.info = 'QZ Tray'
      return true
    }
  } catch {
    /* not connected yet — printing will connect on demand. */
  }
  return false
}

/**
 * Connects to the local QZ Tray software.
 *
 * @param {object|null} [target]  Optional target whose label is shown.
 * @returns {Promise<boolean>} True when QZ Tray answered.
 */
export async function connectPrinter(target = null) {
  if (!printerSupported()) {
    printerState.connected = false
    printerState.reason = 'This browser cannot reach QZ Tray. Use Chrome, Edge, Firefox or Safari on a desktop.'
    return false
  }
  try {
    await qzConnect()
    printerState.connected = true
    printerState.reason = ''
    printerState.info = target ? targetLabel(target) : 'QZ Tray'
    return true
  } catch (err) {
    printerState.connected = false
    printerState.reason = connectReason(err)
    return false
  }
}

/**
 * Closes the QZ Tray connection.
 * @returns {Promise<void>}
 */
export async function disconnectPrinter() {
  await qzDisconnect()
  printerState.connected = false
  printerState.info = ''
}

/**
 * Lists the printer names QZ Tray can see on this machine.
 *
 * @returns {Promise<string[]>} Printer names (empty when none are installed).
 * @throws When QZ Tray cannot be reached (use connectReason to explain it).
 */
export async function listPrinters() {
  return qzListPrinters()
}

/**
 * Scales a logo down to a monochrome raster the thermal printer can draw and
 * returns the ESC/POS "GS v 0" byte block that prints it.
 *
 * Transparent pixels become white; everything dark becomes a printed dot.
 * Widths in dots: 384 for a 58mm roll, 576 for 80mm.
 *
 * @param {string} src  Logo URL. Read with CORS so the canvas stays untainted;
 *   a logo that cannot be read cross-origin is skipped, never fatal.
 * @param {number} [width]  Target width in printer dots.
 * @returns {Promise<Uint8Array>} The raster command block.
 */
export async function rasterLogoBytes(src, width = 384) {
  // The public asset host caches objects without the bucket's CORS headers; a
  // fixed query param keys a fresh CDN entry that DOES carry them, so the
  // crossOrigin canvas read succeeds instead of throwing "tainted canvas".
  const corsUrl = src + (src.includes('?') ? '&' : '?') + 'cors=1'
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the logo for printing.'))
    img.src = corsUrl
  })

  const scale = width / image.width
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)

  const rowBytes = Math.ceil(width / 8)
  const out = []
  for (let y = 0; y < height; y += 1) {
    for (let col = 0; col < rowBytes; col += 1) {
      let byte = 0
      for (let bit = 0; bit < 8; bit += 1) {
        const x = col * 8 + bit
        // LSB-first: bit 0 is the leftmost dot.
        if (x < width) {
          const a = data[(y * width + x) * 4 + 3]
          const lum = data[(y * width + x) * 4] * 0.299 + data[(y * width + x) * 4 + 1] * 0.587 + data[(y * width + x) * 4 + 2] * 0.114
          if (a > 128 && lum < 140) {
            byte |= 1 << bit
          }
        }
      }
      out.push(byte)
    }
  }

  const heightBytes = out.length / rowBytes
  const block = [
    0x1d, 0x76, 0x30, 0x00, // GS v 0, m = normal raster
    rowBytes & 0xff, rowBytes >> 8, // xL xH
    heightBytes & 0xff, heightBytes >> 8, // yL yH
    ...out,
  ]
  return Uint8Array.from(block)
}

/**
 * Prints a set of receipt lines (plus an optional raster logo) to the printer
 * through QZ Tray.
 *
 * @param {Array<Array<string|boolean|number>>} lines  [text, bold?, size?] rows.
 * @param {object} [opts]  Options.
 * @param {string} [opts.logo]  Logo URL to raster a store brand on top of the sheet.
 * @param {number} [opts.logoWidth]  Logo width in dots; defaults to 384 (48mm).
 * @param {object} [opts.printer]  The QZ target to print to.
 * @returns {Promise<boolean>} True when the job was handed to the printer.
 */
export async function printToPrinter(lines, opts = {}) {
  const target = opts.printer
  if (!targetUsable(target)) {
    printerState.connected = false
    printerState.reason = 'No printer is set up yet. Open Printer Settings, install QZ Tray and choose your printer.'
    return false
  }
  try {
    let raster = null
    if (opts.logo) {
      try {
        raster = await rasterLogoBytes(opts.logo, opts.logoWidth)
      } catch {
        // A logo we cannot read cross-origin must not stop the receipt.
        raster = null
      }
    }
    const text = buildRecipt(lines)
    const merged = new Uint8Array((raster ? raster.length : 0) + text.length)
    if (raster) merged.set(raster, 0)
    merged.set(text, raster ? raster.length : 0)

    await qzPrintRaw(target, merged)
    printerState.connected = true
    printerState.reason = ''
    printerState.info = targetLabel(target)
    return true
  } catch (err) {
    printerState.connected = false
    const msg = String(err?.message || err || '')
    printerState.reason = /printer|not found|invalid/i.test(msg)
      ? `The printer “${targetLabel(target)}” was not found. Check it is switched on, then re-select it in Printer Settings.`
      : connectReason(err)
    return false
  }
}

/** Is a printer available right now? (Only true once a print has been verified.) */
export function printerReady() {
  return printerState.connected
}

/**
 * Builds the ESC/POS text for a small, narrow report (adjustments, transfers,
 * movements, goods returns) so it fits a 58/80mm thermal roll like receipts.
 *
 * The report is centred under a brand header, then printed as a compact
 * two-column table: left label, right value, with a solid divider line
 * underneath every row. It is NOT meant for the wide multi-column reports
 * (stock ledger summary, closing stock) — those still print to A4 via the
 * browser dialog.
 *
 * @param {object} opts  Options:
 *   - hotel {string}  Hotel name for the header.
 *   - title {string}  Report title, e.g. "Stock Transfer".
 *   - period {string} The date range / as-of line.
 *   - rows {Array<{label:string, right?:string|number, bold?:boolean}>}
 *   - width {number}  Thermal line width in characters (48 for 80mm).
 * @returns {Array<Array<string|boolean|number>>} Lines ready for printToPrinter.
 */
export function buildReportLines({ hotel, title, period, rows, printedBy, width = 48 }) {
  const lines = []
  const dash = '-'.repeat(width)
  const gap = ' '.repeat(width)

  lines.push([hotel || 'MRK Hotels', false, 2])
  lines.push([title, true, 1])
  if (period) lines.push([period, false, 1])
  lines.push([dash, false, 0])

  for (const row of rows || []) {
    if (!row) continue
    if (row.separator) {
      lines.push([dash, false, 0])
      continue
    }
    if (row.header) {
      lines.push([(row.header + ' ' + '.'.repeat(width - row.header.length - 1)), true, 0])
      continue
    }
    const label = String(row.label ?? '').slice(0, width)
    const right = row.right === undefined || row.right === null || row.right === '' ? '' : String(row.right)
    lines.push([itemRow(label, right, width), row.bold, 0])
    lines.push(['-'.repeat(width), false, 0])
  }

  lines.push([gap, false, 0])
  if (printedBy) lines.push([printedBy, false, 0])
  return lines
}
