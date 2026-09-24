import { describe, it, expect } from 'vitest'
import { dashboardMap } from '@/router'

describe('dashboardMap', () => {
  it('lands management roles on the stay-view Dashboard, not the read-only overview', () => {
    // The review "NO DASHBOARD AT MANAGER PAGE TO TEST" items (voiding a
    // reservation, editing/voiding room charges, folio ops after checkout)
    // are exercised from the stay-view Dashboard under a management login.
    expect(dashboardMap.hotel_admin).toBe('/app')
    expect(dashboardMap.manager).toBe('/app')
    expect(dashboardMap.accountant).toBe('/app')
  })

  it('keeps the other roles on their own landing pages', () => {
    expect(dashboardMap.receptionist).toBe('/app')
    expect(dashboardMap.waiter).toBe('/app/take-order')
    expect(dashboardMap.bartender).toBe('/cashier')
    expect(dashboardMap.cashier).toBe('/cashier')
    expect(dashboardMap.kitchen).toBe('/app/kitchen')
    expect(dashboardMap.store_manager).toBe('/store-manager')
  })
})