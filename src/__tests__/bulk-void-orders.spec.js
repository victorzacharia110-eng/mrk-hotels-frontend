import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Cashier / waiter voiding after the PDF review.
 *
 * Bulk "void every listed ticket" was removed: a mis-tap cleared the whole
 * board. Voiding is now scoped to explicitly ticked orders, with the same
 * reason requirement and partial-failure reporting as before.
 */

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')
const cashier = read('src/pages/cashier/CashierOrderSummaryPage.vue')
const ordersList = read('src/pages/orders/OrderListPage.vue')

describe('open-orders board: void selected only', () => {
  it('has no void-all control or handler', () => {
    expect(pad).not.toMatch(/openVoidAll/)
    expect(pad).not.toMatch(/confirmVoidAll/)
    expect(pad).not.toMatch(/bulkVoidable/)
  })

  it('offers void only for explicitly ticked, voidable tickets', () => {
    expect(pad).toMatch(/v-if="selectedVoidable\.length"/)
    expect(pad).toMatch(/@click="openVoidSelected"/)

    const at = pad.indexOf('const selectedVoidable = computed')
    expect(at, 'selectedVoidable not found').toBeGreaterThan(-1)
    const body = pad.slice(at, pad.indexOf('\n\n', at))
    expect(body).toMatch(/openFiltered\.value/)
    expect(body).toMatch(/payment_status === 'unpaid'/)
  })

  it('voids each ticked order through the single-order API', () => {
    const at = pad.indexOf('async function confirmVoidSelected')
    expect(at, 'confirmVoidSelected not found').toBeGreaterThan(-1)
    const body = pad.slice(at, pad.indexOf('\n}\n', at))
    expect(body).toMatch(/for \(const order of targets\)/)
    expect(body).toMatch(/orderApi\.voidOrder\(order\.order_id/)
  })
})

describe('cashier summary: void selected only', () => {
  it('has no void-all control, modal or handlers', () => {
    expect(cashier).not.toMatch(/openBulkVoid/)
    expect(cashier).not.toMatch(/confirmBulkVoid/)
    expect(cashier).not.toMatch(/bulkVoidable/)
    expect(cashier).not.toMatch(/bulkVoidOpen/)
  })

  it('keeps every action in the toolbar above the table', () => {
    expect(cashier).toMatch(/class="table-actions"/)
    expect(cashier).toMatch(/@click="actOnSingle\(settle\)"/)
    expect(cashier).toMatch(/@click="actOnSingle\(freeze\)"/)
    expect(cashier).toMatch(/@click="actOnSingle\(reprint\)"/)
    expect(cashier).toMatch(/@click="actOnSingle\(reprintKot\)"/)
    expect(cashier).toMatch(/@click="openSelectedVoid"/)
  })

  it('offers void only for ticked tickets this role may void', () => {
    const at = cashier.indexOf('const selectedOrders = computed')
    expect(at, 'selectedOrders not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n\n', at))
    expect(body).toMatch(/filteredOrders\.value/)
    expect(body).toMatch(/canVoid\(order\)/)
  })

  it('voids each ticked ticket, forwards the settled override and reports failures', () => {
    const at = cashier.indexOf('async function confirmSelectedVoid')
    expect(at, 'confirmSelectedVoid not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n}\n', at))
    expect(body).toMatch(/for \(const order of targets\)/)
    expect(body).toMatch(/orderApi\.voidOrder\(order\.order_id/)
    expect(body).toMatch(/override: true/)
    expect(body).toMatch(/cashier\.summary\.voidAllPartial/)
  })

  it('requires a reason, like the single-ticket void', () => {
    expect(cashier).toMatch(/cashier\.summary\.voidReasonRequired/)
    expect(cashier).toMatch(/:disabled="savingSelectedVoid \|\| !selectedVoidReason"/)
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
