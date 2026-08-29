/**
 * Auth store: session token, current user, permissions and access checks.
 *
 * The token lives in sessionStorage: a refresh keeps the session (the router
 * guard re-fetches the user profile and permissions from /auth/me), while
 * closing the tab ends it. Credentials left behind in localStorage by older
 * builds are cleared once when the store is created.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

// Numeric seniority per role; `can(level)` checks against these.
const ROLE_LEVELS = {
  superadmin: 100,
  hotel_admin: 90,
  manager: 80,
  accountant: 70,
  receptionist: 60,
  store_manager: 55,
  procurement_officer: 50,
  housekeeping: 40,
  kitchen: 40,
  waiter: 30,
  bartender: 30,
  staff: 20,
}

// Central auth store: session token, current user and role-based access checks.
export const useAuthStore = defineStore('auth', () => {
  // Currently signed-in user object (or null when logged out).
  const user = ref(null)
  // API token, hydrated from sessionStorage so a refresh keeps the session
  // while a closed tab ends it.
  const token = ref(sessionStorage.getItem('auth_token') || null)
  // One-time cleanup of credentials stored in localStorage by older builds
  // (the raw token plus the pinia-plugin-persistedstate snapshot).
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth')
  // Flat list of backend permissions granted to the user.
  const permissions = ref([])
  // True while a login/profile fetch is in flight.
  const loading = ref(false)
  // Flag forcing the user to reset their password before continuing.
  const mustChangePassword = ref(false)

  /** True while a session token exists. */
  const isAuthenticated = computed(() => !!token.value)
  /** True for the platform superadmin. */
  const isSuperadmin = computed(() => user.value?.user_role === 'superadmin')
  /** True for a hotel's own administrator. */
  const isHotelAdmin = computed(() => user.value?.user_role === 'hotel_admin')
  /** Seniority of the user's role; prefers the backend's level over the local map. */
  const roleLevel = computed(() => user.value?.role_level ?? ROLE_LEVELS[user.value?.user_role] ?? 0)
  // False for management roles, who observe rather than operate the front desk.
  const canOperate = computed(() => !['hotel_admin', 'manager'].includes(user.value?.user_role))

  /**
   * Stores the login payload and persists the token.
   * @param {object} payload - Response from /auth/login or /auth/me.
   */
  function applyAuth(payload) {
    token.value = payload.token
    user.value = payload.user
    mustChangePassword.value = payload.must_change_password || false
    permissions.value = payload.permissions || user.value?.permissions || []
    sessionStorage.setItem('auth_token', payload.token)
  }

  /**
   * Authenticates with the backend and stores the returned session.
   * @param {object} data - Login credentials (email, password).
   * @returns {Promise<object>} The login response payload.
   */
  async function login(data) {
    loading.value = true
    try {
      const response = await authApi.login(data)
      // A fresh login must not inherit an owner's previously selected hotel.
      sessionStorage.removeItem('owner_viewing_hotel')
      sessionStorage.removeItem('owner_viewing_hotel_name')
      applyAuth(response.data)
      return response.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Authenticates with a 4-digit staff PIN and stores the returned session.
   * Mirrors login(); the identifier may be the user's username (email) or
   * their registration number and the response shape is identical to /auth/login.
   * @param {object} data - PIN login credentials (identifier, pin).
   * @returns {Promise<object>} The login response payload.
   */
  async function loginPin(data) {
    loading.value = true
    try {
      const response = await authApi.loginPin(data)
      // A fresh login must not inherit an owner's previously selected hotel.
      sessionStorage.removeItem('owner_viewing_hotel')
      sessionStorage.removeItem('owner_viewing_hotel_name')
      applyAuth(response.data)
      return response.data
    } finally {
      loading.value = false
    }
  }

  /**
   * Ends the session server-side and wipes all local auth state.
   * The API call is best-effort: an expired/revoked token (401) or a network
   * failure must not block the client-side logout.
   * @returns {Promise<void>}
   */
  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // Server session already gone (401) or unreachable — ignore, logout locally.
    } finally {
      token.value = null
      user.value = null
      permissions.value = []
      mustChangePassword.value = false
      sessionStorage.removeItem('auth_token')
      // Drop the owner's selected hotel on logout as well.
      sessionStorage.removeItem('owner_viewing_hotel')
      sessionStorage.removeItem('owner_viewing_hotel_name')
    }
  }

  /**
   * Reloads the user + permissions from /auth/me.
   * @returns {Promise<object|undefined>} The refreshed user, or undefined when not authenticated.
   */
  async function fetchProfile() {
    if (!token.value) return
    loading.value = true
    try {
      const response = await authApi.me()
      user.value = response.data.user
      permissions.value = response.data.permissions || []
      mustChangePassword.value = false
      return user.value
    } catch (error) {
      // A genuinely expired/revoked session is hard-cleared so the router guard
      // can bounce to /login; transient failures (5xx, network blips) keep the
      // session intact and let the guard retry instead of logging the user out.
      const status = error?.response?.status
      if (status === 401 || status === 403) {
        token.value = null
        user.value = null
        permissions.value = []
        mustChangePassword.value = false
        sessionStorage.removeItem('auth_token')
      }
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * True when the user's role level is at least the given minimum.
   * @param {number} minLevel - Minimum role level to satisfy.
   * @returns {boolean}
   */
  function can(minLevel) {
    return roleLevel.value >= minLevel
  }

  /**
   * True when the user holds the given backend permission.
   * @param {string} name - Permission key, e.g. 'manage_laundry'.
   * @returns {boolean}
   */
  function hasPermission(name) {
    return permissions.value.includes(name)
  }

  /**
   * Role-based module access. A module is reachable when the user's role is in
   * its allow-list (an empty list means everyone) and any required permission
   * is held. Superadmin bypasses the lists.
   * @param {object} module - Module config from @/config/modules.
   * @returns {boolean}
   */
  function canAccess(module) {
    // Owners browse a hotel's panel with hotel_admin-level visibility.
    const role = user.value?.user_role === 'owner' ? 'hotel_admin' : user.value?.user_role
    if (!role) return false
    if (role === 'superadmin') return true
    if (module.roles.length && !module.roles.includes(role)) return false
    if (module.permission && !hasPermission(module.permission)) return false
    return true
  }

  /**
   * Changes the current user's password and clears the forced-change flag.
   * @param {object} data - Current + new password fields.
   * @returns {Promise<object>} The change-password response payload.
   */
  async function changePassword(data) {
    const response = await authApi.changePassword(data)
    mustChangePassword.value = false
    return response.data
  }

  return {
    user,
    token,
    permissions,
    loading,
    mustChangePassword,
    isAuthenticated,
    isSuperadmin,
    isHotelAdmin,
    roleLevel,
    canOperate,
    login,
    loginPin,
    logout,
    fetchProfile,
    changePassword,
    can,
    canAccess,
    hasPermission,
  }
})
