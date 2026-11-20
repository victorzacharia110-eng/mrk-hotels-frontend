import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  normalizePaymentAccount,
  normalizePaymentMethods,
  effectivePaymentMethods,
  normalizeCreditAccounts,
  MOBILE_MONEY_PROVIDERS,
  ALL_PROVIDERS,
  providersFor,
  METHOD_MOBILE_MONEY,
  METHOD_BANK,
} from '@/utils/payments'

describe('payment methods shape', () => {
  it('normalises built-in and custom methods without dropping labels', () => {
    expect(normalizePaymentMethods(['cash', { value: 'crypto', label: 'Crypto', description: 'Wallet' }, '  '])).toEqual([
      { value: 'cash' },
      { value: 'crypto', label: 'Crypto', description: 'Wallet' },
    ])
  })

  it('merges tenant-defined methods into the built-in options', () => {
    expect(effectivePaymentMethods([{ value: 'cash', label: 'Cash desk' }, 'evil_wallet']).map((m) => m.value)).toEqual([
      'cash',
      'mobile_money',
      'bank',
      'selcom',
      'card',
      'evil_wallet',
    ])
    expect(effectivePaymentMethods(['evil_wallet']).find((m) => m.value === 'evil_wallet')).toEqual({ value: 'evil_wallet' })
  })
})

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

describe('credit account response shape', () => {
  const accounts = [
    { credit_account_id: 'acc-1', name: 'Company A', type: 'creditor' },
    { credit_account_id: 'acc-2', name: 'Staff Meal', type: 'no_charge' },
  ]

  it('reads the registry accounts key', () => {
    expect(normalizeCreditAccounts({ accounts })).toEqual(accounts)
  })

  it('reads the settle panels credit_accounts key', () => {
    expect(normalizeCreditAccounts({ credit_accounts: accounts })).toEqual(accounts)
  })

  it('still reads the legacy data key', () => {
    expect(normalizeCreditAccounts({ data: accounts })).toEqual(accounts)
  })

  it('returns an empty list for malformed responses', () => {
    expect(normalizeCreditAccounts(null)).toEqual([])
    expect(normalizeCreditAccounts({ accounts: null })).toEqual([])
  })
})

describe('cashier and bartender settlement screens', () => {
  const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
  const summary = read('src/pages/cashier/CashierOrderSummaryPage.vue')
  const dashboard = read('src/pages/dashboards/OrderTakerDashboard.vue')
  const lookup = read('src/pages/cashier/CashierAccountLookupPage.vue')

  it('normalises the credit account response in every settle surface', () => {
    expect(summary).toContain('normalizeCreditAccounts(data)')
    expect(dashboard).toContain('normalizeCreditAccounts(data)')
    expect(lookup).toContain('normalizeCreditAccounts(data)')
  })

  it('keeps creditor and no-charge settlement sections in the order summary', () => {
    expect(summary).toContain("switchMode('creditor')")
    expect(summary).toContain("switchMode('nocharge')")
    expect(summary).toContain('confirmAccountSettle()')
  })

  it('lets management register creditor and no-charge settle accounts', () => {
    expect(lookup).toContain("const settleAccountTypes = ['creditor', 'no_charge']")
    expect(lookup).toContain('v-model="noChargeForm.type"')
    expect(lookup).toContain('creditAccountApi.store(noChargeForm.value)')
  })
})
