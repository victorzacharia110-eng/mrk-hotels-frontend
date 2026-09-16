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