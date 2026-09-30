import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/api/axios'
import { paymentApi, roomApi } from '@/api'

describe('folio operations API contract', () => {
  beforeEach(() => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'put').mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

describe('stop-sell window is actually sent', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { blocks: [] } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes the calendar window as query params', async () => {
    // The stop-sell listing used to ignore its arguments and ask for every
    // block ever recorded. That request 500s in production, so the Rooms
    // screen came up blank while the page believed it had sent a window.
    await roomApi.stopSell({ from_date: '2026-10-01', to_date: '2026-10-14' })

    expect(api.get).toHaveBeenCalledWith('/v1/rooms/stop-sell', {
      params: { from_date: '2026-10-01', to_date: '2026-10-14' },
    })
  })

  it('still asks for a plain list when no window is given', () => {
    // Callers that genuinely want everything keep working; they just send an
    // empty params object rather than silently dropping the argument.
    roomApi.stopSell()
    expect(api.get).toHaveBeenCalledWith('/v1/rooms/stop-sell', { params: {} })
  })
})
