/**
 * Payment vocabulary, mirroring app/Support/PaymentOptions.php on the backend.
 *
 * A payment is a method plus, for mobile money and banks, a provider. The
 * status a payment starts in is decided by the method, so the form can tell the
 * receptionist what will happen before they submit.
 */

// Payment method keys, mirroring the backend's PaymentOptions enum.
export const METHOD_CASH = 'cash'
export const METHOD_MOBILE_MONEY = 'mobile_money'
export const METHOD_BANK = 'bank'
export const METHOD_SELCOM = 'selcom'
export const METHOD_CARD = 'card'
export const METHOD_CLICKPESA = 'clickpesa'

/** Methods a receptionist can pick, in the order they appear in the form. */
export const PAYMENT_METHODS = [
  METHOD_CASH,
  METHOD_MOBILE_MONEY,
  METHOD_BANK,
  METHOD_SELCOM,
  METHOD_CARD,
]

/** Mobile money wallets the hotel accepts. */
export const MOBILE_MONEY_PROVIDERS = ['airtel_money', 'mixx_by_yas', 'halopesa', 'mpesa']

/** Banks the hotel holds accounts with. */
export const BANK_PROVIDERS = ['crdb', 'nmb', 'nbc', 'other']

/** All providers a hotel can receive money into, for which an account exists. */
export const ALL_PROVIDERS = [...MOBILE_MONEY_PROVIDERS, ...BANK_PROVIDERS]

/** Local provider logos, bundled so the app never depends on a hotlink. */
import mpesaLogo from '@/assets/logos/providers/mpesa.png'
import airtelMoneyLogo from '@/assets/logos/providers/airtel_money.png'
import mixxByYasLogo from '@/assets/logos/providers/mixx_by_yas.png'
import halopesaLogo from '@/assets/logos/providers/halopesa.png'
import crdbLogo from '@/assets/logos/providers/crdb.png'
import nmbLogo from '@/assets/logos/providers/nmb.png'

/**
 * Brand imagery per provider. `logo` is the bundled image; `color` is the
 * fallback tile used when a provider has no logo (e.g. NBC, "other").
 */
export const PROVIDERS = {
  mpesa: { logo: mpesaLogo, color: '#EC1C24' },
  airtel_money: { logo: airtelMoneyLogo, color: '#E40000' },
  mixx_by_yas: { logo: mixxByYasLogo, color: '#FFD100' },
  halopesa: { logo: halopesaLogo, color: '#00A650' },
  crdb: { logo: crdbLogo, color: '#0072BC' },
  nmb: { logo: nmbLogo, color: '#003580' },
  nbc: { logo: null, color: '#009A44' },
  other: { logo: null, color: '#6B7280' },
}

// Lifecycle states a payment moves through.
export const STATUS_AWAITING_CONFIRMATION = 'awaiting_confirmation'
export const STATUS_PENDING = 'pending'
export const STATUS_COMPLETED = 'completed'
export const STATUS_FAILED = 'failed'
export const STATUS_REFUNDED = 'refunded'

export const PAYMENT_STATUSES = [
  STATUS_PENDING,
  STATUS_AWAITING_CONFIRMATION,
  STATUS_COMPLETED,
  STATUS_FAILED,
  STATUS_REFUNDED,
]

/** Providers valid for a method; empty when the method has none. */
export function providersFor(method) {
  if (method === METHOD_MOBILE_MONEY) return MOBILE_MONEY_PROVIDERS
  if (method === METHOD_BANK) return BANK_PROVIDERS
  return []
}

/** True when the method needs a provider chosen before it can be saved. */
export function requiresProvider(method) {
  return method === METHOD_MOBILE_MONEY || method === METHOD_BANK
}

/**
 * True when a receptionist must verify the transfer before it is credited.
 * Mobile money is pushed by the guest from their own handset.
 */
export function requiresConfirmation(method) {
  return method === METHOD_MOBILE_MONEY
}

/** True when the gateway settles the payment, so it is paid on entry. */
export function isAutoPaid(method) {
  return method === METHOD_SELCOM
}

/** The status a payment will start in for a given method. */
export function initialStatus(method) {
  if (isAutoPaid(method)) return STATUS_COMPLETED
  if (requiresConfirmation(method)) return STATUS_AWAITING_CONFIRMATION
  if (method === METHOD_CLICKPESA) return STATUS_PENDING
  return STATUS_COMPLETED
}

/** Badge class for a payment status, matching the classes in base.css. */
export function statusBadge(status) {
  return (
    {
      [STATUS_COMPLETED]: 'badge-green',
      [STATUS_AWAITING_CONFIRMATION]: 'badge-yellow',
      [STATUS_PENDING]: 'badge-blue',
      [STATUS_FAILED]: 'badge-red',
      [STATUS_REFUNDED]: 'badge-gray',
    }[status] || 'badge-gray'
  )
}
