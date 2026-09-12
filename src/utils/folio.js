/**
 * Folio reading helpers shared by the stay-view Folio Operations panel and its
 * invoice print breakdown. Kept pure so unit tests can assert the real numbers
 * the front desk sees (room charges / advance / early-departure refund /
 * balance) without mounting the dashboard.
 */

/** True when a persisted folio entry is an early-departure refund line. */
export function isFolioRefundEntry(type) {
  const raw = String(type || '')
  return raw.includes('refund') || raw.includes('early_departure')
}

/**
 * Builds the invoice breakdown numbers for a folio payload (the same shape
 * `reservationApi.folio()` returns — folio / reservation / orders / laundry /
 * folio_entries / payments / related_folios).
 *
 * - roomCharges: total room charges (rate nights + incidental charges)
 * - paid: advance / amounts already paid
 * - refund: early-departure refund (0 when the stay has none)
 * - net: roomCharges - paid - refund (what the guest still owes)
 */
export function folioBreakdown(payload) {
  const fol = payload?.folio || {}
  const res = payload?.reservation || {}
  const roomCharges = Number(fol.total_amount ?? 0) + Number(fol.room_charges ?? 0)
  const paid = Number(res.advance_payment ?? fol.advance_payment ?? fol.paid_amount ?? 0)
  let refund = 0
  for (const e of payload?.folio_entries || []) {
    if (isFolioRefundEntry(e.type)) {
      refund += Math.abs(Number(e.amount ?? 0))
    }
  }
  if (refund === 0) {
    const netRefund = Number(fol.refund_amount ?? 0)
    if (netRefund > 0) refund = netRefund
  }
  return {
    roomCharges,
    paid,
    refund,
    net: roomCharges - paid - refund,
  }
}