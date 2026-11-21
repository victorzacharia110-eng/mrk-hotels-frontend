/**
 * Shared string/format helpers for the UI.
 */

/**
 * Formats a category code for display: snake/hyphen-separated words become a
 * Title Case label with a capital first letter ("food_beverage" => "Food
 * Beverage", "bar" => "Bar").
 * @param {string|undefined|null} value - Category code to format.
 * @returns {string} Display label.
 */
export function formatCategory(value) {
  if (!value) return ''
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Capitalizes the first letter of a string for display/save.
 * @param {string} value - Raw string.
 * @returns {string} String with a leading capital letter.
 */
export function capitalizeFirst(value) {
  if (!value) return ''
  const str = String(value).trim()
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function avatarUrl(value) {
  if (!value) return ''
  const raw = String(value)
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`

  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
  const path = raw.replace(/^\/?(?:storage\/)?/, 'storage/')
  return base ? `${base}/${path}` : `/${path}`
}
