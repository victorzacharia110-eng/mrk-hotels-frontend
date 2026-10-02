/**
 * Tenant-aware money formatting.
 *
 * Amounts used to carry a literal "TZS" prefix in templates, which printed
 * Tanzanian shillings on every hotel's screens. MRK is one tenant on this
 * platform, so its currency is not the platform's. The backend now sends
 * `tenant.currency` (ISO 4217) on the login payload and on /auth/me, and these
 * helpers render whatever code the signed-in hotel bills in.
 *
 * The helpers deliberately add the code separately from the number rather than
 * letting Intl substitute a symbol, so every hotel renders the same
 * "KES 1,234.00" shape instead of some showing "$" and others a local
 * abbreviation.
 */

import { useAuthStore } from '@/stores/auth'

/** Used when no tenant is loaded or the code is unusable, matching the API. */
export const DEFAULT_CURRENCY = 'TZS'

const ISO_CODE = /^[A-Z]{3}$/

/**
 * The signed-in hotel's ISO 4217 code.
 *
 * Falls back to the platform default before login resolves, and for platform
 * screens (superadmin/owner) that have no single hotel in context.
 */
export function currencyCode(auth) {
  const raw = auth?.user?.tenant?.currency
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''

  return ISO_CODE.test(code) ? code : DEFAULT_CURRENCY
}

/**
 * Formats an amount in the signed-in hotel's currency.
 *
 * @param {number|string|null} value
 * @param {number} decimals Pass 0 where the previous number formatting used none.
 * @param {string} code Override, for a screen showing another hotel's money.
 */
export function formatMoney(value, decimals = 2, code = null) {
  const resolved = (typeof code === 'string' ? code.trim().toUpperCase() : '') || DEFAULT_CURRENCY
  const safe = ISO_CODE.test(resolved) ? resolved : DEFAULT_CURRENCY
  const amount = Number(value)

  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(amount) ? amount : 0)

  return `${safe} ${formatted}`
}

/**
 * Money helpers for a component's template.
 *
 * Resolving the store once in setup keeps `curCode()` reactive to a login that
 * finishes after the page rendered, and keeps the lookup correct in tests,
 * which mount components without the app entry point.
 */
export function useTenantCurrency() {
  const auth = useAuthStore()

  return {
    curCode: () => currencyCode(auth),
    moneyAs: (value, decimals = 2) => formatMoney(value, decimals, currencyCode(auth)),
  }
}