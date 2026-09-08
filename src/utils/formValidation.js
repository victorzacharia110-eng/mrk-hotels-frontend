/**
 * Tiny client-side form validator shared across pages.
 *
 * Rules are plain functions that take the field's value (plus the whole form,
 * for cross-field checks) and return a localized message — or '' when the
 * value is fine. They mirror the backend rules field for field, so the client
 * sees the exact reason before anything is even sent.
 */

import { validatePhoneNumber } from '@/utils/phone'

export const isBlank = (v) => v == null || String(v).trim() === ''

/**
 * Runs a rules list against a form and returns the first failing message per
 * field, e.g. { first_name: 'This field is required.' }.
 * @param {object} form - The form model (v-model bound object).
 * @param {Array<{field: string, check: (value, form) => string}>} rules
 * @returns {Record<string, string>} Field -> localized message.
 */
export function collectErrors(form, rules) {
  const errors = {}
  for (const { field, check } of rules) {
    if (errors[field]) continue
    const message = check(form[field], form)
    if (message) errors[field] = message
  }
  return errors
}

/** Friendly empty-state message — polite even though the field is required. */
export function required(t) {
  return (v) => (isBlank(v) ? t('validations.fieldRequired') : '')
}

/** Empty or a well-formed email. */
export function email(t) {
  return (v) =>
    isBlank(v) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())
      ? ''
      : t('validations.invalidEmail')
}

/** Blank is left to required(); anything typed is judged by the dialling plan. */
export function phone(t) {
  return (v, form) => {
    if (isBlank(v)) return ''
    const res = validatePhoneNumber(v, form.country_code || 'TZ')
    if (res.valid) return ''
    return res.reason === 'too_long' ? t('validations.phoneTooLong') : t('validations.phoneInvalid')
  }
}

/** Another value must come earlier than the field (e.g. departure > arrival). */
export function after(t, otherField) {
  return (v, form) => {
    if (isBlank(v) || isBlank(form[otherField])) return ''
    return v < form[otherField] ? t('validations.dateOrder') : ''
  }
}

/** Empty, or a positive-or-zero integer (adults, children). */
export function minInteger(t, min = 1) {
  return (v) => {
    if (v == null || v === '') return ''
    const n = Number(v)
    return Number.isInteger(n) && n >= min ? '' : t('validations.invalidNumber')
  }
}

/** Empty, or a number that may not be negative (money fields). */
export function nonNegative(t) {
  return (v) => {
    if (v == null || v === '') return ''
    return Number.isNaN(Number(v)) || Number(v) < 0 ? t('validations.notNegative') : ''
  }
}

/** Empty, or an amount that must be greater than zero (payments). */
export function positive(t) {
  return (v) => {
    if (v == null || v === '') return ''
    return Number.isNaN(Number(v)) || Number(v) <= 0 ? t('validations.positiveAmount') : ''
  }
}