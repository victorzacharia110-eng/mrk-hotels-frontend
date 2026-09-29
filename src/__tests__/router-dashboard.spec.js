import { describe, it, expect } from 'vitest'
import { dashboardMap, resolveLanding, MANAGEMENT_ROLES } from '@/router'
import { moduleByKey, moduleLabelKey } from '@/config/modules'

/**
 * Builds a stand-in for the auth store. Only the two members resolveLanding
 * reads are implemented, so a new dependency on the store shows up as a failure
 * here rather than as a silent behaviour change in the guard.
 */
function fakeStore({ role, canAccessOverview = true } = {}) {
  return {
    user: role ? { user_role: role } : null,
    canAccess: (module) => {
      if (module?.key === 'overview') return canAccessOverview
      return true
    },
  }
}

describe('dashboardMap', () => {
  it('lands management on the reporting overview', () => {
    // Manager review: "why is the manager's default page the receptionist
    // dashboard?" Management is accountable for the numbers, so the overview is
    // their home. The front-desk board stays reachable through the drawer.
    expect(dashboardMap.hotel_admin).toBe('/app/overview')
    expect(dashboardMap.manager).toBe('/app/overview')
    expect(dashboardMap.accountant).toBe('/app/overview')
  })

  it('leaves the receptionist on the front-desk stay view', () => {
    // The front desk is a receptionist's working surface, not a landing page
    // that happens to exist, so it must not move.
    expect(dashboardMap.receptionist).toBe('/app')
  })

  it('keeps the other roles on their own landing pages', () => {
    expect(dashboardMap.waiter).toBe('/app/take-order')
    expect(dashboardMap.bartender).toBe('/cashier')
    expect(dashboardMap.cashier).toBe('/cashier')
    expect(dashboardMap.kitchen).toBe('/app/kitchen')
    expect(dashboardMap.store_manager).toBe('/store-manager')
    expect(dashboardMap.housekeeping).toBe('/app')
    expect(dashboardMap.procurement_officer).toBe('/app')
    expect(dashboardMap.staff).toBe('/app')
    expect(dashboardMap.superadmin).toBe('/superadmin')
    expect(dashboardMap.owner).toBe('/owner')
  })
})

describe('resolveLanding', () => {
  it('sends a manager to the overview when the tenant has the feature', () => {
    expect(resolveLanding(fakeStore({ role: 'manager' }))).toBe('/app/overview')
  })

  it('sends the receptionist to the front desk', () => {
    expect(resolveLanding(fakeStore({ role: 'receptionist' }))).toBe('/app')
  })

  it('falls back to the front desk when the overview feature is not licensed', () => {
    // The overview module is gated on a subscription feature. Landing a user on
    // a page the module guard will refuse is what turns one denial into an
    // infinite redirect, because the denial redirects back to the same landing.
    expect(resolveLanding(fakeStore({ role: 'manager', canAccessOverview: false }))).toBe('/app')
  })

  it('falls back for every management role when the feature is missing', () => {
    for (const role of MANAGEMENT_ROLES) {
      expect(resolveLanding(fakeStore({ role, canAccessOverview: false }))).toBe('/app')
    }
  })

  it('never resolves to the overview for a user who cannot open it', () => {
    // The invariant the redirect loop depends on: the landing must be reachable.
    // With the feature switched off, no role may be sent to the gated page.
    for (const role of Object.keys(dashboardMap)) {
      expect(resolveLanding(fakeStore({ role, canAccessOverview: false }))).not.toBe('/app/overview')
    }
  })

  it('resolves the same landing whether or not the feature is licensed, for non-management roles', () => {
    for (const role of ['receptionist', 'housekeeping', 'procurement_officer', 'staff', 'waiter', 'bartender', 'cashier', 'kitchen', 'store_manager', 'superadmin', 'owner']) {
      expect(resolveLanding(fakeStore({ role, canAccessOverview: false }))).toBe(
        resolveLanding(fakeStore({ role, canAccessOverview: true })),
      )
    }
  })

  it('falls back to the front desk for an unknown or missing role', () => {
    expect(resolveLanding(fakeStore({ role: 'nonsense' }))).toBe('/app')
    expect(resolveLanding(fakeStore({}))).toBe('/app')
    expect(resolveLanding(undefined)).toBe('/app')
  })

  it('leaves non-management roles alone whatever the overview feature is', () => {
    for (const role of ['receptionist', 'housekeeping', 'waiter', 'bartender', 'cashier', 'kitchen']) {
      expect(resolveLanding(fakeStore({ role, canAccessOverview: false }))).toBe(dashboardMap[role])
    }
  })

  it('is what the management roles are for', () => {
    expect(MANAGEMENT_ROLES).toEqual(['hotel_admin', 'manager', 'accountant'])
    MANAGEMENT_ROLES.forEach((role) => expect(dashboardMap[role]).toBe('/app/overview'))
  })
})

describe('front-desk entry label', () => {
  const frontDesk = moduleByKey('dashboard')

  it('calls the front-desk board "Front Desk" for management', () => {
    // Management now land on the overview, so a second entry called
    // "Dashboard" reads as a duplicate home page instead of the front desk.
    expect(frontDesk.to).toBe('/app')
    for (const role of MANAGEMENT_ROLES) {
      expect(moduleLabelKey(frontDesk, role)).toBe('nav.frontDesk')
    }
  })

  it('still calls it "Dashboard" for the staff who work it', () => {
    for (const role of ['receptionist', 'housekeeping', 'waiter', 'bartender', 'kitchen']) {
      expect(moduleLabelKey(frontDesk, role)).toBe('nav.dashboard')
    }
  })

  it('keeps the front desk open to management', () => {
    for (const role of MANAGEMENT_ROLES) {
      expect(frontDesk.roles).toContain(role)
    }
  })

  it('leaves every other module with a single label', () => {
    const overview = moduleByKey('overview')
    expect(moduleLabelKey(overview, 'manager')).toBe(overview.labelKey)
  })
})
