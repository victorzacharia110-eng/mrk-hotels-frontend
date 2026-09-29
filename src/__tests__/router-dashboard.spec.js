import { describe, it, expect } from 'vitest'
import { dashboardMap, resolveLanding, MANAGEMENT_ROLES } from '@/router'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { moduleByKey } from '@/config/modules'

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

const layoutPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../layouts/StoreLayout.vue',
)

/**
 * The management branch of visibleModules, as source text.
 *
 * The regression this guards is a *rendering* one: the `dashboard` module was
 * open to management and correctly labelled, but the management branch never
 * pushed it, so a manager had no sidebar route to /app at all. Asserting the
 * module's roles and labelKey passed happily while the entry was absent. These
 * tests therefore read what the branch actually emits.
 */
function managementFrontDeskBlock() {
  const source = readFileSync(layoutPath, 'utf8')
  const start = source.indexOf('const frontDesk = []')
  const end = source.indexOf("accordionGroup('front-desk'", start)
  expect(start, 'management frontDesk array').toBeGreaterThan(-1)
  expect(end, 'front-desk accordion').toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('front-desk board in the management sidebar', () => {
  const block = managementFrontDeskBlock()
  const board = moduleByKey('dashboard')

  it('keeps the stay board reachable for management in the access matrix', () => {
    expect(board.to).toBe('/app')
    for (const role of MANAGEMENT_ROLES) {
      expect(board.roles).toContain(role)
    }
  })

  it('emits the stay board as the first child of the FRONT DESK dropdown', () => {
    // Nesting it is what distinguishes it from the overview DASHBOARD above.
    expect(block).toContain('byKey.dashboard')
    expect(block).toContain("label: t('nav.dashboard')")
    expect(block.indexOf('byKey.dashboard')).toBeLessThan(block.indexOf("link('reservations'"))
  })

  it('routes that child at /app, not the overview', () => {
    expect(block).toContain('to: byKey.dashboard.to')
  })

  it('leaves the overview as the single top-level DASHBOARD entry', () => {
    // The landing page stays a lone item above the accordions, not a child.
    const source = readFileSync(layoutPath, 'utf8')
    expect(source).toContain("out.push({ ...byKey.overview, label: t('nav.dashboard') })")
    expect(block).not.toContain('byKey.overview')
  })

  it('uses one label per module, so no role needs a relabelled variant', () => {
    // The altLabelKey mechanism existed only to call this board "Front Desk"
    // for management. It is gone: the entry is built explicitly and nested.
    expect(board.altLabelKey).toBeUndefined()
    expect(board.altRoles).toBeUndefined()
    expect(board.labelKey).toBe('nav.dashboard')
  })

  it('leaves the overview module with its own label', () => {
    const overview = moduleByKey('overview')
    expect(overview.labelKey).toBe('overview.title')
    expect(overview.roles).toEqual(MANAGEMENT_ROLES)
  })
})
