import { describe, it, expect } from 'vitest'
import {
  normalizePaymentAccount,
  MOBILE_MONEY_PROVIDERS,
  ALL_PROVIDERS,
  providersFor,
  METHOD_MOBILE_MONEY,
  METHOD_BANK,
} from '@/utils/payments'

describe('payment accounts shape', () => {
  it('normalises a legacy flat account number string', () => {
    expect(normalizePaymentAccount('0754 123 456')).toEqual({ number: '0754 123 456' })
    expect(normalizePaymentAccount('')).toBeNull()
    expect(normalizePaymentAccount('   ')).toBeNull()
  })

  it('normalises the extended per-provider object shape', () => {
    expect(normalizePaymentAccount({ number: '0712 987 654', lipa_number: '4001202', name: 'MRK Grand Hotel' })).toEqual({
      number: '0712 987 654',
      lipa_number: '4001202',
      name: 'MRK Grand Hotel',
    })
  })

  it('drops blank fields and trims values', () => {
    expect(
      normalizePaymentAccount({ number: ' 0712 987 654 ', lipa_number: '', name: '   ' }),
    ).toEqual({ number: '0712 987 654' })
  })

  it('returns null for empty or invalid values', () => {
    expect(normalizePaymentAccount(null)).toBeNull()
    expect(normalizePaymentAccount(undefined)).toBeNull()
    expect(normalizePaymentAccount({})).toBeNull()
    expect(normalizePaymentAccount(42)).toBeNull()
  })

  it('lists the mobile wallets that can carry a Lipa number', () => {
    expect(MOBILE_MONEY_PROVIDERS).toEqual(['airtel_money', 'mixx_by_yas', 'halopesa', 'mpesa'])
    expect(ALL_PROVIDERS).toEqual(expect.arrayContaining(MOBILE_MONEY_PROVIDERS))
  })

  it('scopes providers to a payment method', () => {
    expect(providersFor(METHOD_MOBILE_MONEY)).toEqual(MOBILE_MONEY_PROVIDERS)
    expect(providersFor(METHOD_BANK)).toEqual(['crdb', 'nmb', 'nbc', 'other'])
    expect(providersFor('cash')).toEqual([])
  })
})