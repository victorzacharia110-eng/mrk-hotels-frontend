import { describe, it, expect } from 'vitest'
import { GRILL_KEYWORDS, isGrillItemName, isGrillMenuItem } from '@/utils/menuAccompaniment'

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