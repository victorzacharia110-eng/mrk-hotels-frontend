import { describe, expect, it } from 'vitest'
import {
  capPhoneInput,
  formatPhoneGaps,
  formatPhoneInput,
  formatPhoneNational,
  maxPhoneLength,
  normalizePhoneNumber,
  validatePhoneNumber,
} from '@/utils/phone'

describe('capPhoneInput', () => {
  it('keeps only digits (no letters/symbols)', () => {
    expect(capPhoneInput('0789abc 23__089', 'TZ')).toBe('78923089')
  })

  it('strips a leading trunk 0 on a preselected-country field', () => {
    expect(capPhoneInput('0789230899', 'TZ')).toBe('789230899')
  })

  it('caps a national number at the country national length', () => {
    expect(capPhoneInput('78923089912345', 'TZ')).toHaveLength(9)
  })

  it('accepts a full international number and sizes it to the E.164 ceiling', () => {
    const capped = capPhoneInput('255674734747', 'TZ')
    expect(capped).toBe('255674734747')
    expect(capPhoneInput('+255674734747', 'TZ')).toBe('+255674734747')
  })
})

describe('formatPhoneInput', () => {
  it('gaps TZ national digits as each digit arrives (4-3-2)', () => {
    expect(formatPhoneInput('0789230899', 'TZ')).toBe('7892 308 99')
    expect(formatPhoneInput('078923089', 'TZ')).toBe('7892 308 9')
    expect(formatPhoneInput('0674', 'TZ')).toBe('674')
  })

  it('sheds a pasted country code back to a national number', () => {
    expect(formatPhoneInput('255674734747', 'TZ')).toBe('6747 347 47')
  })

  it('keeps the + and gaps an international TZ number (3-4-3-2)', () => {
    expect(formatPhoneInput('+255674734747', 'TZ')).toBe('+255 6747 347 47')
    expect(formatPhoneInput('+2556747347474', 'TZ')).toBe('+255 6747 347 47 4')
  })

  it('preserves a bare plus sign', () => {
    expect(formatPhoneInput('+', 'TZ')).toBe('+')
  })
})

describe('formatPhoneNational / formatPhoneGaps', () => {
  it('converts stored E.164 back to the national number shown in the field', () => {
    expect(formatPhoneNational('+255674734747')).toBe('6747 347 47')
    expect(formatPhoneNational('255674734747')).toBe('6747 347 47')
    expect(formatPhoneNational('')).toBe('')
  })

  it('keeps the international gap style for tabled display', () => {
    expect(formatPhoneGaps('255674734747')).toBe('255 6747 347 47')
  })
})

describe('maxPhoneLength', () => {
  it('sizes TZ field to country code + national length', () => {
    expect(maxPhoneLength('TZ')).toBe(12)
    expect(maxPhoneLength('--')).toBe(12)
  })
})

describe('validatePhoneNumber', () => {
  it('accepts a valid TZ national number (no leading 0 typed)', () => {
    const res = validatePhoneNumber('674734747', 'TZ')
    expect(res.valid).toBe(true)
    expect(res.number).toBe('+255674734747')
  })

  it('normalizes a valid TZ number to E.164', () => {
    expect(normalizePhoneNumber('6747 347 47', 'TZ')).toBe('+255674734747')
  })

  it('rejects nonsense input with a reason', () => {
    const res = validatePhoneNumber('abcz', 'TZ')
    expect(res.valid).toBe(false)
    expect(['too_long', 'invalid']).toContain(res.reason)
  })
})