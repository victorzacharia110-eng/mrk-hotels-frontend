/**
 * Number formatting helpers for report tables.
 *
 * The wired report engine sends plain numbers for counts and quantities
 * (rows, payments, pax, night counts, ...) alongside money columns. Money is
 * formatted by the caller's currency helper, but everything else used to be
 * dropped through `String(value)`, so 1500 read as "1500" instead of "1,500".
 * These helpers add the thousands separators while leaving identifier-style
 * values (room numbers, references, years) untouched.
 */

// Column keys that hold an identifier, not a countable amount. Grouping a room
// number ("1,205") or a year ("2,026") would be wrong, so they are exempt.
const IDENTIFIER_KEYS = new Set(['room', 'year', 'id', 'booking_reference', 'reference', 'ip', 'contact', 'phone'])

/**
 * True when a column key holds an identifier rather than a countable amount.
 * @param {string|null|undefined} key - Column key.
 * @returns {boolean}
 */
export function isIdentifierKey(key) {
  if (!key) return false
  const k = String(key).toLowerCase()
  return (
    IDENTIFIER_KEYS.has(k) ||
    k.endsWith('_id') ||
    k.endsWith('_ref') ||
    k.endsWith('_reference') ||
    k.endsWith('_number') ||
    k.includes('phone') ||
    k.includes('contact')
  )
}

/**
 * Formats a plain (non-money) number with thousands separators, e.g.
 * 1500 => "1,500" and 1234.5 => "1,234.5". Non-numbers and identifier keys
 * are returned unchanged as a string.
 * @param {*} value - Raw cell value.
 * @param {string|null} [key] - Column key, used to skip identifiers.
 * @returns {string}
 */
export function formatNumber(value, key = null) {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  if (!Number.isFinite(n)) return String(value)
  if (isIdentifierKey(key)) return String(value)
  return n.toLocaleString('en', { maximumFractionDigits: 2 })
}
