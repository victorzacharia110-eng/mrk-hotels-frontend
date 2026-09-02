import { describe, it, expect } from 'vitest'
import { MODULES, moduleByKey, moduleByPath } from '@/config/modules'

describe('module config', () => {
  describe('moduleByKey', () => {
    it('finds a module by its key', () => {
      const mod = moduleByKey('reservations')
      expect(mod).toBeDefined()
      expect(mod.to).toBe('/app/reservations')
      expect(mod.roles).toContain('receptionist')
    })

    it('returns undefined for unknown key', () => {
      expect(moduleByKey('nonexistent')).toBeUndefined()
    })

    it('dashboard (stay-view) is gated to front-desk roles, not management', () => {
      const mod = moduleByKey('dashboard')
      expect(mod.roles).toContain('receptionist')
      expect(mod.roles).not.toContain('manager')
      expect(mod.roles).not.toContain('hotel_admin')
      expect(mod.roles).not.toContain('accountant')
    })
  })

  describe('moduleByPath', () => {
    it('finds a module by its route path', () => {
      const mod = moduleByPath('/app/housekeeping')
      expect(mod).toBeDefined()
      expect(mod.key).toBe('housekeeping')
    })

    it('returns undefined for unknown path', () => {
      expect(moduleByPath('/app/unknown')).toBeUndefined()
    })
  })

  describe('role restrictions', () => {
    it('reservations is accessible to receptionist', () => {
      const mod = moduleByKey('reservations')
      expect(mod.roles).toContain('receptionist')
    })

    it('staff management is restricted to admin/manager', () => {
      const mod = moduleByKey('staff')
      expect(mod.roles).toEqual(['hotel_admin', 'manager'])
    })

    it('housekeeping module is restricted to relevant roles', () => {
      const mod = moduleByKey('housekeeping')
      expect(mod.roles).toContain('housekeeping')
      expect(mod.roles).not.toContain('receptionist')
    })

    it('orders module includes kitchen, waiter, bartender', () => {
      const mod = moduleByKey('orders')
      expect(mod.roles).toContain('kitchen')
      expect(mod.roles).toContain('waiter')
      expect(mod.roles).toContain('bartender')
    })

    it('laundry requires manage_laundry permission', () => {
      const mod = moduleByKey('laundry')
      expect(mod.permission).toBe('manage_laundry')
    })

    it('accounting is accessible to accountant role', () => {
      const mod = moduleByKey('accounting')
      expect(mod.roles).toContain('accountant')
    })

    it('reports browser is accessible to receptionist', () => {
      const mod = moduleByKey('reports')
      expect(mod.roles).toContain('receptionist')
    })

    it('purchase-orders includes accountant', () => {
      const mod = moduleByKey('purchase-orders')
      expect(mod.roles).toContain('accountant')
    })
  })

  describe('MODULES integrity', () => {
    it('has at least 20 modules defined', () => {
      expect(MODULES.length).toBeGreaterThanOrEqual(20)
    })

    it('every module has a unique key', () => {
      const keys = MODULES.map((m) => m.key)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('every module has required fields', () => {
      for (const mod of MODULES) {
        expect(mod.key).toBeTruthy()
        expect(mod.to).toBeTruthy()
        expect(mod.icon).toBeTruthy()
        expect(mod.labelKey).toBeTruthy()
        expect(Array.isArray(mod.roles)).toBe(true)
      }
    })
  })
})
