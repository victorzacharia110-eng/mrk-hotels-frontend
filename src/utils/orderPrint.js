/**
 * Building the rows for an order print job.
 *
 * Receipts and kitchen tickets are printed from a dozen call sites — settle,
 * void, reprint, the waiter's panel, the cashier modal — and each of them was
 * passing the tenant's hotel_name as the document header. The letterhead a
 * hotel saves in Hotel Settings (address, phone, email, TIN, VRN) was therefore
 * saved, tested, and then never printed: the exports used it, the till did not.
 *
 * This is the one place the letterhead is resolved, so a receipt and a KOT for
 * the same order carry identical details and a future call site cannot forget.
 */

import { displayLines } from '@/utils/receipts'
import { getOfficialHeader } from '@/utils/officialHeader'

/**
 * The print rows for an order, with the hotel's saved letterhead on top.
 *
 * The letterhead is cached for the session by getOfficialHeader, so this costs
 * one request per session no matter how many times a night it is called, and a
 * hotel that renames itself invalidates the cache on save. When the lookup
 * fails it returns an empty header, and the caller-supplied `hotel` name is
 * used as the brand line so the paper still identifies where it came from.
 *
 * @param {object} order  Order (must carry items), with optional `_payment`.
 * @param {string} kind   'receipt' | 'kot'.
 * @param {object} [opts]  Passed through to the formatter, minus `letterhead`:
 *   `hotel` (brand-name fallback), `reprinted`, `closed`.
 * @returns {Promise<Array<Array<string|boolean|number>>>} The rows.
 */
export async function orderPrintLines(order, kind, opts = {}) {
  const { letterhead, ...rest } = opts
  // An explicitly passed letterhead wins, so a caller that already has the
  // details does not pay for the lookup.
  let header = letterhead
  if (!header) {
    try {
      header = await getOfficialHeader()
    } catch {
      // A receipt must print even when the settings endpoint is unreachable:
      // the guest is standing there waiting. The brand line falls back to the
      // caller's hotel name, so the paper is still identifiable.
      header = {}
    }
  }
  return displayLines(order, kind, { ...rest, letterhead: header })
}
