import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api', () => ({
  authApi: {
    login: vi.fn(),
    loginPin: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    changePassword: vi.fn(),
  },
}))

import { authApi } from '@/api'

describe('auth store', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('is not authenticated when no token exists', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('hydrates token from sessionStorage', () => {
      sessionStorage.setItem('auth_token', 'tok_123')
      const store = useAuthStore()
      expect(store.token).toBe('tok_123')
      expect(store.isAuthenticated).toBe(true)
    })

    it('clears legacy localStorage credentials on init', () => {
      localStorage.setItem('auth_token', 'legacy')
      localStorage.setItem('auth', '{"token":"old"}')
      useAuthStore()
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth')).toBeNull()
    })
  })

  describe('login', () => {
    it('stores token and user on successful login', async () => {
      const payload = { token: 'tok_abc', user: { user_role: 'receptionist', full_name: 'Jane' } }
      authApi.login.mockResolvedValue({ data: payload })

      const store = useAuthStore()
      const result = await store.login({ email: 'j@test.com', password: 'pass' })

      expect(result).toEqual(payload)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user.user_role).toBe('receptionist')
      expect(sessionStorage.getItem('auth_token')).toBe('tok_abc')
    })

    it('clears owner hotel selection on login', async () => {
      sessionStorage.setItem('owner_viewing_hotel', 'tenant_1')
      sessionStorage.setItem('owner_viewing_hotel_name', 'Grand')
      authApi.login.mockResolvedValue({ data: { token: 't', user: { user_role: 'staff' } } })

      const store = useAuthStore()
      await store.login({ email: 'a@b.com', password: 'p' })

      expect(sessionStorage.getItem('owner_viewing_hotel')).toBeNull()
      expect(sessionStorage.getItem('owner_viewing_hotel_name')).toBeNull()
    })

    it('sets mustChangePassword when flagged', async () => {
      authApi.login.mockResolvedValue({
        data: { token: 't', user: { user_role: 'staff' }, must_change_password: true },
      })

      const store = useAuthStore()
      await store.login({ email: 'a@b.com', password: 'p' })

      expect(store.mustChangePassword).toBe(true)
    })
  })

  describe('loginPin', () => {
    it('authenticates via PIN and stores the session', async () => {
      const payload = { token: 'pin_tok', user: { user_role: 'housekeeping' } }
      authApi.loginPin.mockResolvedValue({ data: payload })

      const store = useAuthStore()
      await store.loginPin({ identifier: 'staff@mrk.test', pin: '1234' })

      expect(store.isAuthenticated).toBe(true)
      expect(store.token).toBe('pin_tok')
      expect(authApi.loginPin).toHaveBeenCalledWith({ identifier: 'staff@mrk.test', pin: '1234' })
    })
  })

  describe('logout', () => {
    it('clears all auth state and sessionStorage', async () => {
      authApi.login.mockResolvedValue({
        data: { token: 't', user: { user_role: 'staff' }, permissions: ['manage_rooms'] },
      })
      const store = useAuthStore()
      await store.login({ email: 'a@b.com', password: 'p' })
      expect(store.isAuthenticated).toBe(true)

      authApi.logout.mockResolvedValue()
      await store.logout()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.permissions).toEqual([])
      expect(sessionStorage.getItem('auth_token')).toBeNull()
    })

    it('clears state even when server logout fails', async () => {
      authApi.login.mockResolvedValue({
        data: { token: 't', user: { user_role: 'staff' } },
      })
      const store = useAuthStore()
      await store.login({ email: 'a@b.com', password: 'p' })

      authApi.logout.mockRejectedValue(new Error('network'))
      await store.logout()

      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('role levels', () => {
    it('computes roleLevel from ROLE_LEVELS map', () => {
      const store = useAuthStore()
      store.user = { user_role: 'manager' }
      expect(store.roleLevel).toBe(80)
    })

    it('prefers backend role_level over local map', () => {
      const store = useAuthStore()
      store.user = { user_role: 'manager', role_level: 85 }
      expect(store.roleLevel).toBe(85)
    })

    it('returns 0 for unknown role', () => {
      const store = useAuthStore()
      store.user = { user_role: 'unknown_role' }
      expect(store.roleLevel).toBe(0)
    })

    it('isSuperadmin is true only for superadmin', () => {
      const store = useAuthStore()
      store.user = { user_role: 'superadmin' }
      expect(store.isSuperadmin).toBe(true)
      store.user = { user_role: 'manager' }
      expect(store.isSuperadmin).toBe(false)
    })

    it('canOperate is false for hotel_admin and manager', () => {
      const store = useAuthStore()
      store.user = { user_role: 'hotel_admin' }
      expect(store.canOperate).toBe(false)
      store.user = { user_role: 'manager' }
      expect(store.canOperate).toBe(false)
      store.user = { user_role: 'receptionist' }
      expect(store.canOperate).toBe(true)
    })
  })

  describe('can() and hasPermission()', () => {
    it('can() compares roleLevel against minLevel', () => {
      const store = useAuthStore()
      store.user = { user_role: 'receptionist' }
      expect(store.can(60)).toBe(true)
      expect(store.can(80)).toBe(false)
      expect(store.can(20)).toBe(true)
    })

    it('hasPermission checks the permissions array', () => {
      const store = useAuthStore()
      store.permissions = ['manage_rooms', 'manage_guests']
      expect(store.hasPermission('manage_rooms')).toBe(true)
      expect(store.hasPermission('manage_payments')).toBe(false)
    })
  })

  describe('canAccess() — module access matrix', () => {
    it('superadmin can access everything', () => {
      const store = useAuthStore()
      store.user = { user_role: 'superadmin' }
      expect(store.canAccess({ key: 'dashboard', roles: [], permission: null })).toBe(true)
      expect(store.canAccess({ key: 'staff', roles: ['hotel_admin', 'manager'], permission: null })).toBe(true)
    })

    it('receptionist can access reservations but not housekeeping', () => {
      const store = useAuthStore()
      store.user = { user_role: 'receptionist' }
      expect(store.canAccess({ key: 'reservations', roles: ['hotel_admin', 'manager', 'receptionist'], permission: null })).toBe(true)
      expect(store.canAccess({ key: 'housekeeping', roles: ['hotel_admin', 'manager', 'housekeeping'], permission: null })).toBe(false)
    })

    it('denies access when permission is missing', () => {
      const store = useAuthStore()
      store.user = { user_role: 'housekeeping' }
      store.permissions = []
      expect(store.canAccess({ key: 'laundry', roles: ['hotel_admin', 'manager', 'housekeeping'], permission: 'manage_laundry' })).toBe(false)
    })

    it('allows access when permission is held', () => {
      const store = useAuthStore()
      store.user = { user_role: 'housekeeping' }
      store.permissions = ['manage_laundry']
      expect(store.canAccess({ key: 'laundry', roles: ['hotel_admin', 'manager', 'housekeeping'], permission: 'manage_laundry' })).toBe(true)
    })

    it('owner role is treated as hotel_admin for role checks', () => {
      const store = useAuthStore()
      store.user = { user_role: 'owner' }
      // overview requires hotel_admin or manager — owner maps to hotel_admin, so allowed
      expect(store.canAccess({ key: 'overview', roles: ['hotel_admin', 'manager'], permission: null })).toBe(true)
      // housekeeping requires housekeeping role — owner maps to hotel_admin which IS in the list
      expect(store.canAccess({ key: 'housekeeping', roles: ['hotel_admin', 'manager', 'housekeeping'], permission: null })).toBe(true)
      // staff requires hotel_admin or manager — owner maps to hotel_admin, so allowed
      expect(store.canAccess({ key: 'staff', roles: ['hotel_admin', 'manager'], permission: null })).toBe(true)
    })

    it('returns false when no user is set', () => {
      const store = useAuthStore()
      expect(store.canAccess({ key: 'dashboard', roles: [], permission: null })).toBe(false)
    })
  })

  describe('fetchProfile', () => {
    it('loads user and permissions from /auth/me', async () => {
      authApi.me.mockResolvedValue({
        data: { user: { user_role: 'manager' }, permissions: ['manage_rooms'] },
      })
      const store = useAuthStore()
      store.token = 'tok'
      await store.fetchProfile()

      expect(store.user.user_role).toBe('manager')
      expect(store.permissions).toEqual(['manage_rooms'])
    })

    it('clears state when the session is genuinely expired (401/403)', async () => {
      const err = new Error('Request failed with status code 401')
      err.response = { status: 401 }
      authApi.me.mockRejectedValue(err)
      const store = useAuthStore()
      store.token = 'tok'
      store.user = { user_role: 'old' }

      await expect(store.fetchProfile()).rejects.toThrow('401')
      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
    })

    it('keeps the session on transient failures (5xx/network)', async () => {
      const err = new Error('network')
      err.response = { status: 500 }
      authApi.me.mockRejectedValue(err)
      const store = useAuthStore()
      store.token = 'tok'
      store.user = { user_role: 'old' }

      await expect(store.fetchProfile()).rejects.toThrow('network')
      expect(store.token).toBe('tok')
      expect(store.user).toEqual({ user_role: 'old' })
    })

    it('does nothing when no token exists', async () => {
      const store = useAuthStore()
      const result = await store.fetchProfile()
      expect(result).toBeUndefined()
      expect(authApi.me).not.toHaveBeenCalled()
    })
  })

  describe('changePassword', () => {
    it('clears mustChangePassword on success', async () => {
      authApi.changePassword.mockResolvedValue({ data: { message: 'Done' } })
      const store = useAuthStore()
      store.mustChangePassword = true

      await store.changePassword({ current_password: 'old', password: 'new', password_confirmation: 'new' })

      expect(store.mustChangePassword).toBe(false)
    })
  })

  describe('loading state', () => {
    it('sets loading true during login and false after', async () => {
      let resolveLogin
      authApi.login.mockImplementation(() => new Promise((r) => { resolveLogin = r }))

      const store = useAuthStore()
      const promise = store.login({ email: 'a@b.com', password: 'p' })
      expect(store.loading).toBe(true)

      resolveLogin({ data: { token: 't', user: { user_role: 'staff' } } })
      await promise
      expect(store.loading).toBe(false)
    })
  })
})
