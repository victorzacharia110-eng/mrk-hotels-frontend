/**
 * Printer service — direct thermal printing over the Web Serial API.
 *
 * The POS prints its receipts and kitchen tickets to an ESC/POS thermal
 * printer plugged into the till (USB/serial). Browsers can open that port
 * through the Web Serial API (Chrome/Edge on desktop, over HTTPS) without any
 * server or driver: the hotel picks the printer once per device and the app
 * writes the ESC/POS bytes straight to it.
 *
 * When the browser does not support Serial (or no printer is connected), every
 * caller falls back to the browser's own print dialog, so nothing breaks.
 */

import { reactive } from 'vue'

/**
 * Shared connection state so any page sees whether the till printer is on.
 * - connected   -> a serial port is open AND a print has actually been sent
 *                  out of it. Opening a port alone never claims the printer
 *                  works, because browsers can also open virtual "COM" ports
 *                  that are not real thermal printers (the write fails or
 *                  hangs until the timeout, which is far more useful feedback
 *                  than falsely showing "connected").
 * - info        -> human-readable port label shown in the UI.
 * - reason      -> why printing is unavailable (empty when it can).
 */
export const printerState = reactive({ connected: false, info: '', reason: '' })

/** localStorage key remembering the last granted printer. */
const PORT_KEY = 'mrk_printer_port'

/** Does this browser expose the Web Serial API? (Chrome/Edge desktop, HTTPS.) */
export function printerSupported() {
  return 'serial' in navigator
}

/**
 * ESC/POS command bytes used to build a 58/80mm receipt.
 */
const ESC = { init: 0x1b, feed: 0x64 }

/**
 * Wraps a text line into the byte stream for the printer.
 *
 * Double-width (size 2) text takes two columns per character, so a line that
 * was padded to the full 42-char width would overflow the roll and wrap onto
 * a second line (paper runs long). Cap those lines at half the width — the
 * exact number of columns a double-size 42-wide line can hold.
 *
 * @param {Uint8Array} out  The accumulating buffer.
 * @param {string} text     The line to print.
 * @param {boolean} bold    Bold line flag.
 * @param {number} [size]   0 = normal, 1 = double height, 2 = double width (+height).
 */
const DOUBLE_WIDTH_CHARS = Math.floor(42 / 2) // 21 columns = a full 42-char line at double size.
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
  out.push(0x1b, 0x4d, 0x01) // ESC M 1 — narrow 9-dot font so 42-char lines fit a 58mm roll.

  for (const [text, bold, size] of lines) {
    pushLine(out, text, bold, size || 0)
  }

  out.push(ESC.init, ESC.feed, 3) // FF 3 — a few line feeds before the cut.
  out.push(0x1d, 0x56, 0x00) // GS V 0 — full cut.

  return Uint8Array.from(out)
}

/**
 * Turns a receipt width of 42 chars into the column layout used for lines.
 * Centro-places text; `justify` pads with spaces; plain lines are kept.
 *
 * @param {string} text  The raw line.
 * @param {string} [mode]  'center' | 'justify' | 'left'.
 * @param {number} [width]  Characters per line (58mm => 42).
 * @returns {string} The padded line.
 */
export function padLine(text, mode = 'left', width = 42) {
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
export function itemRow(item, right = '', width = 42) {
  if (!right) return padLine(item, 'left', width)
  const amount = right.toString()
  const joined = item + ' '.repeat(Math.max(0, width - item.length - amount.length)) + amount
  return joined.slice(0, width)
}

/**
 * The running serial port, kept as a module singleton so the receipt print
 * calls from any page reuse the same connection.
 */
let port = null

function rememberPort() {
  try {
    localStorage.setItem(PORT_KEY, JSON.stringify(port.getInfo()))
  } catch {
    /* storage full / private mode — the link just won't persist. */
  }
}

function forgetPort() {
  try {
    localStorage.removeItem(PORT_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Opens a saved serial port if the browser re-grants it (called on page
 * load so the till reconnects after a refresh).
 */
export async function restorePrinter() {
  if (!printerSupported() || port) return
  try {
    const saved = JSON.parse(localStorage.getItem(PORT_KEY) || 'null')
    if (!saved) return
    const ports = await navigator.serial.getPorts()
    const match = ports.find((p) => {
      const info = p.getInfo()
      return info.usbVendorId === saved.usbVendorId && info.usbProductId === saved.usbProductId
    })
    if (match) await openPort(match)
  } catch {
    printerState.reason = 'Restoring the saved printer failed. Reconnect it in Printer Settings.'
  }
}

/**
 * Opens (and remembers) a serial port the user granted via the picker.
 *
 * Opening the port does not prove a printer is there — it just makes the port
 * writable. The machine is only confirmed once a test/receipt print actually
 * goes out (printToPrinter flips `connected` to true).
 *
 * @param {SerialPort|null} [chosen]  A specific port, or null to show the picker.
 * @returns {Promise<boolean>} True when the port is open and ready to test.
 */
export async function connectPrinter(chosen = null) {
  if (!printerSupported()) {
    printerState.reason = 'This browser cannot talk directly to the printer. Use Chrome/Edge on desktop.'
    return false
  }
  try {
    const picked = chosen || (await navigator.serial.requestPort())
    await openPort(picked)
    return true
  } catch (err) {
    if (err?.name !== 'NotFoundError') {
      printerState.reason = err?.message || 'Could not connect to the printer.'
    }
    return false
  }
}

// Best-effort friendly names for common ESC/POS thermal printer vendors.
const VENDOR_NAMES = {
  1046: 'Epson', // 0x0416
  1208: 'Star Micronics', // 0x04B8
  1271: 'HPRT', // 0x04F7
  1659: 'Xprinter', // 0x067B
  8968: 'Gprinter', // 0x2308
  10081: 'Zjiang', // 0x2761
}

function deviceLabel(info) {
  const vendorName = info.usbVendorId ? (VENDOR_NAMES[info.usbVendorId] || `Vendor ${info.usbVendorId}`) : 'Serial'
  const product = info.usbProductId ? ` (product ${info.usbProductId})` : ''
  return `${vendorName}${product}`.trim()
}

async function openPort(serialPort) {
  try {
    await serialPort.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' })
  } catch {
    // Already open is fine; anything else surfaces below.
    if (!serialPort.readable && !serialPort.writable) throw new Error('Printer port could not be opened.')
  }
  port = serialPort
  rememberPort()
  const info = port.getInfo()
  // A port that opens is NOT yet "connected" — the only truthful proof that a
  // printer is there is a write actually going out. Web Serial can open virtual
  // COM ports (e.g. Windows "Communications Port (COMx) - Paired") that are not
  // thermal printers; claiming "connected" for those misleads the till user
  // into thinking a receipt will print. We stay "not connected" until a real
  // write succeeds in printToPrinter().
  printerState.connected = false
  printerState.reason = 'The port is open. Press Test Print to confirm the printer responds.'
  printerState.info = deviceLabel(info)
}

/**
 * Closes the printer port and forgets the saved mapping.
 */
export async function disconnectPrinter() {
  if (!port) return
  try {
    await port.close()
  } catch {
    /* the port may already be closed */
  }
  port = null
  printerState.connected = false
  printerState.info = ''
  forgetPort()
}

/**
 * Scales a logo down to a monochrome raster the thermal printer can draw and
 * returns the ESC/POS "GS v 0" byte block that prints it.
 *
 * Transparent pixels become white; everything dark becomes a printed dot.
 * Widths in dots: 384 for a 58mm roll, 576 for 80mm.
 *
 * @param {string} src  Logo URL. Must be same-origin or CORS-enabled.
 * @param {number} [width]  Target width in printer dots.
 * @returns {Promise<Uint8Array>} The raster command block.
 */
export async function rasterLogoBytes(src, width = 384) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the logo for printing.'))
    img.src = src
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
 * Writes a set of receipt lines (plus an optional raster logo) to the
 * printer.
 *
 * Transport is chosen by opts.transport:
 *  - 'network' -> POST the raw ESC/POS bytes to opts.endpoint, a local bridge
 *                 agent (http://host:port) that forwards them to the physical
 *                 printer. This is how a hosted web app reaches a printer on
 *                 another machine or a remote location (e.g. a USB printer
 *                 shared via Tailscale).
 *  - otherwise -> Web Serial, a USB printer physically attached to THIS
 *                 machine.
 *
 * @param {Array<Array<string|boolean|number>>} lines  [text, bold?, size?] rows.
 * @param {object} [opts]  Options.
 * @param {string} [opts.logo]  Logo URL to raster a store brand on top of the sheet.
 * @param {string} [opts.transport]  'network' or 'serial' (default).
 * @param {string} [opts.endpoint]  Bridge agent base URL for the network transport.
 * @returns {Promise<boolean>} True when the job was sent to the printer.
 */
export async function printToPrinter(lines, opts = {}) {
  try {
    const raster = opts.logo ? await rasterLogoBytes(opts.logo) : null
    const text = buildRecipt(lines)
    const merged = new Uint8Array((raster ? raster.length : 0) + text.length)
    if (raster) merged.set(raster, 0)
    merged.set(text, raster ? raster.length : 0)

    if (opts.transport === 'network' && opts.endpoint) {
      return sendToNetwork(opts.endpoint, merged)
    }

    if (!port || !port.writable) return false

    const writer = port.writable.getWriter()
    // Guard against a non-responsive printer hanging the write forever (the
    // "saving..." that never stops). If nothing is sent in 8s we give up.
    let timer = null
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timeout waiting for the printer.')), 8000)
    })
    try {
      await Promise.race([writer.write(merged), timeout])
    } finally {
      clearTimeout(timer)
      writer.releaseLock()
    }
    // A write that reaches the wire is the proof the printer is really there
    // and talking. Only now do we mark the machine as connected.
    printerState.connected = true
    printerState.reason = ''
    return true
  } catch {
    printerState.connected = false
    printerState.reason =
      'The port is open but the printer is not responding. This usually means the chosen port is not a real thermal printer (e.g. a virtual COM port) or the cable is loose. Pick the printer, not a "COM" port, in the serial chooser.'
    return false
  }
}

/**
 * Posts a raw ESC/POS byte stream to a local bridge agent.
 *
 * The agent runs on the machine that owns the printer and forwards the bytes
 * into it (USB/serial/network). This lets a hosted web app print to a till
 * printer that is NOT attached to the browser's own machine — including a
 * remote till reached over a tunnel/VPN (e.g. Tailscale).
 *
 * @param {string} endpoint  Base URL like http://127.0.0.1:9720 or http://100.x.y.z:9720.
 * @param {Uint8Array} bytes  The ESC/POS byte stream to print.
 * @returns {Promise<boolean>} True when the agent accepted the job.
 */
async function sendToNetwork(endpoint, bytes) {
  const url = `${endpoint.replace(/\/+$/, '')}/print`
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout waiting for the print agent.')), 8000)
  })
  try {
    const resp = await Promise.race([
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes }),
      timeout,
    ])
    if (!resp.ok) throw new Error(`Print agent replied ${resp.status}`)
    printerState.connected = true
    printerState.reason = ''
    return true
  } catch (err) {
    printerState.connected = false
    printerState.reason = `Could not reach the print agent at ${endpoint}. Make sure it is running on the printer machine and reachable from this device (${err?.message || 'network error'}).`
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Is a printer available right now? (Only true once a print has been verified.) */
export function printerReady() {
  return printerState.connected && Boolean(port?.writable)
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
 *   - width {number}  Thermal line width in characters (42 for 58mm).
 * @returns {Array<Array<string|boolean|number>>} Lines ready for printToPrinter.
 */
export function buildReportLines({ hotel, title, period, rows, printedBy, width = 42 }) {
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
