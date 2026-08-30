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
 * - connected   -> a serial port is open and writable.
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
 * @param {Uint8Array} out  The accumulating buffer.
 * @param {string} text     The line to print.
 * @param {boolean} bold    Bold line flag.
 * @param {number} [size]   0 = normal, 1 = double height, 2 = double width.
 */
function pushLine(out, text = '', bold = false, size = 0) {
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
  const out = [ESC.init, ESC.init, 0x40] // ESC @ — reset the printer.

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
  const amount = right.toString().padStart(10, ' ')
  return (item + ' '.repeat(Math.max(0, width - 10 - item.length)) + amount).slice(0, width)
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
 * @param {SerialPort|null} [chosen]  A specific port, or null to show the picker.
 * @returns {Promise<boolean>} True when a printer is now connected.
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
  printerState.connected = true
  printerState.reason = ''
  printerState.info = info.usbProductId
    ? `USB printer (vendor ${info.usbVendorId}, product ${info.usbProductId})`
    : 'Serial printer connected.'
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
 * Writes a set of receipt lines to the connected printer.
 *
 * @param {Array<Array<string|boolean>>} lines  [text, bold?] rows.
 * @returns {Promise<boolean>} True when the job was sent to the printer.
 */
export async function printToPrinter(lines) {
  if (!port || !port.writable) return false
  try {
    const writer = port.writable.getWriter()
    await writer.write(buildRecipt(lines))
    writer.releaseLock()
    return true
  } catch {
    printerState.reason = 'The printer is not responding. Check the cable and reconnect it.'
    return false
  }
}

/** Is a printer available right now? */
export function printerReady() {
  return printerState.connected && Boolean(port?.writable)
}