import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/api/axios'
import { paymentApi } from '@/api'

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