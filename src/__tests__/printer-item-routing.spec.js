/**
 * Manager review item 4: the printer settings chosen when an item is registered
 * have to actually change what comes out of the printer.
 *
 * The settings are stored on the menu item and travel with each order line. This
 * covers the three decisions they drive: a line left off the guest's bill, a
 * line that never reaches a kitchen ticket, and a drink routed to the bar pass
 * instead of the kitchen's.
 */
import { describe, expect, it } from 'vitest'
import {
  hasPrintableLines,
  kitchenTicketLines,
  linesForPrintJob,
  orderReceiptLines,
} from '@/utils/receipts'

const order = {
  order_number: 'ORD-MGH-2026-00201',
  table_number: '4',
  waiter_name: 'ZAWADI',
  total_amount: 9000,
  payment_status: 'unpaid',
  items: [
    {
      quantity: 1,
      item_name: 'Mchemsho',
      subtotal: 4000,
      department: 'restaurant',
      print_on_receipt: true,
      print_on_order: true,
      printer_station: 'kitchen',
    },
    {
      quantity: 2,
      item_name: 'Kilimanjaro',
      subtotal: 5000,
      department: 'bar',
      print_on_receipt: true,
      print_on_order: true,
      printer_station: 'bar',
    },
  ],
}

const text = (lines) => lines.map((row) => String(row[0])).join('\n')

describe('per-item printer settings on the order ticket', () => {
  it('sends the kitchen ticket only the food and the bar ticket only the drinks', () => {
    const kitchen = text(kitchenTicketLines(order, { station: 'kitchen' }))
    const bar = text(kitchenTicketLines(order, { station: 'bar' }))

    expect(kitchen).toContain('Mchemsho')
    expect(kitchen).not.toContain('Kilimanjaro')
    expect(bar).toContain('Kilimanjaro')
    expect(bar).not.toContain('Mchemsho')
  })

  it('titles the drink ticket for the bar rather than the kitchen', () => {
    expect(text(kitchenTicketLines(order, { station: 'bar' }))).toContain('BAR ORDER TICKET')
    expect(text(kitchenTicketLines(order, { station: 'kitchen' }))).toContain('KITCHEN ORDER TICKET')
  })

  it('a reprint of a bar ticket is watermarked under the BAR title', () => {
    const bar = kitchenTicketLines(order, { station: 'bar', reprinted: true, closed: true })
    const plain = text(bar.filter((row) => !row[1] || String(row[0]).includes('TICKET')))
    expect(bar.some((row) => String(row[0]).includes('CLOSED ORDER'))).toBe(true)

    // The watermark must sit directly under the ticket's own title, not the
    // kitchen's, or the bar pass cannot tell what it is holding.
    const titleIdx = bar.findIndex((row) => String(row[0]).trim() === 'BAR ORDER TICKET')
    expect(String(bar[titleIdx + 1][0])).toContain('CLOSED ORDER')
    expect(plain).toContain('BAR ORDER TICKET')
  })

  it('a line switched off print-on-order never reaches a ticket', () => {
    const withMute = {
      ...order,
      items: [
        order.items[0],
        { ...order.items[1], item_name: 'Juice', print_on_order: false },
      ],
    }
    expect(text(kitchenTicketLines(withMute, { station: 'bar' }))).not.toContain('Juice')
    // ...but it is still billed, because nothing was cooked or poured.
    expect(text(orderReceiptLines(withMute))).toContain('Juice')
  })

  it('a line switched off print-on-receipt is left off the bill', () => {
    const withMute = {
      ...order,
      items: [
        order.items[0],
        { ...order.items[1], item_name: 'House Spirits', print_on_receipt: false },
      ],
    }
    expect(text(orderReceiptLines(withMute))).not.toContain('House Spirits')
    // It still reaches the bar: the drink was still poured.
    expect(text(kitchenTicketLines(withMute, { station: 'bar' }))).toContain('House Spirits')
  })

  it('a line with no settings at all prints everywhere on the kitchen pass', () => {
    // An order rung in before the settings existed, or a dish whose menu record
    // has since been deleted, must not silently vanish from the paper.
    const legacy = { ...order, items: [{ quantity: 1, item_name: 'Legacy Stew', subtotal: 2000 }] }
    expect(text(kitchenTicketLines(legacy, { station: 'kitchen' }))).toContain('Legacy Stew')
    expect(text(orderReceiptLines(legacy))).toContain('Legacy Stew')
    expect(text(kitchenTicketLines(legacy, { station: 'bar' }))).not.toContain('Legacy Stew')
  })

  it('a pass with nothing on it reports no printable lines, so no blank slip', () => {
    const foodOnly = { ...order, items: [order.items[0]] }
    expect(hasPrintableLines(foodOnly, 'kot', { station: 'kitchen' })).toBe(true)
    expect(hasPrintableLines(foodOnly, 'kot', { station: 'bar' })).toBe(false)

    const allMuted = {
      ...order,
      items: order.items.map((item) => ({ ...item, print_on_order: false })),
    }
    expect(hasPrintableLines(allMuted, 'kot', { station: 'kitchen' })).toBe(false)
    expect(hasPrintableLines(allMuted, 'kot', { station: 'bar' })).toBe(false)
  })

  it('no station filter keeps every orderable line on one ticket', () => {
    expect(linesForPrintJob(order, 'kot')).toHaveLength(2)
    expect(linesForPrintJob(order, 'receipt')).toHaveLength(2)
  })

  it('the bill still adds up when a line is left off the itemised list', () => {
    const withMute = {
      ...order,
      items: [order.items[0], { ...order.items[1], print_on_receipt: false }],
    }
    const lines = orderReceiptLines(withMute)
    expect(text(lines)).not.toContain('Kilimanjaro')
    // The total is the order total, not a sum of the printed lines, so the
    // guest is never under-charged for something that did not print.
    expect(text(lines)).toContain('9,000.00')
  })
})
