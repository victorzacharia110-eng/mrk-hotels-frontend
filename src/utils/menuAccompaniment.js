/**
 * Shared "served with" logic for grill-style mains.
 *
 * Grill-style mains (mshikaki, nyama choma, kuku, samaki, grill, but also
 * broiler/roast/whole preparations such as "Broiler Fried (Quarter)") are
 * usually served with a side (wali, ugali, chips, chapati, ndizi, maharage).
 * POS ordering screens prompt the user to pick a side before such an item
 * lands on the ticket. Keeping the keyword logic in one place stops the
 * cashier and bartender new-order tabs from drifting apart.
 */

import { menuAccompanimentApi } from '../api'

/** Name keywords that mark a menu item as a grill-style main needing a side. */
export const GRILL_KEYWORDS = [
  'broiler',
  'broil',
  'grill',
  'roast',
  'whole',
  'mshikaki',
  'mishkaki',
  'choma',
  'kuku',
  'nyama',
  'samaki',
  'maini',
]

/** True when the raw name sounds like a grill-style main needing a side. */
export function isGrillItemName(name) {
  const n = String(name || '').toLowerCase()
  return GRILL_KEYWORDS.some((keyword) => n.includes(keyword))
}

/**
 * True when the given menu item (or menu_item_id resolved against `menuItems`)
 * is a grill-style main needing a side dish.
 */
export function isGrillMenuItem(idOrItem, menuItems = []) {
  let name = ''
  if (idOrItem && typeof idOrItem === 'object') {
    name = idOrItem.item_name || ''
  } else if (idOrItem !== null && idOrItem !== undefined) {
    const item = menuItems.find((mi) => String(mi.menu_item_id) === String(idOrItem))
    name = item?.item_name || ''
  }
  return isGrillItemName(name)
}

/**
 * The classic side-dish set shown until the hotel's accompaniment registry is
 * loaded (and as a fallback when the registry cannot be fetched). Mirrors the
 * original hard-coded prompt so the POS never shows an empty list.
 */
export function fallbackAccompanimentOptions(t) {
  return [
    { value: 'wali', label: t('orders.accompWali') },
    { value: 'ugali', label: t('orders.accompUgali') },
    { value: 'chips', label: t('orders.accompChips') },
    { value: 'chapati', label: t('orders.accompChapati') },
    { value: 'ndizi', label: t('orders.accompNdizi') },
    { value: 'maharage', label: t('orders.accompMaharage') },
  ]
}

/** Roles allowed to register/edit a department's accompaniments. */
export const ACCOMPANIMENT_MANAGER_ROLES = [
  'superadmin',
  'hotel_admin',
  'manager',
  'kitchen',
  'cashier',
  'bartender',
]

/** True when the role may manage at least one department's accompaniments. */
export function canManageAccompaniments(role) {
  return ACCOMPANIMENT_MANAGER_ROLES.includes(role)
}

/**
 * The single department a role is pinned to, or '' when it may manage both.
 * Cashiers own the restaurant, bartenders own the bar; admins, managers and
 * kitchen staff cover both sides.
 */
export function lockedAccompanimentDepartment(role) {
  if (role === 'cashier') return 'restaurant'
  if (role === 'bartender') return 'bar'
  return ''
}

/** Normalises an arbitrary value to 'restaurant' or 'bar'. */
export function normalizeDepartment(department) {
  return department === 'bar' ? 'bar' : 'restaurant'
}

/**
 * Loads one department's registered accompaniments as prompt options.
 *
 * Reads the per-hotel, per-department registry (the answer to "where are
 * accompaniments registered?") and maps each active row to
 * `{ value: name, label: name }`. The name doubles as the value so order lines
 * keep a readable snapshot. Cached per department so the waiter, cashier and
 * order-edit screens share one request each. Returns null on failure so callers
 * can keep their default fallback options.
 */
const accompCache = new Map()
const accompInflight = new Map()
export async function loadAccompanimentOptions(department = 'restaurant', { force = false } = {}) {
  const dept = normalizeDepartment(department)

  if (!force && accompCache.has(dept)) return accompCache.get(dept)
  if (accompInflight.has(dept)) return accompInflight.get(dept)

  const request = (async () => {
    try {
      const res = await menuAccompanimentApi.index({ department: dept, is_active: true })
      const list = res.data?.data ?? res.data ?? []
      const options = list.map((a) => ({ value: a.name, label: a.name }))
      accompCache.set(dept, options)
      return options
    } catch {
      return null
    } finally {
      accompInflight.delete(dept)
    }
  })()

  accompInflight.set(dept, request)
  return request
}