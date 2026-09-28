import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { moduleByKey } from '@/config/modules'
import en from '@/locales/en.json'
import sw from '@/locales/sw.json'

const layoutPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../layouts/StoreLayout.vue',
)

/**
 * Manager panel review — navigation and labelling fixes.
 */
describe('manager review navigation', () => {
  it('keeps Xero and QuickBooks on the accountant panel only', () => {
    // "From the administration menu on the manager panel please remove
    //  XERO | QUICKBOOKS; the functionality should remain solely on ACCOUNTANT."
    for (const key of ['integrations/quickbooks', 'integrations/xero']) {
      const mod = moduleByKey(key)
      expect(mod, key).toBeDefined()
      expect(mod.roles, key).toEqual(['accountant'])
      expect(mod.roles, key).not.toContain('manager')
      expect(mod.roles, key).not.toContain('hotel_admin')
    }
  })

  it('still exposes the Report Browser to management', () => {
    // Moving it from the restaurant section to the front desk must not lock
    // management out of it.
    const mod = moduleByKey('pos-reports')
    expect(mod).toBeDefined()
    expect(mod.roles).toContain('manager')
    expect(mod.roles).toContain('hotel_admin')
  })

  it('lists the Report Browser in the front-desk administration sub-menu, not the restaurant one', () => {
    // Review item 1: "Relocate REPORT BROWSER from RESTAURANT to the FRONT DESK
    // dropdown ADMINISTRATION MENU." StoreLayout builds both groups with a
    // `pick([...])` call, so the placement is asserted against the source.
    const source = readFileSync(layoutPath, 'utf8')

    const administrationLine = source
      .split('\n')
      .find((line) => line.includes('const administration = pick('))
    expect(administrationLine, 'front-desk administration pick').toBeDefined()
    expect(administrationLine).toContain("'pos-reports'")

    const managerLine = source
      .split('\n')
      .find((line) => line.includes("subGroup('fnb-manager'") === false && line.includes('const manager = pick('))
    expect(managerLine, 'restaurant manager pick').toBeDefined()
    expect(managerLine).not.toContain("'pos-reports'")
  })

  it('labels the former "Staff Report" as "Summary Report"', () => {
    // Review item 3: replace STAFF REPORT with SUMMARY REPORT in the manager
    // panel restaurant section.
    expect(en.nav.staffReports).toBe('Summary Report')
    expect(sw.nav.staffReports).toBe('Ripoti ya Muhtasari')
  })
})
