import { describe, it, expect } from 'vitest'
import { formatNumber, isIdentifierKey } from '@/utils/numbers'

describe('formatNumber', () => {
  it('groups thousands on integers', () => {
    expect(formatNumber(1500)).toBe('1,500')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('keeps up to two decimals and drops trailing zeros', () => {
    expect(formatNumber(2500.5)).toBe('2,500.5')
    expect(formatNumber(1000.25)).toBe('1,000.25')
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('leaves small numbers unchanged', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('never groups identifier keys (rooms, references, years)', () => {
    expect(formatNumber(1205, 'room')).toBe('1205')
    expect(formatNumber(2026, 'year')).toBe('2026')
    expect(formatNumber(1500, 'booking_reference')).toBe('1500')
    expect(formatNumber(1500, 'order_id')).toBe('1500')
  })

  it('passes through non-numeric values untouched', () => {
    expect(formatNumber('Deluxe', 'room')).toBe('Deluxe')
    expect(formatNumber(null)).toBe('null')
    expect(formatNumber('')).toBe('')
  })
})

describe('isIdentifierKey', () => {
  it('flags identifier-style keys', () => {
    expect(isIdentifierKey('room')).toBe(true)
    expect(isIdentifierKey('year')).toBe(true)
    expect(isIdentifierKey('guest_id')).toBe(true)
    expect(isIdentifierKey('booking_reference')).toBe(true)
    expect(isIdentifierKey('contact_phone')).toBe(true)
  })

  it('leaves quantity-style keys groupable', () => {
    expect(isIdentifierKey('quantity')).toBe(false)
    expect(isIdentifierKey('pax')).toBe(false)
    expect(isIdentifierKey('covers')).toBe(false)
    expect(isIdentifierKey('nights')).toBe(false)
    expect(isIdentifierKey(null)).toBe(false)
  })
})
