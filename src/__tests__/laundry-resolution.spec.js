import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Laundry resolution (the "LAUNDRY RESOLUTION.pdf" review).
 *
 * Structural assertions on LaundryListPage.vue that lock in the requested
 * changes without mounting the component (which would need heavy API/store
 * mocks). These are exactly the things that are easy to break and hard to
 * notice: the two guest modes with auto-fill, the settlement-driven status,
 * the cashier-style action bar, the removal of the status dropdown and the
 * consumables UI, and the amount column being last.
 */

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')
const page = read('src/pages/laundry/LaundryListPage.vue')
const clothPage = read('src/pages/laundry/ClothTypesPage.vue')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))

describe('new-order form: two major guest modes', () => {
  it('offers IN HOUSE GUEST and CUSTOMER as a toggle', () => {
    expect(page).toMatch(/guestType === 'in_house'/)
    expect(page).toMatch(/guestType === 'customer'/)
    expect(page).toMatch(/value="in_house"/)
    expect(page).toMatch(/value="customer"/)
    expect(en.laundry.inHouseGuest).toBeTruthy()
    expect(en.laundry.customer).toBeTruthy()
  })

  it('auto-fills room number and guest name when an in-house guest is picked', () => {
    // The picker loads active stays and copies room + guest + reservation.
    expect(page).toMatch(/function loadInHouseGuests/)
    expect(page).toMatch(/orderApi\.formOptions/)
    expect(page).toMatch(/function onGuestSelect/)
    const at = page.indexOf('function onGuestSelect')
    const body = page.slice(at, page.indexOf('\n}', at))
    expect(body).toMatch(/form\.guest_name = guest\.guest_name/)
    expect(body).toMatch(/form\.room_number = guest\.room_number/)
    expect(body).toMatch(/form\.reservation_id = guest\.reservation_id/)
    // Both fields are read-only while in the in-house mode.
    expect(page).toMatch(/:readonly="guestType === 'in_house'"/)
  })
})

describe('new-order form: removed controls', () => {
  it('no longer renders a status dropdown in the form', () => {
    // The form must not bind a status selector; only the filter bar keeps one.
    expect(page).not.toMatch(/<SearchableSelect v-model="form\.status"/)
  })

  it('no longer renders the consumables block or the add-consumable button', () => {
    expect(page).not.toMatch(/addConsumable/)
    expect(page).not.toMatch(/laundry\.addConsumable/)
    expect(page).not.toMatch(/form\.consumables/)
    expect(page).not.toMatch(/stockItemOptions/)
  })

  it('keeps the order date bound to the business date and read-only', () => {
    expect(page).toMatch(/v-model="form\.order_date" type="date"[^>]*readonly/)
    // The form defaults the date from the business-date store.
    expect(page).toMatch(/useBusinessDateStore/)
    expect(page).toMatch(/bd\.current/)
  })
})

describe('attendant selection', () => {
  it('prefers laundry personnel, falling back to housekeeping staff', () => {
    const at = page.indexOf('const attendantOptions')
    expect(at, 'attendantOptions not found').toBeGreaterThan(-1)
    const body = page.slice(at, page.indexOf('\n)', at))
    expect(body).toMatch(/housekeeping/)
    expect(body).toMatch(/laundry/)
    expect(page).toMatch(/:options="attendantOptions"/)
  })
})

describe('orders table', () => {
  it('shows the amount column last', () => {
    const cols = [...page.matchAll(/<th scope="col">[^<]*\$t\('([^']+)'\)/g)].map((m) => m[1])
    // The last header before the empty-state colspan must be the total charge.
    expect(cols[cols.length - 1]).toBe('laundry.totalCharge')
  })

  it('removes the per-row action column and its workflow buttons', () => {
    expect(page).not.toMatch(/<th scope="col">\{\{ \$t\('common\.actions'\) \}\}<\/th>/)
    // The old inline ready/delivered/cancel/edit/delete buttons are gone.
    expect(page).not.toMatch(/@click="setStatus\(order, 'ready'\)"/)
    expect(page).not.toMatch(/@click="remove\(order\)"/)
  })

  it('shows a settlement-driven PENDING/COMPLETE status column', () => {
    const at = page.indexOf('function displayStatus')
    expect(at, 'displayStatus not found').toBeGreaterThan(-1)
    const body = page.slice(at, page.indexOf('\n}', at))
    expect(body).toMatch(/paid/)
    expect(body).toMatch(/billed_to_room/)
    expect(body).toMatch(/statusComplete/)
    expect(body).toMatch(/statusPending/)
    // The table renders the derived status, not the raw workflow status.
    expect(page).toMatch(/displayStatus\(order\)\.label/)
    expect(page).toMatch(/displayStatus\(order\)\.badge/)
  })

  it('offers a manual/automated (hotel linen) switch', () => {
    expect(page).toMatch(/sourceView === 'manual'/)
    expect(page).toMatch(/sourceView === 'automated'/)
    expect(en.laundry.manualOrders).toBeTruthy()
    expect(en.laundry.automatedOrders).toBeTruthy()
  })

  it('makes the order number open a cashier-style detail drawer', () => {
    expect(page).toMatch(/@click="openDrawer\(order\)"/)
    expect(page).toMatch(/function openDrawer/)
    expect(page).toMatch(/v-if="drawerOrder"/)
    // The drawer carries settle / edit / void like the cashier panel.
    expect(page).toMatch(/openSettle\(drawerOrder\)/)
    expect(page).toMatch(/openEdit\(drawerOrder\)/)
    expect(page).toMatch(/promptVoid/)
  })

  it('puts view / settle / void in a top action bar driven by one selection', () => {
    expect(page).toMatch(/class="table-actions"/)
    expect(page).toMatch(/const singleSelected/)
    expect(page).toMatch(/openDrawer\(singleSelected\)/)
    expect(page).toMatch(/openSettle\(singleSelected\)/)
  })
})

describe('settled orders', () => {
  it('become view-only: no edit, no void once paid or posted', () => {
    const at = page.indexOf('function isEditable')
    expect(at, 'isEditable not found').toBeGreaterThan(-1)
    const body = page.slice(at, page.indexOf('\n}', at))
    expect(body).toMatch(/paid/)
    expect(body).toMatch(/billed_to_room/)
    // The drawer hides its action cluster for a settled order.
    expect(page).toMatch(/v-if="isEditable\(drawerOrder\)"/)
  })
})

describe('export', () => {
  it('no longer exports a consumables column', () => {
    expect(page).not.toMatch(/key: 'consumables'/)
  })

  it('exports the settlement-driven status and amount last', () => {
    expect(page).toMatch(/status: displayStatus\(order\)\.label/)
    const cols = [...page.matchAll(/\{ key: '([^']+)', label:/g)].map((m) => m[1])
    expect(cols[cols.length - 1]).toBe('total_charge')
  })
})

describe('locale parity for the new laundry keys', () => {
  it('adds every new key to both en and sw', () => {
    const keys = [
      'statusComplete', 'guestType', 'inHouseGuest', 'customer', 'selectInHouseGuest',
      'manualOrders', 'automatedOrders', 'automatedEmpty', 'viewOrder', 'void',
      'voidOrder', 'voidReason', 'markReady', 'markDelivered', 'settledHint',
    ]
    for (const key of keys) {
      expect(en.laundry[key], `en.laundry.${key}`).toBeTruthy()
      expect(sw.laundry[key], `sw.laundry.${key}`).toBeTruthy()
    }
  })
})

describe('settlement: room orders post, customer orders pay', () => {
  it('defaults in-house (room) orders to posting and customer orders to paid', () => {
    expect(page).toMatch(/function isInHouse/)
    const at = page.indexOf('function openSettle')
    expect(at, 'openSettle not found').toBeGreaterThan(-1)
    const body = page.slice(at, page.indexOf('\n}', at))
    // Room orders post to the folio; walk-in customers pay directly.
    expect(body).toMatch(/isInHouse\(order\) \? 'billed_to_room' : 'paid'/)
  })

  it('offers the posting option only for in-house (room) orders', () => {
    expect(page).toMatch(/<label v-if="isInHouse\(settleOrder\)"[^>]*>[\s\S]*?value="billed_to_room"/)
  })
})

describe('cloth registry: two tabs (compositions + priced items)', () => {
  it('exposes a Cloth Types and a Cloth Items tab', () => {
    expect(clothPage).toMatch(/activeTab === 'types'/)
    expect(clothPage).toMatch(/activeTab === 'items'/)
    expect(clothPage).toMatch(/function switchTab/)
    expect(en.clothTypes.tabTypes).toBeTruthy()
    expect(en.clothTypes.tabItems).toBeTruthy()
    expect(sw.clothTypes.tabTypes).toBeTruthy()
    expect(sw.clothTypes.tabItems).toBeTruthy()
  })

  it('offers a back button to the laundry orders page', () => {
    expect(clothPage).toMatch(/\$router\.push\('\/app\/laundry'\)/)
  })

  it('links a priced cloth item to a composition via the API', () => {
    expect(clothPage).toMatch(/cloth_composition_id/)
    expect(clothPage).toMatch(/clothCompositionApi/)
    expect(clothPage).toMatch(/compositionOptions/)
  })

  it('registers composition name + description and item prices per service', () => {
    expect(clothPage).toMatch(/form\.description/)
    expect(clothPage).toMatch(/form\.wash_price/)
    expect(clothPage).toMatch(/form\.iron_price/)
    expect(clothPage).toMatch(/form\.dry_clean_price/)
    expect(en.clothTypes.description).toBeTruthy()
    expect(sw.clothTypes.description).toBeTruthy()
  })
})
