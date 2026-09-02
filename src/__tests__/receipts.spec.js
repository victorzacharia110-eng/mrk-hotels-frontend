/**
 * The POS prints to a 58mm (42-column) roll. Every line a formatter emits
 * must fit that width — a size-2 (double-width) row is printed at double
 * width, so a full 42-char string would overflow and wrap the paper long.
 */
import { describe, expect, it } from 'vitest'
import { orderReceiptLines, kitchenTicketLines, testPrintLines } from '@/utils/receipts'

const order = {
  order_number: 'ORD-MGH-2026-00144',
  table_number: '2',
  guest_name: 'John Doe',
  waiter_name: 'ZAWADI',
  total_amount: 2000,
  payment_status: 'unpaid',
  items: [{ quantity: 1, item_name: 'Soda (Coca/Fanta)', subtotal: 2000 }],
}

describe('receipt line widths', () => {
  it('all raw lines are at most 42 columns (size-2 rows are halved later)', () => {
    const cases = [
      ['receipt', orderReceiptLines(order, { hotel: 'Brand Hotel' })],
      ['kot', kitchenTicketLines(order)],
      ['test', testPrintLines()],
    ]
    for (const [name, lines] of cases) {
      for (const [text, , size] of lines) {
        const raw = String(text)
        const effective = size === 2 ? Math.ceil(raw.length * 2) : raw.length
        expect(effective, `${name} row too wide: "${raw}"`).toBeLessThanOrEqual(42)
      }
    }
  })

  it('receipt shows the reference layout markers', () => {
    const lines = orderReceiptLines(order, { hotel: 'Brand Hotel' })
    expect(lines[0][0]).toBe('Brand Hotel')
    expect(lines[2][0]).toBe('ORD-MGH-2026-00144')
    const text = lines.map((l) => l[0]).join('\n')
    expect(text).toContain('Receipt')
    expect(text).toContain('Qty  Item')
    expect(text).toContain('Bill Amount:')
    expect(text).toContain('Total Tax:')
    expect(text).toContain('Total Discount:')
    expect(text).toContain('Total:')
    expect(text).toContain('Paid:')
    expect(text).toContain('Due:')
    expect(text).toContain('Thank you')
    expect(text).toContain('Prepared By:')
  })
})