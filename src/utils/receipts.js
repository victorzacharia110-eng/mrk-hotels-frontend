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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

function divider(char = '-') {
  return char.repeat(WIDTH)
}

/**
 * Lines for a paid bill (guest receipt).
 *
 * @param {object} order  Order (must carry items) with optional `_payment`.
 * @returns {Array<Array<string|boolean>>} [text, bold?] rows.
 */
export function orderReceiptLines(order) {
  const lines = [
    ['MRK HOTELS', true],
    [padLine(String(order.order_number || ''), 'center')],
    [order.outlet_name || order.department || ''],
    [`Table: ${order.table_number || order.room_number || '-'}   Waiter: ${order.waiter_name || '-'}`],
    [''],
  ]

  for (const item of order.items || []) {
    const qty = item.quantity ?? 1
    lines.push([itemRow(`${qty} x ${item.item_name}`, money(item.subtotal ?? 0))])
  }

  lines.push([divider()])
  lines.push([itemRow('TOTAL', money(order.total_amount ?? 0))], [''], [''])

  const payment = order._payment
  if (payment) {
    const method = payment.method || 'cash'
    const provider = payment.provider ? ` (${payment.provider})` : ''
    lines.push([`PAID: ${method}${provider}`, false])
    if (payment.transaction_reference) {
      lines.push([`Ref: ${payment.transaction_reference}`])
    }
    lines.push([`By: ${payment.collected_by || ''}`])
  }

  lines.push([''])
  lines.push([padLine(new Date().toLocaleString(), 'center')])
  return lines
}

/**
 * Lines for a kitchen order ticket (no totals).
 *
 * @param {object} order  Order (must carry items).
 * @returns {Array<Array<string|boolean>>} [text, bold?] rows.
 */
export function kitchenTicketLines(order) {
  const lines = [
    ['KITCHEN ORDER TICKET', true],
    [String(order.order_number || '')],
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
    ['MRK HOTELS', true],
    [padLine('Printer test', 'center')],
    [''],
    [itemRow('Line item A', 'TZS 5,000')],
    [itemRow('Line item B', 'TZS 2,500')],
    [divider()],
    [itemRow('TOTAL', 'TZS 7,500'), true],
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
 * @returns {Array<Array<string|boolean>>} The rows.
 */
export function displayLines(order, kind) {
  return kind === 'kot' ? kitchenTicketLines(order) : orderReceiptLines(order)
}