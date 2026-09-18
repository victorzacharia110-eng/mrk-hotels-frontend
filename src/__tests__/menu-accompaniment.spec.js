import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GRILL_KEYWORDS, isGrillItemName, isGrillMenuItem } from '@/utils/menuAccompaniment'
import {
  fallbackAccompanimentOptions,
  canManageAccompaniments,
  lockedAccompanimentDepartment,
  normalizeDepartment,
  loadAccompanimentOptions,
} from '@/utils/menuAccompaniment'
import { menuAccompanimentApi } from '@/api'

vi.mock('@/api', () => ({
  menuAccompanimentApi: {
    index: vi.fn(),
    store: vi.fn(),
    update: vi.fn(),
    reorder: vi.fn(),
    destroy: vi.fn(),
  },
}))

describe('menuAccompaniment', () => {
  const menuItems = [
    { menu_item_id: 1, item_name: 'Beef Mshikaki' },
    { menu_item_id: 2, item_name: 'Kuku Choma' },
    { menu_item_id: 3, item_name: 'Whole Grilled Fish' },
    { menu_item_id: 4, item_name: 'Broiler Fried (Quarter)' },
    { menu_item_id: 5, item_name: 'Maini' },
    { menu_item_id: 6, item_name: 'Plain Rice' },
    { menu_item_id: 7, item_name: 'Cola' },
    { menu_item_id: 8, item_name: 'Vegetable Soup' },
  ]

  it('exposes the full keyword list', () => {
    expect(GRILL_KEYWORDS).toContain('mshikaki')
    expect(GRILL_KEYWORDS).toContain('kuku')
    expect(GRILL_KEYWORDS).toContain('broiler')
    expect(GRILL_KEYWORDS).toContain('roast')
    expect(GRILL_KEYWORDS).toContain('whole')
  })

  it('flags grill-style mains by name', () => {
    for (const name of ['Beef Mshikaki', 'Kuku Choma', 'Whole Grilled Fish', 'Broiler Fried (Quarter)', 'Maini', 'roasted chicken']) {
      expect(isGrillItemName(name)).toBe(true)
    }
  })

  it('does not flag sides, drinks or soups', () => {
    for (const name of ['Plain Rice', 'Cola', 'Vegetable Soup', 'Vegetable Pilau', 'Chapati']) {
      expect(isGrillItemName(name)).toBe(false)
    }
  })

  it('resolves a menu_item_id against the item list', () => {
    expect(isGrillMenuItem(1, menuItems)).toBe(true)
    expect(isGrillMenuItem(2, menuItems)).toBe(true)
    expect(isGrillMenuItem(6, menuItems)).toBe(false)
  })

  it('accepts an item object directly', () => {
    expect(isGrillMenuItem({ item_name: 'Samaki Choma' })).toBe(true)
    expect(isGrillMenuItem({ item_name: 'Veggie Pilau' })).toBe(false)
  })

  it('is case-insensitive and tolerant of missing lookups', () => {
    expect(isGrillItemName('NYAMA CHOMA')).toBe(true)
    expect(isGrillItemName('  Kuku Choma  ')).toBe(true)
    expect(isGrillMenuItem(999, menuItems)).toBe(false)
    expect(isGrillMenuItem(null)).toBe(false)
    expect(isGrillMenuItem(undefined)).toBe(false)
  })
})

describe('accompaniment registry options', () => {
  const t = (key) => ({ 'orders.accompWali': 'Wali (Rice)', 'orders.accompNone': 'None (as it is)' })[key] || key

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to the classic side dishes until the registry loads', () => {
    const options = fallbackAccompanimentOptions(t)
    expect(options.map((o) => o.value)).toEqual([
      'wali', 'ugali', 'chips', 'chapati', 'ndizi', 'maharage',
    ])
    expect(options[0]).toEqual({ value: 'wali', label: 'Wali (Rice)' })
  })

  it('maps active registry rows to name/value options for the department', async () => {
    menuAccompanimentApi.index.mockResolvedValueOnce({
      data: { data: [{ name: 'Wali' }, { name: 'Ndizi' }] },
    })
    const options = await loadAccompanimentOptions('restaurant', { force: true })
    expect(options).toEqual([
      { value: 'Wali', label: 'Wali' },
      { value: 'Ndizi', label: 'Ndizi' },
    ])
    expect(menuAccompanimentApi.index).toHaveBeenCalledWith({
      department: 'restaurant',
      is_active: true,
    })
  })

  it('keeps restaurant and bar registries separate', async () => {
    menuAccompanimentApi.index
      .mockResolvedValueOnce({ data: { data: [{ name: 'Wali' }] } })
      .mockResolvedValueOnce({ data: { data: [{ name: 'Bitters' }] } })

    const restaurant = await loadAccompanimentOptions('restaurant', { force: true })
    const bar = await loadAccompanimentOptions('bar', { force: true })

    expect(restaurant).toEqual([{ value: 'Wali', label: 'Wali' }])
    expect(bar).toEqual([{ value: 'Bitters', label: 'Bitters' }])
    expect(menuAccompanimentApi.index).toHaveBeenNthCalledWith(1, {
      department: 'restaurant',
      is_active: true,
    })
    expect(menuAccompanimentApi.index).toHaveBeenNthCalledWith(2, {
      department: 'bar',
      is_active: true,
    })
  })

  it('returns null when the registry cannot be fetched (caller keeps fallback)', async () => {
    menuAccompanimentApi.index.mockRejectedValueOnce(new Error('offline'))
    await expect(loadAccompanimentOptions('restaurant', { force: true })).resolves.toBeNull()
  })
})

describe('accompaniment department permissions', () => {
  it('lets admins, managers and kitchen manage sides', () => {
    for (const role of ['superadmin', 'hotel_admin', 'manager', 'kitchen']) {
      expect(canManageAccompaniments(role)).toBe(true)
    }
  })

  it('lets cashiers and bartenders manage their own sides', () => {
    expect(canManageAccompaniments('cashier')).toBe(true)
    expect(canManageAccompaniments('bartender')).toBe(true)
  })

  it('never lets unrelated roles manage sides', () => {
    for (const role of ['waiter', 'staff', 'receptionist', undefined, null]) {
      expect(canManageAccompaniments(role)).toBe(false)
    }
  })

  it('pins cashiers to the restaurant and bartenders to the bar', () => {
    expect(lockedAccompanimentDepartment('cashier')).toBe('restaurant')
    expect(lockedAccompanimentDepartment('bartender')).toBe('bar')
    expect(lockedAccompanimentDepartment('manager')).toBe('')
    expect(lockedAccompanimentDepartment('hotel_admin')).toBe('')
  })

  it('normalises stray department values to restaurant', () => {
    expect(normalizeDepartment('bar')).toBe('bar')
    expect(normalizeDepartment('restaurant')).toBe('restaurant')
    expect(normalizeDepartment(undefined)).toBe('restaurant')
    expect(normalizeDepartment('kitchen')).toBe('restaurant')
  })
})