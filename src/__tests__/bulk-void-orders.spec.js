import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Bulk void: one X clears every order currently listed, instead of one ticket at
 * a time. It lives on the Open Orders board (shared by the waiter, cashier and
 * bartender panels) and on the Cashier Order Summary table.
 *
 * These are structural assertions on the source. What is easy to break and hard
 * to notice is the *scope* of "all" — the button must honour the active
 * search/status view, offer only what the backend will accept (running + unpaid,
 * or settled for the counter roles), and report partial failures.
 */

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')
const cashier = read('src/pages/cashier/CashierOrderSummaryPage.vue')
const ordersList = read('src/pages/orders/OrderListPage.vue')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))

describe('open-orders board: void-all button', () => {
  it('renders one X next to the refresh control', () => {
    expect(pad).toMatch(/class="oh-manage oh-danger"/)
    expect(pad).toMatch(/@click="openVoidAll"/)
    // An X icon, as requested, not the ban glyph used for a single order.
    expect(pad).toMatch(/fa-xmark/)
  })

  it('only appears when there is something voidable to clear', () => {
    expect(pad).toMatch(/v-if="bulkVoidable\.length"/)
  })

  it('lets waiters void too, like the counter roles', () => {
    // The waiter was previously excluded from the single Void button; the product
    // decision is now that a waiter may void their running tickets, so neither
    // the button nor openVoid() may still gate on the role.
    expect(pad).not.toMatch(/v-if="!isWaiterRole && \[\s*'pending'/)
    const at = pad.indexOf('function openVoid(')
    expect(at, 'openVoid not found').toBeGreaterThan(-1)
    const body = pad.slice(at, pad.indexOf('\n}', at))
    expect(body).not.toMatch(/isWaiterRole/)
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

describe('cashier summary: void-all button', () => {
  it('renders one X in the toolbar and opens the confirm modal', () => {
    expect(cashier).toMatch(/class="sm-btn sm danger-ghost"[\s\S]{0,120}@click="openBulkVoid"/)
    expect(cashier).toMatch(/v-if="bulkVoidOpen" class="pay-modal-overlay"/)
    expect(cashier).toMatch(/fa-xmark/)
  })

  it('clears the filtered list and only offers tickets this role may void', () => {
    const at = cashier.indexOf('const bulkVoidable = computed')
    expect(at, 'bulkVoidable not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n\n', at))
    expect(body).toMatch(/filteredOrders\.value/)
    expect(body).toMatch(/canVoid\(order\)/)
  })

  it('voids each listed ticket and forwards the settled override', () => {
    const at = cashier.indexOf('async function confirmBulkVoid')
    expect(at, 'confirmBulkVoid not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n}\n', at))
    expect(body).toMatch(/orderApi\.voidOrder\(order\.order_id/)
    expect(body).toMatch(/override: true/)
    expect(body).toMatch(/cashier\.summary\.voidAllPartial/)
  })

  it('requires a reason, like the single-ticket void', () => {
    expect(cashier).toMatch(/cashier\.summary\.voidReasonRequired/)
    expect(cashier).toMatch(/:disabled="savingBulkVoid \|\| !bulkVoidReason"/)
  })
})

describe('cashier summary: void selected (multi-select)', () => {
  it('adds a row checkbox gated to running tickets', () => {
    expect(cashier).toMatch(/v-model="selected"/)
    expect(cashier).toMatch(/:disabled="!isRunning\(order\)"/)
  })

  it('offers a void-selected button only when something is ticked', () => {
    expect(cashier).toMatch(/v-if="selectedOrders\.length"/)
    expect(cashier).toMatch(/@click="openSelectedVoid"/)
    expect(cashier).toMatch(/cashier\.summary\.voidSelected/)
  })

  it('shows the ticked numbers and voids each through voidOrder', () => {
    expect(cashier).toMatch(/void-order-chip/)
    const at = cashier.indexOf('async function confirmSelectedVoid')
    expect(at, 'confirmSelectedVoid not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n}\n', at))
    expect(body).toMatch(/for \(const order of targets\)/)
    expect(body).toMatch(/orderApi\.voidOrder\(order\.order_id/)
    expect(body).toMatch(/cashier\.summary\.voidAllPartial/)
  })
})

describe('orders list: void selected (multi-select)', () => {
  it('adds a row checkbox gated to running/unpaid tickets', () => {
    expect(ordersList).toMatch(/v-model="selected"/)
    expect(ordersList).toMatch(/:disabled="!isVoidable\(order\)"/)
    expect(ordersList).toMatch(/function isVoidable/)
    expect(ordersList).toMatch(/payment_status \|\| 'unpaid'\) === 'unpaid'/)
  })

  it('offers a void-selected button only when something is ticked', () => {
    expect(ordersList).toMatch(/v-if="selectedOrders\.length"/)
    expect(ordersList).toMatch(/@click="openVoidSelected"/)
    expect(ordersList).toMatch(/orders\.voidSelected/)
  })

  it('voids each ticked order and reports partial failures', () => {
    expect(ordersList).toMatch(/void-order-chip/)
    const at = ordersList.indexOf('async function confirmVoidSelected')
    expect(at, 'confirmVoidSelected not found').toBeGreaterThan(-1)
    const body = ordersList.slice(at, ordersList.indexOf('\n}\n', at))
    expect(body).toMatch(/orderApi\.voidOrder\(order\.order_id/)
    expect(body).toMatch(/orders\.voidPartial/)
    expect(body).toMatch(/orders\.voidDone/)
  })
})

describe('void-all translations', () => {
  const padKeys = [
    'voidAllTitle',
    'voidAllHint',
    'voidAllSummary',
    'voidAllConfirm',
    'voidAllDone',
    'voidAllPartial',
  ]
  const cashierKeys = [
    'voidAll',
    'voidAllTitle',
    'voidAllSummary',
    'voidAllConfirm',
    'voidAllDone',
    'voidAllPartial',
  ]

  it('defines every orderTaker void-all key in both locales', () => {
    for (const key of padKeys) {
      expect(en.orderTaker[key], `en.orderTaker.${key}`).toBeTruthy()
      expect(sw.orderTaker[key], `sw.orderTaker.${key}`).toBeTruthy()
    }
  })

  it('defines every cashier.summary void-all key in both locales', () => {
    for (const key of cashierKeys) {
      expect(en.cashier.summary[key], `en.cashier.summary.${key}`).toBeTruthy()
      expect(sw.cashier.summary[key], `sw.cashier.summary.${key}`).toBeTruthy()
    }
  })

  it('passes the count into the confirm and summary strings', () => {
    expect(en.orderTaker.voidAllConfirm).toContain('{count}')
    expect(en.orderTaker.voidAllSummary).toContain('{count}')
    expect(en.orderTaker.voidAllPartial).toContain('{total}')
    expect(en.cashier.summary.voidAllConfirm).toContain('{count}')
    expect(en.cashier.summary.voidAllSummary).toContain('{count}')
    expect(sw.cashier.summary.voidAllConfirm).toContain('{count}')
  })

  it('defines the void-selected keys on both pages, in both locales', () => {
    const cashierSelected = ['voidSelected', 'voidSelectedTitle']
    const ordersKeys = [
      'voidSelected',
      'voidSelectedTitle',
      'voidReason',
      'voidReasonPlaceholder',
      'voidReasonRequired',
      'voidSummary',
      'voidConfirm',
      'voidDone',
      'voidPartial',
    ]
    for (const key of cashierSelected) {
      expect(en.cashier.summary[key], `en.cashier.summary.${key}`).toBeTruthy()
      expect(sw.cashier.summary[key], `sw.cashier.summary.${key}`).toBeTruthy()
    }
    for (const key of ordersKeys) {
      expect(en.orders[key], `en.orders.${key}`).toBeTruthy()
      expect(sw.orders[key], `sw.orders.${key}`).toBeTruthy()
    }
  })
})
