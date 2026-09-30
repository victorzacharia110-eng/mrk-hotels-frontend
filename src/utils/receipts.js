/**
 * Receipt formatters — turn an F&B order into the ESC/POS text lines the
 * thermal printer receives (also reused for the browser-print fallback layout).
 *
 * Every receipt is a list of `[text, bold]` rows; the printer util and the
 * on-screen print area both derive their output from the same source rows so
 * the till paper and the dialog preview never drift apart.
 */

import { itemRow, padLine } from '@/utils/printer'

const WIDTH = 42

function money(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}

function divider(char = '-') {
  return char.repeat(WIDTH)
}

// Friendly names for the payment method codes the POS uses, matching the
// on-screen payment pickers so the till paper says the same thing the cashier
// saw when the money was taken.
const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank: 'Bank',
  selcom: 'Selcom',
  card: 'Card',
  clickpesa: 'ClickPesa',
}

// Brand names for the mobile-money wallets and banks that hold the money.
const PAYMENT_PROVIDER_LABELS = {
  mpesa: 'Mpesa',
  airtel_money: 'Airtel Money',
  mixx_by_yas: 'Mixx By Yas',
  halopesa: 'HaloPesa',
  crdb: 'CRDB',
  nmb: 'NMB',
  nbc: 'NBC',
  other: 'Other',
}

/** Titlecases an otherwise-unknown code (e.g. `deferred_card` → "Deferred Card"). */
function friendlyLabel(code, map = {}) {
  const value = String(code ?? '')
  return map[value] || value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Centres one line of text inside the printer's width without ever exceeding it.
 *
 * A 42-column ESC/POS printer wraps a 43rd character onto a second line, which
 * on a centred header looks like a printer fault. A long hotel name or address
 * is therefore wrapped on word boundaries into several centred rows rather than
 * allowed to spill. A double-width row only has half the columns, so `size 2`
 * halves the budget too.
 *
 * @param {string} text  The line of text.
 * @param {number} [size]  Row size; 2 means double-width.
 * @returns {string[]} The rows, each already padded to the width.
 */
function centeredRows(text, size = 1) {
  const limit = size === 2 ? Math.floor(WIDTH / 2) : WIDTH
  const value = String(text ?? '').trim()
  if (!value) return []
  if (value.length <= limit) return [padLine(value, 'center', limit)]

  const rows = []
  let current = ''
  for (const word of value.split(/\s+/).filter(Boolean)) {
    // A single word longer than the paper (a long TIN, a URL) cannot be broken
    // on a space, so it is chunked rather than dropped.
    const pieces = word.length <= limit ? [word] : word.match(new RegExp(`.{1,${limit}}`, 'g')) || []
    for (const piece of pieces) {
      if (current && current.length + 1 + piece.length > limit) {
        rows.push(current)
        current = piece
      } else {
        current = current ? `${current} ${piece}` : piece
      }
    }
  }
  if (current) rows.push(current)
  return rows.map((r) => padLine(r, 'center', limit))
}

/**
 * The hotel letterhead rows that sit at the top of a printed document.
 *
 * Every field the manager saved in Hotel Settings gets a line, because the
 * letterhead is the point: a guest checks the TIN/VRN off a receipt, and the
 * kitchen needs the phone to reach the floor. Fields the hotel has not filled
 * in are dropped rather than printed blank, and a hotel with no saved details
 * still gets a brand name so the paper is never headerless.
 *
 * @param {object} [header]  Hotel details: name, address, city, phone, email, tin, vrn.
 * @param {string} [fallbackName]  Brand name used when the header carries no name.
 * @returns {Array<Array<string|boolean|number>>} The letterhead rows.
 */
export function letterheadLines(header = {}, fallbackName = 'MRK HOTELS') {
  const name = header.name || fallbackName || ''
  const where = [header.address, header.city].filter(Boolean).join(', ')
  const contact = [header.phone, header.email].filter(Boolean).join('  ')
  const taxId = (label, value) => (value ? `${label}: ${value}` : '')
  const taxIds = [taxId('TIN', header.tin), taxId('VRN', header.vrn)].filter(Boolean).join('  ')

  const rows = []
  // The hotel name is the only double-width row, matching how the brand line
  // has always been printed; the details below it stay single-width so a long
  // address gets the full 42 columns.
  for (const row of centeredRows(name, 2)) rows.push([row, true, 2])
  for (const text of [where, contact, taxIds]) {
    for (const row of centeredRows(text, 1)) rows.push([row])
  }
  return rows
}

/**
 * Lines for a guest receipt — a compact bill that fits small receipt paper.
 * Rows are [text, bold?, size?] where size 2 = double-width double-height.
 *
 * Layout mirrors the reference till receipt: letterhead, Receipt, Table /
 * Guest / Waiter, dated, then a Qty·Item·Amount column, Bill Amount / Total
 * Tax / Total Discount / Total / Paid / Due, Thank you and Prepared By.
 *
 * @param {object} order  Order (must carry items) with optional `_payment`.
 * @param {object} [opts]  Options: `letterhead` (saved hotel details) and
 *   `hotel` (brand-name fallback) — defaults to MRK HOTELS.
 * @returns {Array<Array<string|boolean|number>>} The receipt rows.
 *
 * Note that a line switched off "print on receipt" is dropped from the itemised
 * list but its money still counts towards the totals below, so the bill adds up
 * to what the guest was charged.
 */
export function orderReceiptLines(order, opts = {}) {
  const total = Number(order.total_amount ?? 0)
  const paid = Number(order._payment?.amount ?? (order.payment_status === 'paid' ? total : 0))
  const due = Math.max(0, total - paid)

  const lines = [
    ...letterheadLines(opts.letterhead, opts.hotel),
    [padLine('Receipt', 'center', 21), false, 2],
    [String(order.order_number || ''), false, 2],
    [''],
    [`Table: ${order.table_number || order.room_number || '-'}`],
    [`Guest: ${order.guest_name || '-'}`],
    [`Date: ${new Date().toLocaleString()}`],
    [`Waiter: ${order.waiter_name || '-'}`],
    [''],
    [itemRow('Qty  Item', 'Amount')],
    [divider()],
  ]

  for (const item of linesForPrintJob(order, 'receipt')) {
    const qty = item.quantity ?? 1
    lines.push([itemRow(`${qty} x ${item.item_name}`, money(item.subtotal ?? 0))])
    // Multi-quantity lines also show the unit price so a guest can verify the
    // math (2 x 1,000 → 2,000) instead of trusting the line total blindly.
    if (qty > 1 && item.unit_price != null) {
      lines.push([`   @ ${money(item.unit_price)} each`])
    }
  }

  lines.push([divider()])
  lines.push([itemRow('Bill Amount:', `${money(total)} TSh`)])
  lines.push([itemRow('Total Tax:', `${money(order.tax_amount ?? 0)} TSh`)])
  lines.push([itemRow('Total Discount:', `${money(order.discount_amount ?? 0)} TSh`)])
  lines.push([itemRow('Total:', `${money(total)} TSh`), true])
  lines.push([itemRow('Paid:', `${money(paid)} TSh`)])
  lines.push([itemRow('Due:', `${money(due)} TSh`)])

  // Payment service details: how the money was collected, by which provider,
  // the till reference the hotel can trace it with, and who took it. Only
  // shown when the order was actually settled (carries a `_payment`).
  const payment = order._payment
  if (payment) {
    lines.push([''])
    lines.push([padLine('Payment', 'center')])
    lines.push([itemRow('Method:', friendlyLabel(payment.method, PAYMENT_METHOD_LABELS))])
    if (payment.provider) lines.push([itemRow('Provider:', friendlyLabel(payment.provider, PAYMENT_PROVIDER_LABELS))])
    if (payment.payment_id) lines.push([itemRow('Receipt No:', String(payment.payment_id))])
    if (payment.transaction_reference) lines.push([itemRow('Reference:', String(payment.transaction_reference))])
    if (payment.status) lines.push([itemRow('Status:', friendlyLabel(payment.status))])
    lines.push([itemRow('Paid At:', new Date(payment.paid_at || Date.now()).toLocaleString())])
    lines.push([itemRow('Collected By:', String(payment.collected_by || '-'))])
  }

  lines.push([''])
  lines.push([padLine('Thank you', 'center')])
  lines.push([`Prepared By: ${order._payment?.collected_by || order.waiter_name || ''}`])
  return lines
}

/**
 * Which of an order's lines belong on a given print job.
 *
 * Manager review item 4: every menu item carries two switches and a printer
 * choice, set when the item is registered.
 *   - `print_on_receipt` false  -> the line is left off the guest's bill (an
 *     item sold for the room account, or a complimentary line the cashier
 *     settles verbally). The money still counts towards the total.
 *   - `print_on_order` false   -> the line never reaches a kitchen or bar
 *     ticket, because nothing has to be cooked or poured.
 *   - `printer_station`        -> which pass a printable line is sent to.
 *
 * A line with no such fields is one rung in before these settings existed, or a
 * dish whose menu record has since been deleted. Those are treated as "print
 * everywhere, kitchen pass" so an old ticket can never quietly lose a line the
 * guest actually ordered.
 *
 * @param {object} order  Order (must carry items).
 * @param {string} kind   'receipt' | 'kot'.
 * @param {object} [opts]  Options: `station` limits a KOT to 'kitchen'|'bar'.
 * @returns {Array<object>} The lines to print.
 */
export function linesForPrintJob(order, kind, opts = {}) {
  const items = order?.items || []
  if (kind === 'receipt') {
    return items.filter((item) => item.print_on_receipt !== false)
  }
  const printable = items.filter((item) => item.print_on_order !== false)
  if (!opts.station) return printable
  return printable.filter((item) => (item.printer_station || 'kitchen') === opts.station)
}

/**
 * True when an order has at least one line for a print job, so the caller can
 * skip opening a printer for a document that would be blank.
 *
 * @param {object} order  Order (must carry items).
 * @param {string} kind   'receipt' | 'kot'.
 * @param {object} [opts]  Passed to linesForPrintJob.
 * @returns {boolean} Whether anything would print.
 */
export function hasPrintableLines(order, kind, opts = {}) {
  return linesForPrintJob(order, kind, opts).length > 0
}

/**
 * Lines for a kitchen order ticket (no totals).
 *
 * The hotel name and phone ride along at the top: tickets from several hotels
 * can share a kitchen pass, and when an item is wrong the kitchen needs to know
 * which floor to call. Tax IDs are left off — the kitchen has no use for them.
 *
 * @param {object} order  Order (must carry items).
 * @param {object} [opts]  Options: `letterhead` (saved hotel details), `hotel`
 *   (brand-name fallback), `reprinted`, `closed`, `station`.
 * @returns {Array<Array<string|boolean|number>>} [text, bold?, size?] rows.
 */
export function kitchenTicketLines(order, opts = {}) {
  const header = opts.letterhead || {}
  const lines = []
  for (const row of centeredRows(header.name || opts.hotel || 'MRK HOTELS', 2)) lines.push([row, true, 2])
  for (const row of centeredRows(header.phone ? `Tel: ${header.phone}` : '', 1)) lines.push([row])
  lines.push(
    [opts.station === 'bar' ? 'BAR ORDER TICKET' : 'KITCHEN ORDER TICKET', true, 2],
    [String(order.order_number || ''), false, 2],
    [`Table: ${order.table_number || order.room_number || '-'}   Waiter: ${order.waiter_name || '-'}`],
    [`Type: ${order.order_type || 'dine_in'}   Covers: ${order.covers ?? '-'}`],
    [''],
  )

  // A reprint must never be mistaken for the original ticket: stamp the
  // watermark across the top of the paper, directly under the ticket title and
  // above the order number, so even a quick scan shows this KOT already went to
  // the kitchen before. Reprinting a CLOSED order additionally says so — the
  // kitchen must not treat a closed ticket as live work. The position is
  // computed rather than fixed because the letterhead length varies by hotel.
  if (opts.reprinted) {
    // These marks are printed double-width, which leaves 21 columns on 42-column
    // paper, so the wording is kept short enough not to wrap.
    const mark = opts.closed ? '* CLOSED ORDER *' : '* REPRINTED *'
    const title = opts.station === 'bar' ? 'BAR ORDER TICKET' : 'KITCHEN ORDER TICKET'
    const titleIdx = lines.findIndex((l) => String(l[0]).trim() === title)
    lines.splice(titleIdx + 1, 0, [padLine(mark, 'center', Math.floor(WIDTH / 2)), true, 2])
  }

  for (const item of linesForPrintJob(order, 'kot', opts)) {
    const qty = item.quantity ?? 1
    const note = item.notes ? `  (${item.notes})` : ''
    lines.push([`${qty} x ${item.item_name}${note}`])
    if (item.accompaniment) lines.push([`   + ${item.accompaniment}`])
  }

  lines.push([''])
  lines.push([padLine(new Date().toLocaleTimeString(), 'center')])
  return lines
}

/** Lines used for the 'Test print' button on the printer settings page. */
export function testPrintLines() {
  const lines = [
    ['MRK HOTELS', true, 2],
    [padLine('Printer test', 'center', 21), false, 2],
    [''],
    [itemRow('Line item A', 'TZS 5,000')],
    [itemRow('Line item B', 'TZS 2,500')],
    [divider()],
    [itemRow('TOTAL', 'TZS 7,500', 21), true, 2],
    [''],
    [padLine('Connected: connectPrinter OK', 'center')],
    [padLine(new Date().toLocaleString(), 'center')],
  ]
  return lines
}

/**
 * The on-screen (browser print) preview for a receipt or kitchen ticket,
 * rendered from the same ESC/POS lines so it matches the paper.
 *
 * @param {object} order  Order (must carry items), optional `_payment`.
 * @param {string} kind   'receipt' | 'kot'.
 * @param {object} [opts]  Passed through to the formatter (e.g. { hotel }).
 * @returns {Array<Array<string|boolean>>} The rows.
 */
export function displayLines(order, kind, opts = {}) {
  return kind === 'kot' ? kitchenTicketLines(order, opts) : orderReceiptLines(order, opts)
}