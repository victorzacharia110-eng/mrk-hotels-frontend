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
const en = JSON.parse(read('src/locales/en.json'))

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

  it('keeps the per-order Void in the top bill-actions panel', () => {
    const panelAt = pad.indexOf('class="open-actions open-bill-actions"')
    const headerAt = pad.indexOf('class="open-card-head"')
    const splitAt = pad.indexOf('@click="openSplit(order)"')
    const transferAt = pad.indexOf('@click="openTransfer(order)"')
    const mergeAt = pad.indexOf('@click="openMerge(order)"')
    const kotAt = pad.indexOf("@click=\"printTicket(order, 'kot')\"")
    const receiptAt = pad.indexOf("@click=\"printTicket(order, 'receipt')\"")
    const voidAt = pad.indexOf('@click="openVoid(order)"')
    expect(panelAt, 'bill-actions panel not found').toBeGreaterThan(-1)
    expect(headerAt, 'card header not found').toBeGreaterThan(panelAt)
    expect(splitAt).toBeGreaterThan(panelAt)
    expect(transferAt).toBeGreaterThan(splitAt)
    expect(mergeAt).toBeGreaterThan(transferAt)
    expect(kotAt).toBeGreaterThan(mergeAt)
    expect(receiptAt).toBeGreaterThan(kotAt)
    expect(voidAt).toBeGreaterThan(receiptAt)
    expect(voidAt).toBeLessThan(headerAt)
    expect(pad.slice(voidAt, pad.indexOf('</button>', voidAt))).toMatch(/\$t\('orderTaker\.void'\)/)
  })

  it('searches the open-orders board by waiter name only', () => {
    expect(en.orderTaker.searchOpen).toMatch(/waiter/i)
    const at = pad.indexOf('const openFiltered = computed')
    expect(at, 'openFiltered not found').toBeGreaterThan(-1)
    const body = pad.slice(at, pad.indexOf('\n\n', at))
    expect(body).toMatch(/waiter_name/)
    expect(body).not.toMatch(/order_number|guest_name|table_number/)
  })
})

describe('open-order card template', () => {
  it('removes Start Preparing and the Settled filter', () => {
    expect(pad).not.toMatch(/markPreparing|advanceOrder\(order, 'preparing'\)/)
    expect(pad).not.toMatch(/filterSettled|openSettledCount|openStatus === 'settled'/)
  })

  it('puts the order date and time in the card header', () => {
    const headerAt = pad.indexOf('class="open-card-head"')
    const header = pad.slice(headerAt, pad.indexOf('</header>', headerAt))
    expect(headerAt).toBeGreaterThan(-1)
    expect(header).toMatch(/open-when[\s\S]*formatOrderDateTime/)

    const metaAt = pad.indexOf('class="open-meta open-time"')
    const meta = pad.slice(metaAt, pad.indexOf('</p>', metaAt))
    expect(metaAt).toBeGreaterThan(-1)
    expect(meta).not.toMatch(/fa-clock|formatOrderDateTime/)
  })

  it('right-aligns the total and keeps double-tap selection', () => {
    expect(pad).toMatch(/@dblclick="toggleSelectOrder\(order\)"/)
    const totalAt = pad.indexOf('.open-total {')
    const totalRule = pad.slice(totalAt, pad.indexOf('}', totalAt))
    expect(totalAt).toBeGreaterThan(-1)
    expect(totalRule).toMatch(/text-align:\s*right/)
  })

  it('keeps price and amount columns and the item rows free of status controls', () => {
    expect(pad).toMatch(/\$t\('orderTaker\.price'\)/)
    expect(pad).toMatch(/\$t\('orderTaker\.amount'\)/)
    expect(pad).not.toMatch(/item-status-pill|item-advance/)
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

  it('searches by waiter name only', () => {
    expect(cashier).toMatch(/\$t\('cashier\.summary\.searchWaiter'\)/)
    const at = cashier.indexOf('const filteredOrders = computed')
    expect(at, 'filteredOrders not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n\n', at))
    expect(body).toMatch(/waiter_name/)
    expect(body).not.toMatch(/order_number|guest_name/)
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

describe('cashier summary: review follow-ups', () => {
  it('always offers every order type the panel review lists', () => {
    expect(cashier).toMatch(/ORDER_TYPE_FILTERS = \['dine_in', 'room_service', 'delivery', 'no_charge', 'takeaway'\]/)
    expect(cashier).toMatch(/cashier\.orderTypes\.dineIn/)
    expect(cashier).toMatch(/cashier\.orderTypes\.takeAway/)
  })

  it('shows the void reason on the voided order row', () => {
    expect(cashier).toMatch(/order\.status === 'cancelled' && order\.void_reason/)
    expect(cashier).toMatch(/class="void-reason"/)
  })

  it('closes the detail drawer after a successful void', () => {
    const at = cashier.indexOf('async function confirmVoid')
    expect(at, 'confirmVoid not found').toBeGreaterThan(-1)
    const body = cashier.slice(at, cashier.indexOf('\n}\n', at))
    const release = body.indexOf('savingVoid.value = false')
    const close = body.indexOf('closeDrawer()')
    expect(release).toBeGreaterThan(-1)
    expect(close).toBeGreaterThan(release)
  })

  it('hands the + button to the existing dine-in ticket', () => {
    expect(cashier).toMatch(/query: \{ addToOrder: target\.order_id \}/)
    expect(pad).toMatch(/async function applyAddToOrder/)
    expect(pad).toMatch(/continueOrderId\.value = order\.order_id/)
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
