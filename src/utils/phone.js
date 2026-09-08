/**
 * Phone number helpers built on libphonenumber-js.
 *
 * formatPhoneInput() pretty-prints while the user types; the cap/sanitize
 * helpers enforce that a field can only ever grow to the length the selected
 * country's dialling plan allows, and validatePhoneNumber() produces the
 * strict E.164 verdict. Both default to Tanzania (TZ), the hotel chain's
 * home market.
 */

import {
  formatIncompletePhoneNumber,
  parsePhoneNumberFromString,
  getCountryCallingCode,
  isSupportedCountry,
  Metadata,
} from 'libphonenumber-js'

// Fallback country for numbers typed without an international prefix.
const DEFAULT_COUNTRY = 'TZ'

// ITU-T E.164 sets a hard ceiling of 15 significant digits for any number.
const MAX_E164_DIGITS = 15

const nationalLengthCache = {}

/**
 * Longest national number (without the country code) the given country's
 * metadata allows, cached per country. Falls back to the E.164 ceiling when
 * the country is unknown to keep the gate from ever blocking valid input.
 * @param {string} countryCode - ISO country code.
 * @returns {number} Maximum national-number length in digits.
 */
function maxNationalLength(countryCode) {
  if (nationalLengthCache[countryCode] != null) return nationalLengthCache[countryCode]
  let max = MAX_E164_DIGITS
  try {
    const metadata = new Metadata()
    metadata.country(countryCode)
    const lengths = metadata.possibleLengths ? metadata.possibleLengths() : []
    if (lengths.length) max = Math.max(...lengths)
  } catch {
    // Unknown country — stay permissive at typing time; validation still gates.
  }
  nationalLengthCache[countryCode] = max
  return max
}

/**
 * Longest number (in digits, excluding the '+' sign) the selected country can
 * ever represent: country code + longest national number, never more than the
 * E.164 ceiling.
 * @param {string} [countryCode] - ISO country used to size the field.
 * @returns {number} Maximum digit count including the country code.
 */
export function maxPhoneLength(countryCode = DEFAULT_COUNTRY) {
  const cc = isSupportedCountry(countryCode) ? countryCode : DEFAULT_COUNTRY
  const callingCode = String(getCountryCallingCode(cc)).length
  return Math.min(MAX_E164_DIGITS, callingCode + maxNationalLength(cc))
}

/**
 * Strips every character that no dialling plan accepts: only an optional
 * leading '+' followed by digits survives. Letters and special characters are
 * simply never allowed into the field.
 * @param {string} value - Raw input from the phone field.
 * @returns {string} The sanitized value ('+', digits, or empty).
 */
export function sanitizePhoneInput(value) {
  let phone = String(value || '').trim()
  // A leading 00 is the international dialling prefix in many countries.
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`
  // Drop everything that is not a digit or the leading plus sign.
  phone = phone.replace(/[^+\d]/g, '')
  if (String(value || '').trim() && !phone.startsWith('+') && phone.includes('+')) {
    // No stray plus signs in the middle of a local number.
    phone = phone.replace(/\+/g, '')
  }
  return phone
}

/**
 * Caps a partially typed number at the length the selected country supports.
 * A local number never exceeds the national length (plus one digit for a trunk
 * prefix); an international one never exceeds the E.164 ceiling. Anything past
 * the cap is truncated, so extra digits "must not exist".
 * @param {string} value - Raw input from the phone field.
 * @param {string} [countryCode] - ISO country used to size the field.
 * @returns {string} The sanitized, length-capped value.
 */
export function capPhoneInput(value, countryCode = DEFAULT_COUNTRY) {
  const phone = sanitizePhoneInput(value)
  if (!phone || phone === '+') return phone
  if (phone.startsWith('+')) {
    return phone.length - 1 > MAX_E164_DIGITS ? `+${phone.slice(1, MAX_E164_DIGITS + 1)}` : phone
  }

  const nationalMax = maxNationalLength(countryCode)
  const callingCode = isSupportedCountry(countryCode) ? String(getCountryCallingCode(countryCode)) : ''

  // The user may be typing a full international number without the '+'
  // (e.g. "255674734747" on a TZ field) — size the cap for that too.
  if (callingCode && phone.startsWith(callingCode)) {
    const maxIntl = Math.min(MAX_E164_DIGITS, callingCode.length + nationalMax)
    return phone.length > maxIntl ? phone.slice(0, maxIntl) : phone
  }

  // Plain national number: national length plus one digit for a trunk prefix.
  const maxLocal = nationalMax + 1
  return phone.length > maxLocal ? phone.slice(0, maxLocal) : phone
}

/**
 * Formats a Tanzania phone with the gap style the front desk asked for:
 * `255 6747 347 47` (country code, then 4-3-2 for a 12-digit E.164 number). A
 * local 0-prefixed number becomes `0674 734 747`. Numbers that do not match
 * either plan are returned untouched so no input is ever mangled.
 * @param {string} value - Phone number as typed or stored.
 * @returns {string} The number with digit-group gaps, or the input unchanged.
 */
export function formatPhoneGaps(value) {
  if (!value) return ''

  const digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length === 12) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 10)} ${digits.slice(10, 12)}`
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`
  }
  return String(value)
}

/**
 * Splits a digit string into chunks of the given sizes (left to right),
 * joining them with the gap style used on the front desk. Stops when the
 * digits run out, so a partial number is grouped progressively as typing
 * moves along.
 * @param {string} digits - The digits to group.
 * @param {number[]} sizes - Chunk sizes from the left.
 * @returns {string} Digits joined with single spaces, e.g. '0674 734 747'.
 */
function groupDigits(digits, sizes) {
  const parts = []
  let index = 0
  for (const size of sizes) {
    if (index >= digits.length) break
    parts.push(digits.slice(index, index + size))
    index += size
  }
  return parts.join(' ')
}

/**
 * Formats a partially typed phone number for display, applying the spacing of
 * the given country's dialling conventions without demanding a valid number.
 *
 * Tanzanian numbers follow the gap style the front desk asked for, applied
 * digit by digit as they are typed: a local 0-prefixed number becomes
 * `0674 734 747` (4-3-3) and an international one `255 6747 347 47`
 * (3-4-3-2). Every other country falls back to libphonenumber's own partial
 * formatting.
 * @param {string} value - Sanitized (or raw) input from the phone field.
 * @param {string} [defaultCountry] - ISO country used when no + prefix is typed.
 * @returns {string} The formatted partial number.
 */
export function formatPhoneInput(value, defaultCountry = DEFAULT_COUNTRY) {
  if (!value) return ''

  let phone = String(value).trim()
  // A leading 00 is the international dialling prefix in many countries.
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`
  }
  // Drop everything that is not a digit or the leading plus sign.
  phone = phone.replace(/[^+\d]/g, '')

  // libphonenumber cannot format a bare plus sign; keep it as typed.
  if (phone === '+') {
    return '+'
  }

  const intl = phone.startsWith('+')
  const digits = intl ? phone.slice(1) : phone
  if (defaultCountry === 'TZ') {
    if (intl && digits.startsWith('255')) {
      return `+${groupDigits(digits, [3, 4, 3, 2])}`
    }
    if (!intl && digits.startsWith('0')) {
      return groupDigits(digits, [4, 3, 3])
    }
  }

  return formatIncompletePhoneNumber(phone, defaultCountry)
}

/**
 * Strictly validates a phone number against the given country's dialling plan.
 * @param {string} value - Phone number as entered.
 * @param {string} [defaultCountry] - ISO country used when no + prefix is given.
 * @returns {{ valid: boolean, possible: boolean, number: string, reason: 'valid'|'too_long'|'invalid' }}
 *   - valid: the number is fully valid for its country.
 *   - possible: it has a plausible length (but may be an unassigned number).
 *   - number: the E.164 form when valid, otherwise the cleaned input.
 *   - reason: why the number is not valid ('too_long' vs 'invalid'), or 'valid'.
 *
 * This helper is intentionally message-free — callers translate the reason
 * into the user's language (en/sw), so validation text never leaks English.
 */
export function validatePhoneNumber(value, defaultCountry = DEFAULT_COUNTRY) {
  const empty = { valid: false, possible: false, number: '', reason: 'invalid' }
  if (!value) return empty

  let phone = String(value).trim()
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`
  phone = phone.replace(/[^+\d]/g, '')
  if (!phone) return empty

  const country = /^[A-Za-z]{2}$/.test(defaultCountry) ? defaultCountry : DEFAULT_COUNTRY
  const parsed = phone.startsWith('+')
    ? parsePhoneNumberFromString(phone)
    : parsePhoneNumberFromString(phone, country)

  if (!parsed) return { ...empty, number: phone }

  if (parsed.isValid()) return { valid: true, possible: true, number: parsed.number, reason: 'valid' }
  return {
    valid: false,
    possible: parsed.isPossible(),
    number: phone,
    reason: parsed.isPossible() ? 'invalid' : 'too_long',
  }
}

/**
 * Normalizes a phone number to E.164 for storage (e.g. +255700000000).
 * Numbers without a + prefix are parsed against the default country; anything
 * unparseable or over-length comes back as an empty string so no invalid value
 * is ever persisted.
 * @param {string} value - Phone number as typed by the user.
 * @param {string} [defaultCountry] - ISO country used when no + prefix is given.
 * @returns {string} The E.164 number, or '' when the input is invalid.
 */
export function normalizePhoneNumber(value, defaultCountry = DEFAULT_COUNTRY) {
  const res = validatePhoneNumber(value, defaultCountry)
  return res.valid ? res.number : ''
}