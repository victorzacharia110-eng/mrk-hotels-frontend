import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { diffFields, sameValue, readableValue, fieldLabel } from '@/utils/auditDiff'

/**
 * Stands in for vue-i18n's t(): returns the key when a translation is missing,
 * which is exactly the signal fieldLabel() uses to fall back.
 */
const t = (key) => (TRANSLATIONS[key] ?? key)
const TRANSLATIONS = {
  'menuAudit.fields.name': 'Name',
  'menuAudit.fields.price': 'Price',
  'common.yes': 'Yes',
  'common.no': 'No',
}

describe('sameValue', () => {
  it('treats a missing value as equal to null on the other side', () => {
    // A create has no old snapshot, so every key is absent on one side only.
    expect(sameValue(undefined, null)).toBe(true)
    expect(sameValue(null, undefined)).toBe(true)
  })

  it('compares numeric strings by value, not by text', () => {
    // Prices come back off the decimal cast as strings; a caller may hand back a
    // number. "5000.00" and 5000 are the same price and must not read as an edit.
    expect(sameValue('5000.00', 5000)).toBe(true)
    expect(sameValue('0.10', 0.1)).toBe(true)
  })

  it('still reports a real price change', () => {
    expect(sameValue('5000.00', '6000.00')).toBe(false)
  })

  it('does not coerce unrelated strings to numbers', () => {
    // '1e3' would fold to 1000 under Number(); a dish called that must not
    // compare equal to 1000.
    expect(sameValue('1e3', 1000)).toBe(false)
    expect(sameValue('Soups', 'Grills')).toBe(false)
  })
})

describe('readableValue', () => {
  it('renders an absent value as null so the caller can show a placeholder', () => {
    expect(readableValue(null, t)).toBeNull()
    expect(readableValue(undefined, t)).toBeNull()
    expect(readableValue('', t)).toBeNull()
  })

  it('speaks booleans in words, not as true/false', () => {
    expect(readableValue(true, t)).toBe('Yes')
    expect(readableValue(false, t)).toBe('No')
  })

  it('keeps zero, which is a real price and not an absence', () => {
    expect(readableValue(0, t)).toBe('0')
    expect(readableValue('0.00', t)).toBe('0.00')
  })

  it('serialises a nested object rather than printing [object Object]', () => {
    expect(readableValue({ a: 1 }, t)).toBe('{"a":1}')
  })
})

describe('fieldLabel', () => {
  it('uses the translation when there is one', () => {
    expect(fieldLabel('price', t)).toBe('Price')
  })

  it('falls back to readable text for a column it has never seen', () => {
    // A new column on the model must read as "new column", not as raw snake_case.
    expect(fieldLabel('new_column', t)).toBe('New column')
  })
})

describe('diffFields', () => {
  it('shows only the field that moved on a price edit', () => {
    const fields = diffFields(
      {
        old_values: { item_name: 'Ugali na Samaki', price: '5000.00', is_available: 1 },
        new_values: { item_name: 'Ugali na Samaki', price: '6000.00', is_available: 1 },
      },
      t,
    )

    expect(fields).toHaveLength(1)
    expect(fields[0].label).toBe('Price')
    expect(fields[0].before).toBe('5000.00')
    expect(fields[0].after).toBe('6000.00')
  })

  it('treats everything on the new side as added for a create', () => {
    const fields = diffFields(
      { old_values: null, new_values: { item_name: 'Kuku wa Kukaanga', price: '8000.00' } },
      t,
    )

    expect(fields.map((f) => f.field).sort()).toEqual(['item_name', 'price'])
    expect(fields.every((f) => f.before === null)).toBe(true)
  })

  it('treats everything on the old side as removed for a delete', () => {
    const fields = diffFields(
      { old_values: { item_name: 'Kuku wa Kukaanga' }, new_values: null },
      t,
    )

    expect(fields).toHaveLength(1)
    expect(fields[0].before).toBe('Kuku wa Kukaanga')
    expect(fields[0].after).toBeNull()
  })

  it('reports nothing when an update changed no values', () => {
    // Saving the form without editing anything still writes an audit row; it
    // must not show up as a phantom change.
    const row = { item_name: 'Soups', price: '5000.00' }
    expect(diffFields({ old_values: { ...row }, new_values: { ...row } }, t)).toEqual([])
  })
})
describe('route guarding', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../router/index.js'),
    'utf8',
  )

  it('keeps the activity page behind the menu module guard', () => {
    // The router guard reads meta.module and checks it against the module's role
    // list. Drop that meta and the page would open to any signed-in user -- the
    // API would still refuse the data, but a blank, confusing page for a waiter is
    // not the same as being sent to their own dashboard.
    const line = source
      .split('\n')
      .find((l) => l.includes("name: 'hotel-menu-activity'"))

    expect(line).toBeTruthy()
    expect(line).toContain("meta: { module: 'menu' }")
  })
})
