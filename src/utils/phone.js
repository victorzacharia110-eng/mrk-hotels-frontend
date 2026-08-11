import { formatIncompletePhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'

const DEFAULT_COUNTRY = 'TZ'

export function formatPhoneInput(value, defaultCountry = DEFAULT_COUNTRY) {
  if (!value) return ''

  let phone = String(value).trim()
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`
  }
  phone = phone.replace(/[^+\d]/g, '')

  if (phone === '+') {
    return '+'
  }

  return formatIncompletePhoneNumber(phone, defaultCountry)
}

export function normalizePhoneNumber(value, defaultCountry = DEFAULT_COUNTRY) {
  if (!value) return ''

  let phone = String(value).trim()
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`
  }
  phone = phone.replace(/[^+\d]/g, '')

  if (!phone) return ''
  if (!phone.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry)
    return parsed?.isValid() ? parsed.number : phone
  }

  const parsed = parsePhoneNumberFromString(phone)
  return parsed?.isValid() ? parsed.number : phone
}
