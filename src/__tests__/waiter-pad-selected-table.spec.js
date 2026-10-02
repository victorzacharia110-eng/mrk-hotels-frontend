import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the selected table in the waiter pad's order lines.
 *
 * The pad lets a waiter pick the table in the header, but the lines grid below
 * only ever showed Qty / Item / Price / Amount — so the destination of the
 * ticket was invisible next to the items being rung up, and on a phone the
 * header scrolls away while the grid stays put. Sending is also blocked until a
 * table is chosen, which made the missing table easy to miss entirely.
 *
 * Structural assertions, matching the rest of this suite: jsdom resolves no
 * layout, and mounting the pad drags in the whole API surface. What these catch
 * is the column being dropped or a row losing its cell, which is how the gap
 * arrived. The behaviour is asserted for real in `e2e/`.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))
const styles = pad.slice(pad.indexOf('<style'))

/** The order-lines grid (the plain one; the dash/summary tables reuse the class). */
const linesTable = pad.slice(pad.indexOf('<table class="lines-table">'), pad.indexOf('</table>'))
const head = linesTable.slice(linesTable.indexOf('<thead>'), linesTable.indexOf('</thead>'))

const countOf = (re) => (linesTable.match(re) || []).length

describe('waiter pad: the selected table is on every line', () => {
  it('heads the grid with a table column', () => {
    expect(head).toMatch(/<th class="col-table">\{\{ \$t\('orderTaker\.table'\) \}\}<\/th>/)
    // Table first: it scopes the whole ticket, so it is read before the items.
    const order = [...head.matchAll(/\$t\('orderTaker\.(\w+)'\)/g)].map((m) => m[1])
    expect(order).toEqual(['table', 'qty', 'item', 'price', 'amount'])
  })

  it('prints the selected table on each row', () => {
    expect(linesTable).toMatch(/<td class="col-table">/)
    expect(linesTable).toMatch(/\{\{ form\.table_number \}\}/)
    // Bound to the order's table, not to the line: there is one table per ticket.
    expect(linesTable).toMatch(/v-if="form\.table_number"/)
  })

  it('marks the not-yet-chosen state, since it blocks sending', () => {
    expect(linesTable).toMatch(/v-else class="line-table is-unset"/)
    expect(linesTable).toMatch(/:title="\$t\('orderTaker\.selectTable'\)"/)
    // ...and sendOrder really does refuse a table-less ticket, so the dash is a
    // real blocker rather than decoration.
    expect(pad).toMatch(/if \(!form\.value\.table_number\) \{\s*\n\s*sendError\.value = t\('orderTaker\.selectTableFirst'\)/)
  })

  it('keeps the header and body cells aligned', () => {
    // A stray cell is what breaks a grid: it silently shifts every column.
    const heads = countOf(/<th[\s>]/g)
    const cells = countOf(/<td[\s>]/g)
    expect(heads).toBe(6) // table, qty, item, price, amount, remove
    // One populated row plus the empty-state row.
    expect(cells).toBe(heads + 1)
    expect(linesTable).toMatch(/colspan="6"/)
  })

  it('gives the column a width and an unset style', () => {
    expect(styles).toMatch(/\.col-table \{[^}]*width:/)
    expect(styles).toMatch(/\.line-table\.is-unset \{/)
    // Wide enough not to clip "Table 12" next to the qty stepper.
    expect(styles).not.toMatch(/\.col-table \{[^}]*max-width:\s*\d{2}px/)
  })

  it('has the label in both languages', () => {
    expect(en.orderTaker.table).toBe('Table')
    expect(sw.orderTaker.table).toBeTruthy()
    expect(en.orderTaker.selectTable).toBeTruthy()
    expect(sw.orderTaker.selectTable).toBeTruthy()
  })
})