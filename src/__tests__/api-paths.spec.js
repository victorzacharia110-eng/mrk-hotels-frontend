import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/api/axios'
import { reservationApi, paymentApi } from '@/api'

describe('folio operations API contract', () => {
  beforeEach(() => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'put').mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts an early departure refund to /v1/reservations/{id}/folio/early-departure', async () => {
    const payload = { actual_departure_date: '2026-11-03', reason: 'Guests cut the safari short' }
    await reservationApi.folioEarlyDeparture(42, payload)
    expect(api.post).toHaveBeenCalledWith('/v1/reservations/42/folio/early-departure', payload)
  })

  it('sends the reason as null when omitted', async () => {
    await reservationApi.folioEarlyDeparture(7, { actual_departure_date: '2026-11-03' })
    expect(api.post).toHaveBeenCalledWith('/v1/reservations/7/folio/early-departure', {
      actual_departure_date: '2026-11-03',
    })
  })

  it('PUTs a payment edit to /v1/payments/{id}', async () => {
    const payload = {
      amount: 120000,
      payment_method: 'cash',
      payment_status: 'completed',
      notes: 'Corrected after re-count',
      transaction_reference: null,
    }
    await paymentApi.paymentEdit(9, payload)
    expect(api.put).toHaveBeenCalledWith('/v1/payments/9', payload)
  })
})