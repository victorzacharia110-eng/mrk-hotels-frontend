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

/** Blank is left to required(); anything typed is judged by the dialling plan.
 * A still-too-short number says nothing ("keep typing") — it must never
 * scream "too long" while the receptionist is in the middle of it. */
export function phone(t) {
  return (v, form) => {
    if (isBlank(v)) return ''
    const res = validatePhoneNumber(v, form.country_code || 'TZ')
    if (res.valid) return ''
    if (res.reason === 'too_short') return ''
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

/**
 * Wires a deep watcher so a form validates live: the moment its values differ
 * from the opening snapshot (first keystroke, date pick, room selection) the
 * per-field errors start updating on every change and keep clearing as the
 * user fixes each field. Pristine forms stay quiet until the user interacts.
 *
 * @param {Function} watchFn - Vue's watch.
 * @param {() => object} getForm - Getter returning the current form object.
 * @param {import('vue').Ref} snapshot - Opening-state snapshot ref (object).
 * @param {import('vue').Ref} touched - Dirty flag ref (false when opened).
 * @param {import('vue').Ref} errors - Per-field errors ref.
 * @param {() => Array} rules - Function returning the rules (fresh each run).
 * @param {string[] | ((form: object) => Array)} [comparable] - Optional field
 *   subset (or adjuster fn) to compare; pass for forms where computed values
 *   (e.g. an auto-suggested total) update on their own.
 */
export function bindLiveValidation(watchFn, getForm, snapshot, touched, errors, rules, comparable) {
  const snapshotOf = (value) => {
    const obj = value || {}
    if (!comparable) return obj
    return typeof comparable === 'function' ? comparable(obj) : comparable.map((key) => obj[key])
  }
  watchFn(
    getForm,
    () => {
      if (!touched.value) {
        if (JSON.stringify(snapshotOf(getForm())) === JSON.stringify(snapshotOf(snapshot.value))) return
        touched.value = true
      }
      errors.value = collectErrors(getForm(), rules())
    },
    { deep: true },
  )
}