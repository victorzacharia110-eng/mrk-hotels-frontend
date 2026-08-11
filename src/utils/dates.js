/**
 * Date helpers for the booking forms.
 *
 * Everything works on plain `YYYY-MM-DD` strings, which is what `<input
 * type="date">` produces and what the API expects. Arithmetic goes through UTC
 * so a booking never shifts by a day for guests in another timezone.
 */

/**
 * Today as `YYYY-MM-DD` in the browser's local timezone.
 * @returns {string} Today's date string.
 */
export function todayISO() {
  const now = new Date()
  // Shift by the timezone offset so toISOString keeps the local calendar day.
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/**
 * Adds a whole number of days to a `YYYY-MM-DD` string.
 * @param {string} date - Date in YYYY-MM-DD form.
 * @param {number} days - Number of days to add (may be negative).
 * @returns {string} The shifted date, or '' for invalid input.
 */
export function addDays(date, days) {
  if (!date) return ''
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return ''
  parsed.setUTCDate(parsed.getUTCDate() + Number(days || 0))
  return parsed.toISOString().slice(0, 10)
}

/**
 * Whole nights between two dates. Never returns less than one, matching the
 * backend's minimum one-night stay.
 * @param {string} from - Check-in date (YYYY-MM-DD).
 * @param {string} to - Check-out date (YYYY-MM-DD).
 * @returns {number} Nights between the dates (0 on missing/invalid input).
 */
export function daysBetween(from, to) {
  if (!from || !to) return 0
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  // 86400000 ms = one day; round to absorb any DST/leap-second noise.
  const diff = Math.round((end - start) / 86400000)
  return diff > 0 ? diff : 0
}

/**
 * Formats an ISO timestamp for table cells.
 * @param {string} value - ISO timestamp string.
 * @returns {string} 'YYYY-MM-DD HH:MM', or an em dash when empty.
 */
export function formatDateTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '—'
}
