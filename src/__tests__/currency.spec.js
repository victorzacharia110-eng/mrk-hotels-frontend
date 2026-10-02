import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { currencyCode, formatMoney, useTenantCurrency, DEFAULT_CURRENCY } from '@/utils/currency'
import { useAuthStore } from '@/stores/auth'

const authWith = (tenant) => ({ user: { tenant } })

describe('tenant currency code', () => {
  it('falls back to the platform default when nobody is signed in', () => {
    expect(currencyCode(undefined)).toBe('TZS')
    expect(currencyCode({ user: null })).toBe('TZS')
    expect(DEFAULT_CURRENCY).toBe('TZS')
  })

  it('uses the signed-in hotel currency rather than assuming shillings', () => {
    expect(currencyCode(authWith({ currency: 'KES' }))).toBe('KES')
    expect(currencyCode(authWith({ currency: 'UGX' }))).toBe('UGX')
  })

  it('normalises a lowercase or padded code', () => {
    expect(currencyCode(authWith({ currency: 'kes' }))).toBe('KES')
    expect(currencyCode(authWith({ currency: '  rwf ' }))).toBe('RWF')
  })

  it('falls back rather than printing an unusable code', () => {
    expect(currencyCode(authWith({ currency: 'TZSX' }))).toBe('TZS')
    expect(currencyCode(authWith({ currency: '' }))).toBe('TZS')
    expect(currencyCode(authWith({ currency: 123 }))).toBe('TZS')
  })
})

describe('formatMoney', () => {
  it('renders the code and a grouped amount', () => {
    expect(formatMoney(1234.5, 2, 'KES')).toBe('KES 1,234.50')
  })

  it('never substitutes a symbol, so every hotel looks the same', () => {
    // Intl would render this as "US$1,234.50" and KES as "Ksh 1,234.50",
    // which reads inconsistently across hotels.
    expect(formatMoney(1234.5, 2, 'USD')).toBe('USD 1,234.50')
    expect(formatMoney(1234.5, 2, 'KES')).toBe('KES 1,234.50')
  })

  it('honours the decimals the caller asked for', () => {
    expect(formatMoney(1234.5, 0, 'TZS')).toBe('TZS 1,235')
    expect(formatMoney(1234.5, 2, 'TZS')).toBe('TZS 1,234.50')
  })

  it('renders a blank amount as zero instead of NaN', () => {
    expect(formatMoney(null, 2, 'KES')).toBe('KES 0.00')
    expect(formatMoney(undefined, 2, 'KES')).toBe('KES 0.00')
    expect(formatMoney('not a number', 2, 'KES')).toBe('KES 0.00')
  })

  it('accepts numeric strings from the API', () => {
    expect(formatMoney('2500', 2, 'KES')).toBe('KES 2,500.00')
  })

  it('falls back to the default when given a bad override', () => {
    expect(formatMoney(10, 2, 'nope')).toBe('TZS 10.00')
  })
})

describe('locale strings', () => {
  // FX settlement rates are quoted against shillings, and SaaS plan pricing is
  // platform billing currency, so these stay TZS on purpose.
  const INTENTIONALLY_TZS = [
    'receptionPanel.exchangeRateSubtitle',
    'receptionPanel.ratePerTzs',
    'receptionPanel.rateToTzs',
    'superadmin.priceMonthLabel',
  ]

  const flatten = (obj, path = '', out = {}) => {
    for (const [key, value] of Object.entries(obj)) {
      const next = path ? `${path}.${key}` : key
      if (value && typeof value === 'object') flatten(value, next, out)
      else out[next] = value
    }
    return out
  }

  for (const locale of ['en', 'sw']) {
    it(`${locale}.json carries no hardcoded hotel currency`, async () => {
      const flat = flatten((await import(`../locales/${locale}.json`)).default)

      const strays = Object.entries(flat)
        .filter(([, value]) => typeof value === 'string' && value.includes('TZS'))
        .map(([key]) => key)
        .filter((key) => !INTENTIONALLY_TZS.includes(key))
        .sort()

      expect(strays).toEqual([])
    })

    it(`${locale}.json uses the currency placeholder for amounts`, async () => {
      const flat = flatten((await import(`../locales/${locale}.json`)).default)

      const placeholders = Object.values(flat).filter(
        (value) => typeof value === 'string' && value.includes('{currency}')
      )

      expect(placeholders.length).toBeGreaterThan(20)
    })
  }
})

describe('useTenantCurrency', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('resolves the code from the store the component is signed into', () => {
    const auth = useAuthStore()
    auth.user = { tenant: { currency: 'KES' } }

    const { curCode, moneyAs } = useTenantCurrency()

    expect(curCode()).toBe('KES')
    expect(moneyAs(500)).toBe('KES 500.00')
  })

  it('defaults before login resolves', () => {
    const { curCode } = useTenantCurrency()
    expect(curCode()).toBe('TZS')
  })
})