/*
  Chart maths for the report browser, kept out of the component so it can be
  tested without a canvas.

  The report browser renders every report through one generic engine
  (columns + rows), so a report has no idea what its numbers mean. These
  functions read the same payload and work out what is worth plotting.

  The rules exist because the alternative is a confident wrong chart:
  * band rows (category / subcategory / grand total) are never charted as if
    they were line items — they would double-count the figures;
  * a metric is only offered when at least one real row carries a finite
    number for it, so a text-only report renders nothing at all;
  * cells that are not numbers are skipped, never plotted as zero.
*/

/** Column keys that read as a row's identity rather than a measurement. */
export const LABEL_HINTS = [
  'item', 'date', 'time', 'day', 'name', 'category', 'department', 'account',
  'user', 'staff', 'type', 'shift', 'terminal', 'table', 'room', 'guest',
  'supplier', 'reason', 'payment', 'method', 'order_number', 'invoice',
]

/** Measurement keys worth plotting first, in priority order. */
export const METRIC_HINTS = [
  'amount', 'total_amount', 'final_total', 'net_amount', 'gross', 'revenue',
  'sales', 'value', 'cost', 'price', 'quantity', 'qty', 'count', 'margin',
]

/** Label keys whose rows are a time series, which reads better as a line. */
const TIME_HINTS = ['date', 'time', 'day', 'month', 'week', 'hour', 'year']

/** Reads a cell as a finite number, or null when it is not one. */
export function num(v) {
  if (v === null || v === undefined || v === '' || Array.isArray(v)) return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '')
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Only real line items — band rows would double-count the totals. */
export function lineRows(rows) {
  return (rows || []).filter((r) => r && !r.band)
}

/** The column that names each row: the first identity-looking column. */
export function pickLabelKey(columns) {
  const cols = columns || []
  const keys = cols.map((c) => String(c?.key || '').toLowerCase())
  const hinted = keys.findIndex((k) => LABEL_HINTS.some((h) => k === h || k.includes(h)))
  return cols[hinted > -1 ? hinted : 0]?.key ?? null
}

/**
 * The columns worth plotting, best first. A column qualifies only when a real
 * row actually carries a number for it.
 */
export function pickMetrics(columns, rows, labelKey) {
  const real = lineRows(rows)
  if (!real.length) return []

  const usable = (columns || []).filter((col) => {
    const key = col?.key
    if (!key || key === labelKey) return false
    return real.some((r) => num(r[key]) !== null)
  })
  if (!usable.length) return []

  const rank = (c) => {
    const k = String(c.key).toLowerCase()
    const i = METRIC_HINTS.findIndex((h) => k === h || k.includes(h))
    return i === -1 ? METRIC_HINTS.length : i
  }

  return usable
    .map((c) => ({ key: c.key, label: c.label, format: c.format }))
    .sort((a, b) => rank(a) - rank(b))
}

/** One plottable point per row that has a number for the chosen metric. */
export function buildEntries({ rows, labelKey, activeKey, unnamedLabel = '' }) {
  if (!activeKey) return []

  return lineRows(rows)
    .map((r, i) => {
      const value = num(r[activeKey])
      if (value === null) return null
      const raw = labelKey ? r[labelKey] : null
      const label =
        raw === null || raw === undefined || raw === ''
          ? unnamedLabel
          : Array.isArray(raw)
            ? raw.join(', ')
            : String(raw)
      return { key: `${activeKey}-${i}`, label, value }
    })
    .filter(Boolean)
}

/**
 * Orders points biggest-first and folds the tail away past `limit`.
 *
 * Bars read by magnitude, so a category chart is sorted. A line chart is not —
 * it has to keep the row order the report gave it, or the trend it exists to
 * show becomes a zigzag — so `sort` is the caller's decision.
 */
export function shapeEntries(entries, limit = 12, { sort = true } = {}) {
  const list = sort ? [...entries].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) : [...entries]
  return list.slice(0, Math.max(1, limit))
}

/** A date/time label is a series over time, which reads better as a line. */
export function suggestType(labelKey) {
  const k = String(labelKey || '').toLowerCase()
  return TIME_HINTS.some((h) => k === h || k.includes(h)) ? 'line' : 'bar'
}
