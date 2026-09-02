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

/**
 * Lines for a guest receipt — a compact bill that fits small receipt paper.
 * Rows are [text, bold?, size?] where size 2 = double-width double-height.
 *
 * Layout mirrors the reference till receipt: brand header, Receipt, Table /
 * Guest / Waiter, dated, then a Qty·Item·Amount column, Bill Amount / Total
 * Tax / Total Discount / Total / Paid / Due, Thank you and Prepared By.
 *
 * @param {object} order  Order (must carry items) with optional `_payment`.
 * @param {object} [opts]  Options: `hotel` (brand name) — defaults to MRK HOTELS.
 * @returns {Array<Array<string|boolean|number>>} The receipt rows.
 */
export function orderReceiptLines(order, opts = {}) {
  const total = Number(order.total_amount ?? 0)
  const paid = Number(order._payment?.amount ?? (order.payment_status === 'paid' ? total : 0))
  const due = Math.max(0, total - paid)

  const lines = [
    [opts.hotel || 'MRK HOTELS', true, 2],
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

  for (const item of order.items || []) {
    const qty = item.quantity ?? 1
    lines.push([itemRow(`${qty} x ${item.item_name}`, money(item.subtotal ?? 0))])
  }

  lines.push([divider()])
  lines.push([itemRow('Bill Amount:', `${money(total)} TSh`)])
  lines.push([itemRow('Total Tax:', `${money(order.tax_amount ?? 0)} TSh`)])
  lines.push([itemRow('Total Discount:', `${money(order.discount_amount ?? 0)} TSh`)])
  lines.push([itemRow('Total:', `${money(total)} TSh`), true])
  lines.push([itemRow('Paid:', `${money(paid)} TSh`)])
  lines.push([itemRow('Due:', `${money(due)} TSh`)])
  lines.push([''])
  lines.push([padLine('Thank you', 'center')])
  lines.push([`Prepared By: ${order._payment?.collected_by || order.waiter_name || ''}`])
  return lines
}

/**
 * Lines for a kitchen order ticket (no totals).
 *
 * @param {object} order  Order (must carry items).
 * @returns {Array<Array<string|boolean|number>>} [text, bold?, size?] rows.
 */
export function kitchenTicketLines(order) {
  const lines = [
    ['KITCHEN ORDER TICKET', true, 2],
    [String(order.order_number || ''), false, 2],
    [`Table: ${order.table_number || order.room_number || '-'}   Waiter: ${order.waiter_name || '-'}`],
    [`Type: ${order.order_type || 'dine_in'}   Covers: ${order.covers ?? '-'}`],
    [''],
  ]

  for (const item of order.items || []) {
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