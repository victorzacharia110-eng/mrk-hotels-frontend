/**
 * Ezee-faithful stock ledger formatters shared by the classic Reports →
 * Stock Ledger surface and the POS Report Browser's stock-ledger entry.
 *
 * The Ezee reference prints amounts like 24670.00 / 310366.00 (two decimals,
 * no thousands separators), every quantity carries the item's unit (2 BTL,
 * 98 BTL), timestamps read "2026-09-20 12:45:31 PM" and items are grouped
 * under uppercase category bands (DRINKS, FOOD, ...). Keeping the helpers in
 * one place guarantees both surfaces stay identical.
 */

/** Ledger money: always two decimals, no thousands separators (like Ezee). */
export function fmtLedgerMoney(value) {
  return Number(value || 0).toFixed(2)
}

/** Ledger quantity: whole numbers stay bare, fractions keep two decimals. */
export function fmtQty(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** " 2 BTL" -> Ezee shows the unit next to every quantity cell. */
export function unitSuffix(item) {
  return item.unit ? ' ' + item.unit : ''
}

/**
 * Renders a "YYYY-MM-DD HH:mm[:ss]" stamp as "YYYY-MM-DD hh:mm:ss AM" like
 * Ezee. Seconds are carried across when the source has them.
 */
export function fmtLedgerDateTime(str) {
  const parts = String(str || '').split(' ')
  if (parts.length < 2) return str || ''
  const [day, clock] = parts
  const [y, mo, d] = day.split('-').map(Number)
  const pieces = clock.split(':')
  const [h, mi, s] = [Number(pieces[0]), Number(pieces[1]), Number(pieces[2] || 0)]
  if (!y || !mo || !d || h == null || mi == null) return str || ''
  const dt = new Date(y, mo - 1, d, h, mi, s)
  if (Number.isNaN(dt.getTime())) return str || ''
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  return day + ' ' + time
}

/** Ezee transaction-type wording on the ledger rows. */
export function ledgerTypeLabel(type, t) {
  const map = {
    opening: 'ezOpening',
    sale: 'ezSale',
    received: 'ezReceived',
    wastage: 'ezWastage',
    transfer: 'ezTransfer',
    adjustment: 'ezAdjustment',
  }
  return t('reports.' + (map[type] || 'ezAdjustment'))
}

/** The category filter's display labels (mirrors the option list). */
export const LEDGER_CATEGORY_LABELS = {
  food: 'Food',
  beverage: 'Beverage',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
  procurement: 'Procurement',
  other: 'Other',
}

/** The inventory categories the backend accepts for the stock-ledger filter. */
export const INVENTORY_CATEGORIES = new Set(Object.keys(LEDGER_CATEGORY_LABELS))

/** Groups ledger items under Ezee-style category bands (DRINKS, FOOD, ...). */
export function buildLedgerGroups(items) {
  const groups = []
  const seen = new Map()
  for (const item of items || []) {
    const key = String(item.category || 'other').trim() || 'other'
    if (!seen.has(key)) {
      const group = {
        key,
        label: String(LEDGER_CATEGORY_LABELS[key] || key).toUpperCase(),
        items: [],
      }
      seen.set(key, group)
      groups.push(group)
    }
    seen.get(key).items.push(item)
  }
  return groups
}