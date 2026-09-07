/**
 * Phone number helpers built on libphonenumber-js.
 *
 * formatPhoneInput() pretty-prints while the user types;
 * normalizePhoneNumber() produces the E.164 value stored on records. Both
 * default to Tanzania (TZ), the hotel chain's home market.
 */

import { formatIncompletePhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'

// Fallback country for numbers typed without an international prefix.
const DEFAULT_COUNTRY = 'TZ'

/**
 * Formats a partially typed phone number for display, applying the spacing of
 * the given country's dialling conventions without demanding a valid number.
 * @param {string} value - Raw input from the phone field.
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

  return formatIncompletePhoneNumber(phone, defaultCountry)
}

/**
 * Normalizes a phone number to E.164 for storage (e.g. +255700000000).
 * Numbers without a + prefix are parsed against the default country; anything
 * unparseable comes back cleaned but unchanged, so no user input is lost.
 * @param {string} value - Phone number as typed by the user.
 * @param {string} [defaultCountry] - ISO country used when no + prefix is given.
 * @returns {string} The E.164 number, or the cleaned input when invalid.
 */
export function normalizePhoneNumber(value, defaultCountry = DEFAULT_COUNTRY) {
  if (!value) return ''

  let phone = String(value).trim()
  // A leading 00 is the international dialling prefix in many countries.
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`
  }
  // Drop everything that is not a digit or the leading plus sign.
  phone = phone.replace(/[^+\d]/g, '')

  if (!phone) return ''
  // Local number: parse it under the default country's dialling plan.
  if (!phone.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry)
    return parsed?.isValid() ? parsed.number : phone
  }

  // Already international: the number carries its own country code.
  const parsed = parsePhoneNumberFromString(phone)
  return parsed?.isValid() ? parsed.number : phone
}

/**
 * Formats a Tanzania phone with the gap style the front desk asked for:
 * `255 6747 347 477` (country code, then 4-3-3). A local 0-prefixed number
 * becomes `0674 734 747`. Numbers that do not match either plan are returned
 * untouched so no input is ever mangled.
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
