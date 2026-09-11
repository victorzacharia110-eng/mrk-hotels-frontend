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
    const paidOrder = {
      ...order,
      payment_status: 'paid',
      items: [{ quantity: 2, item_name: 'Soda (Coca/Fanta)', unit_price: 1000, subtotal: 2000 }],
      _payment: {
        payment_id: 'PAY-MGH-2026-00090',
        amount: 2000,
        method: 'mobile_money',
        provider: 'mpesa',
        status: 'completed',
        transaction_reference: 'GJD7K2QX',
        collected_by: 'JANE',
        paid_at: '2026-09-11T12:00:00.000Z',
      },
    }
    const cases = [
      ['receipt', orderReceiptLines(order, { hotel: 'Brand Hotel' })],
      ['receipt-paid', orderReceiptLines(paidOrder, { hotel: 'Brand Hotel' })],
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

  it('receipt lists every detail of the settlement payment', () => {
    const lines = orderReceiptLines(
      {
        ...order,
        payment_status: 'paid',
        _payment: {
          payment_id: 'PAY-MGH-2026-00090',
          amount: 2000,
          method: 'mobile_money',
          provider: 'mpesa',
          status: 'completed',
          transaction_reference: 'GJD7K2QX',
          collected_by: 'JANE',
          paid_at: '2026-09-11T12:00:00.000Z',
        },
      },
      { hotel: 'Brand Hotel' },
    )
    const text = lines.map((l) => l[0]).join('\n')
    expect(text).toContain('Payment')
    expect(text).toContain('Method:')
    expect(text).toContain('Mobile Money')
    expect(text).toContain('Provider:')
    expect(text).toContain('Mpesa')
    expect(text).toContain('Receipt No:')
    expect(text).toContain('PAY-MGH-2026-00090')
    expect(text).toContain('Reference:')
    expect(text).toContain('GJD7K2QX')
    expect(text).toContain('Status:')
    expect(text).toContain('Completed')
    expect(text).toContain('Collected By:')
    expect(text).toContain('JANE')
    expect(text).toContain('Paid At:')
  })

  it('receipt breaks multi-quantity lines into unit price x qty', () => {
    const lines = orderReceiptLines(
      {
        ...order,
        items: [{ quantity: 2, item_name: 'Soda (Coca/Fanta)', unit_price: 1000, subtotal: 2000 }],
      },
      { hotel: 'Brand Hotel' },
    )
    const text = lines.map((l) => l[0]).join('\n')
    expect(text).toContain('2 x Soda (Coca/Fanta)')
    expect(text).toContain('each')
  })
})