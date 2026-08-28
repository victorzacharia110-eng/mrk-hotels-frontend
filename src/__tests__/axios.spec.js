import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('axios interceptors', () => {
  let api

  beforeEach(async () => {
    sessionStorage.clear()
    vi.resetModules()
    const mod = await import('@/api/axios')
    api = mod.default
  })

  describe('request interceptor', () => {
    it('adds Authorization header when token exists', () => {
      sessionStorage.setItem('auth_token', 'tok_test')
      const config = { headers: {} }
      const result = api.interceptors.request.handlers[0].fulfilled(config)
      expect(result.headers.Authorization).toBe('Bearer tok_test')
    })

    it('adds X-Tenant-ID when owner is viewing a hotel', () => {
      sessionStorage.setItem('owner_viewing_hotel', 'tenant_abc')
      const config = { headers: {} }
      const result = api.interceptors.request.handlers[0].fulfilled(config)
      expect(result.headers['X-Tenant-ID']).toBe('tenant_abc')
    })

    it('removes Content-Type for FormData uploads', () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test']), 'test.jpg')
      const config = { headers: { 'Content-Type': 'multipart/form-data' }, data: formData }
      const result = api.interceptors.request.handlers[0].fulfilled(config)
      expect(result.headers['Content-Type']).toBeUndefined()
    })

    it('does not add Authorization when no token', () => {
      const config = { headers: {} }
      const result = api.interceptors.request.handlers[0].fulfilled(config)
      expect(result.headers.Authorization).toBeUndefined()
    })
  })

  describe('response interceptor — success', () => {
    it('flattens Laravel pagination metadata', () => {
      const response = {
        data: {
          data: [{ id: 1 }, { id: 2 }],
          meta: { current_page: 1, last_page: 5, per_page: 15, total: 75 },
          links: { first: '/rooms?page=1', last: '/rooms?page=5', prev: null, next: '/rooms?page=2' },
        },
      }
      const result = api.interceptors.response.handlers[0].fulfilled(response)
      expect(result.data.current_page).toBe(1)
      expect(result.data.last_page).toBe(5)
      expect(result.data.total).toBe(75)
      expect(result.data.first_page_url).toBe('/rooms?page=1')
      expect(result.data.next_page_url).toBe('/rooms?page=2')
    })

    it('passes non-paginated responses through unchanged', () => {
      const response = { data: { message: 'ok', user: { id: 1 } } }
      const result = api.interceptors.response.handlers[0].fulfilled(response)
      expect(result.data.message).toBe('ok')
    })
  })

  describe('response interceptor — error', () => {
    /** Builds an axios-shaped rejection error with the given HTTP status. */
    const rejection = (status) =>
      Object.assign(new Error(`HTTP ${status}`), { response: { status } })

    it('clears token and sets location on 401 when token exists', async () => {
      sessionStorage.setItem('auth_token', 'expired_tok')
      const handler = api.interceptors.response.handlers[0]
      const reject = handler.rejected
      expect(reject).toBeDefined()

      await expect(reject(rejection(401))).rejects.toThrow('HTTP 401')
      expect(sessionStorage.getItem('auth_token')).toBeNull()
    })

    it('does not clear token on non-401 error', async () => {
      sessionStorage.setItem('auth_token', 'valid_tok')
      const handler = api.interceptors.response.handlers[0]
      await expect(handler.rejected(rejection(500))).rejects.toThrow('HTTP 500')
      expect(sessionStorage.getItem('auth_token')).toBe('valid_tok')
    })

    it('does not clear token on 401 when no token (public request)', async () => {
      const handler = api.interceptors.response.handlers[0]
      await expect(handler.rejected(rejection(401))).rejects.toThrow('HTTP 401')
      expect(sessionStorage.getItem('auth_token')).toBeNull()
    })
  })
})
