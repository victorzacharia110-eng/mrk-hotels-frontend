import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The Open Orders board (shared by the waiter, cashier and bartender panels)
 * gained a single X that voids every order currently listed, instead of one
 * ticket at a time.
 *
 * These are structural assertions on the source. The board's data flow is
 * already covered indirectly by the waiter-pad tests; what is easy to break and
 * hard to notice is the *scope* of "all" — the button must honour the active
 * search/status filter, must match the per-order Void button's permission, and
 * must never attempt a void the backend rejects (paid / room-billed tickets).
 */

const pad = readFileSync(resolve(process.cwd(), 'src/pages/dashboards/OrderTakerDashboard.vue'), 'utf8')
const en = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/en.json'), 'utf8'))
const sw = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/sw.json'), 'utf8'))

describe('open-orders board: void-all button', () => {
  it('renders one X next to the refresh control', () => {
    expect(pad).toMatch(/class="oh-manage oh-danger"/)
    expect(pad).toMatch(/@click="openVoidAll"/)
    // An X icon, as requested, not the ban glyph used for a single order.
    expect(pad).toMatch(/fa-xmark/)
  })

  it('only appears when there is something voidable to clear', () => {
    expect(pad).toMatch(/v-if="canVoidOrders && bulkVoidable\.length"/)
  })

  it('follows the per-order Void permission (waiters excluded)', () => {
    // Matches the single-order button, which is also gated on `!isWaiterRole`.
    expect(pad).toMatch(/const canVoidOrders = computed\(\(\) => !isWaiterRole\.value\)/)
  })

  it('clears exactly what the filter/search is showing', () => {
    // "All" means the current view: the selection runs over `openFiltered`,
    // not the raw `openOrders` list.
    const at = pad.indexOf('const bulkVoidable = computed')
    expect(at, 'bulkVoidable not found').toBeGreaterThan(-1)
    const body = pad.slice(at, pad.indexOf('\n\n', at))
    expect(body).toMatch(/openFiltered\.value/)
    expect(body).toMatch(/payment_status === 'unpaid'/)
  })

  it('voids each listed order through the same API the single button uses', () => {
    const at = pad.indexOf('async function confirmVoidAll')
    expect(at, 'confirmVoidAll not found').toBeGreaterThan(-1)
    const body = pad.slice(at, pad.indexOf('\n}\n', at))
    expect(body).toMatch(/for \(const order of targets\)/)
    expect(body).toMatch(/orderApi\.voidOrder\(order\.order_id/)
  })

  it('reports partial failures instead of claiming a full success', () => {
    expect(pad).toMatch(/orderTaker\.voidAllPartial/)
    expect(pad).toMatch(/orderTaker\.voidAllDone/)
  })
})

describe('open-orders board: void-all translations', () => {
  const keys = [
    'voidAll',
    'voidAllTitle',
    'voidAllHint',
    'voidAllSummary',
    'voidAllConfirm',
    'voidAllDone',
    'voidAllPartial',
  ]

  it('defines every void-all key in both locales', () => {
    for (const key of keys) {
      expect(en.orderTaker[key], `en.orderTaker.${key}`).toBeTruthy()
      expect(sw.orderTaker[key], `sw.orderTaker.${key}`).toBeTruthy()
    }
  })

  it('passes the count into the confirm and summary strings', () => {
    expect(en.orderTaker.voidAllConfirm).toContain('{count}')
    expect(en.orderTaker.voidAllSummary).toContain('{count}')
    expect(en.orderTaker.voidAllPartial).toContain('{total}')
    expect(sw.orderTaker.voidAllConfirm).toContain('{count}')
  })
})
