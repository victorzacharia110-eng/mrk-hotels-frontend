import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The cashier/bartender panel must react to the outlet picker, not only stamp
 * new orders with it. These are source assertions because the pages are large
 * and their data loaders are not exposed; the regression being guarded is a
 * watcher that sits outside `<script setup>` (and is therefore ignored by the
 * SFC compiler) or an order query that forgets `outlet_id`.
 */

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')
const scriptOf = (source) => source.slice(source.indexOf('<script setup>'), source.indexOf('</script>'))
const bodyOf = (source, marker) => {
  const at = source.indexOf(marker)
  expect(at, `${marker} not found`).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf('\n}\n', at))
}

const orderSummary = read('src/pages/cashier/CashierOrderSummaryPage.vue')
const roomService = read('src/pages/cashier/CashierRoomServicePage.vue')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')

describe('cashier pages reload when the selected outlet changes', () => {
  it('keeps the order-summary watcher inside the script block', () => {
    expect(scriptOf(orderSummary)).toMatch(/watch\(\(\) => selectedOutlet\.value\?\.outlet_id,[\s\S]*?load\(\)/)
    expect(orderSummary.slice(orderSummary.indexOf('</script>'))).not.toMatch(/watch\(\(\) => selectedOutlet/)
  })

  it('reloads the room-service board when the outlet changes', () => {
    expect(scriptOf(roomService)).toMatch(/watch\(\(\) => selectedOutlet\.value\?\.outlet_id,[\s\S]*?load\(\)/)
  })
})

describe('dine-in board is scoped to the selected outlet', () => {
  it('filters open tickets by outlet', () => {
    expect(bodyOf(pad, 'async function loadOpenOrders')).toMatch(/outlet_id: selectedOutlet\.value\?\.outlet_id/)
  })

  it('filters table occupancy by outlet', () => {
    expect(bodyOf(pad, 'async function loadDeptOrders')).toMatch(/outlet_id: selectedOutlet\.value\?\.outlet_id/)
  })

  it('filters the daily summary by outlet', () => {
    expect(bodyOf(pad, 'async function loadOrderSummary')).toMatch(/outlet_id: selectedOutlet\.value\?\.outlet_id/)
  })

  it('refreshes every outlet-scoped board when the outlet changes', () => {
    const at = pad.indexOf('watch(() => selectedOutlet.value?.outlet_id')
    expect(at).toBeGreaterThan(-1)
    const watcher = pad.slice(at, pad.indexOf('\n})', at))
    expect(watcher).toMatch(/loadMenu\(\)/)
    expect(watcher).toMatch(/loadOpenOrders\(\)/)
    expect(watcher).toMatch(/loadDeptOrders\(\)/)
    expect(watcher).toMatch(/loadOrderSummary\(\)/)
  })
})

describe('table manager keeps tables inside the selected outlet', () => {
  it('lets a manager pick the outlet a table belongs to', () => {
    expect(pad).toMatch(/v-model="tableForm\.outlet_id"/)
    expect(pad).toMatch(/v-for="outlet in tableOutletOptions"/)
    expect(pad).toMatch(/orderTaker\.unassignedOutlet/)
  })

  it('loads tables for the selected outlet, plus unassigned rows while managing', () => {
    const body = bodyOf(pad, 'async function loadTables')
    expect(body).toMatch(/outlet_id: selectedOutlet\.value\?\.outlet_id/)
    expect(body).toMatch(/include_unassigned/)
  })

  it('stores and updates the outlet together with the table', () => {
    expect(bodyOf(pad, 'async function saveTable')).toMatch(/outlet_id: tableForm\.value\.outlet_id/)
    expect(bodyOf(pad, 'function editTable')).toMatch(/outlet_id: tbl\.outlet_id/)
  })

  it('filters the manager list by outlet', () => {
    const at = pad.indexOf('const managerTables = computed')
    expect(at).toBeGreaterThan(-1)
    const list = pad.slice(at, pad.indexOf('\n})\n', at))
    expect(list).toMatch(/tableOutletFilter\.value === 'unassigned'/)
    expect(list).toMatch(/tableOutletFilter\.value === 'scoped'/)
    expect(pad).toMatch(/v-model="tableOutletFilter"/)
  })
})

describe('waiter assignment board is scoped to the selected outlet', () => {
  const board = read('src/pages/cashier/CashierWaiterAssignmentPage.vue')

  it('reads tables, live orders, the waiter board and the batch summary per outlet', () => {
    const load = bodyOf(board, 'async function load()')
    expect(load).toMatch(/tableApi\.index\(\{[^}]*outlet_id: outletId/)
    expect(load).toMatch(/cashierApi\.waiters\(\{ outlet_id: outletId \}\)/)
    expect(load).toMatch(/cashierApi\.todayOrdersBatch\(\{ outlet_id: outletId \}\)/)
    expect(load).toMatch(/outlet_id: outletId,\n\s*per_page: 100/)
  })

  it('reloads when the outlet picker changes', () => {
    expect(scriptOf(board)).toMatch(/watch\(\(\) => selectedOutlet\.value\?\.outlet_id, \(\) => load\(\)/)
  })
})
