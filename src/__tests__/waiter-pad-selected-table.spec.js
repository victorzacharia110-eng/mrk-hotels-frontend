import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the waiter pad's order lines after the PDF review.
 *
 * The selected table is shown once in the header, not repeated on every line.
 * The lines grid is Qty / Item / Price / Amount / remove. Categories and item
 * search stay hidden until a table is chosen, and sending still refuses a
 * table-less ticket.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))
const styles = pad.slice(pad.indexOf('<style'))

const linesTable = pad.slice(pad.indexOf('<table class="lines-table">'), pad.indexOf('</table>'))
const head = linesTable.slice(linesTable.indexOf('<thead>'), linesTable.indexOf('</thead>'))

const countOf = (re) => (linesTable.match(re) || []).length

describe('waiter pad: order lines', () => {
  it('does not repeat the table on every line', () => {
    expect(head).not.toMatch(/col-table/)
    expect(linesTable).not.toMatch(/<td class="col-table">/)
    expect(linesTable).not.toMatch(/\{\{ form\.table_number \}\}/)
  })

  it('heads the grid with qty, item, price and amount', () => {
    const order = [...head.matchAll(/\$t\('orderTaker\.(\w+)'\)/g)].map((m) => m[1])
    expect(order).toEqual(['qty', 'item', 'price', 'amount'])
  })

  it('keeps the selected table in the header', () => {
    expect(pad).toMatch(/v-model="form\.table_number"/)
    expect(pad).toMatch(/\$t\('orderTaker\.selectTable'\)/)
  })

  it('gates category/search behind a chosen table', () => {
    expect(pad).toMatch(/<div v-else-if="form\.table_number && categories\.length" class="cat-rail"/)
    expect(pad).toMatch(/<div v-if="form\.table_number && \(activeCategory \|\| searchQuery\)" class="inline-items">/)
    expect(pad).toMatch(/function openCategory\(cat\) \{\s*\n\s*if \(!form\.value\.table_number\) return/)
  })

  it('still refuses to send a table-less ticket', () => {
    expect(pad).toMatch(/if \(!form\.value\.table_number\) \{\s*\n\s*sendError\.value = t\('orderTaker\.selectTableFirst'\)/)
  })

  it('keeps the header and body cells aligned', () => {
    const heads = countOf(/<th[\s>]/g)
    const cells = countOf(/<td[\s>]/g)
    expect(heads).toBe(5) // qty, item, price, amount, remove
    expect(cells).toBe(heads + 1)
    expect(linesTable).toMatch(/colspan="5"/)
  })

  it('styles the price and amount columns', () => {
    expect(styles).toMatch(/\.col-price,\s*\.col-amount \{[^}]*width:\s*130px/)
    expect(styles).not.toMatch(/\.col-table \{/)
  })

  it('has the labels in both languages', () => {
    expect(en.orderTaker.table).toBe('Table')
    expect(sw.orderTaker.table).toBeTruthy()
    expect(en.orderTaker.selectTable).toBeTruthy()
    expect(sw.orderTaker.selectTable).toBeTruthy()
  })
})
