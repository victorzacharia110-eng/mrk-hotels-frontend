/**
 * Turning an audit row into a readable "what changed" list.
 *
 * An audit row carries the whole record before and after the edit, so the useful
 * part is the difference between the two snapshots: a price change should read as
 * one line, not as the entire dish printed twice. Shared by the menu history
 * drawer and the menu activity page so a change reads identically in both.
 */

/**
 * Database column names arrive as raw keys. These are the ones a manager would
 * recognise; anything else falls back to a readable form, so a new column shows
 * up as "new column" rather than as raw snake_case.
 */
const FIELD_LABELS = {
  item_name: 'menuAudit.fields.name',
  name: 'menuAudit.fields.name',
  description: 'menuAudit.fields.description',
  price: 'menuAudit.fields.price',
  cost: 'menuAudit.fields.cost',
  is_available: 'menuAudit.fields.available',
  department: 'menuAudit.fields.department',
  category_id: 'menuAudit.fields.category',
  sub_category_id: 'menuAudit.fields.subCategory',
  sort_order: 'menuAudit.fields.sortOrder',
  is_active: 'menuAudit.fields.active',
}

/** Plain decimal, the only string shape allowed to compare equal to a number. */
const DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * Compares two snapshot values for "this field did not move".
 *
 * Prices come back off the decimal cast as strings ("5000.00") while a caller may
 * hand back a number, and those are the same price. null and undefined mean the
 * same thing: the field was absent from that side of the snapshot.
 *
 * The numeric comparison is deliberately narrow. Number() would also read '1e3'
 * as 1000 and ' 12 ' as 12, so a text field whose value merely looks numeric --
 * a dish called "1e3" -- would be reported as unchanged when it was not. Only a
 * real number compared against a plain decimal string qualifies.
 *
 * @param {*} a - Value in the old snapshot.
 * @param {*} b - Value in the new snapshot.
 * @returns {boolean} True when the two values are equivalent.
 */
export function sameValue(a, b) {
  if (a === b) return true
  if ((a ?? null) === (b ?? null)) return true

  const numericPair =
    (typeof a === 'number' && typeof b === 'string' && DECIMAL.test(b)) ||
    (typeof b === 'number' && typeof a === 'string' && DECIMAL.test(a))

  if (numericPair) return Number(a) === Number(b)

  return false
}

/**
 * Formats a snapshot value for display.
 *
 * @param {*} value - Raw value from the snapshot.
 * @param {Function} t - Translation function, for booleans.
 * @returns {string|null} Display string, or null when there was nothing there.
 */
export function readableValue(value, t) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * The fields that actually moved in one audit row.
 *
 * A create has no old snapshot and a delete has no new one, so everything on the
 * side that exists counts as changed.
 *
 * @param {object} entry - An audit row with old_values / new_values.
 * @param {Function} t - Translation function.
 * @returns {Array<{field: string, label: string, before: string|null, after: string|null}>} Changed fields.
 */
export function diffFields(entry, t) {
  const before = entry.old_values || {}
  const after = entry.new_values || {}
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])

  return [...fields]
    .filter((field) => !sameValue(before[field], after[field]))
    .map((field) => ({
      field,
      label: fieldLabel(field, t),
      before: readableValue(before[field], t),
      after: readableValue(after[field], t),
    }))
}

/**
 * Human label for a snapshot column name.
 *
 * @param {string} field - Column name from the snapshot.
 * @param {Function} t - Translation function.
 * @returns {string} Translated label, or a readable fallback.
 */
export function fieldLabel(field, t) {
  const key = FIELD_LABELS[field]
  // t() echoes the key back when a translation is missing, which is the signal
  // to fall through to the generic formatting.
  if (key && t(key) !== key) return t(key)
  return field.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}