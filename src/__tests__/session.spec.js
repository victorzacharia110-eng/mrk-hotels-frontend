import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { useSessionSettingsStore } from '@/stores/sessionSettings'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api', () => ({
  authApi: {
    login: vi.fn(),
    loginPin: vi.fn(),
    logout: vi.fn().mockResolvedValue(),
    me: vi.fn(),
    changePassword: vi.fn(),
  },
}))

vi.mock('@/router', () => ({
  default: { push: vi.fn() },
}))

describe('session store', () => {
  let session
  let auth
  let settings

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    setActivePinia(createPinia())
    session = useSessionStore()
    auth = useAuthStore()
    settings = useSessionSettingsStore()
    // Simulate an authenticated user so tick() doesn't bail out.
    auth.token = 'tok'
    auth.user = { user_role: 'staff' }
    vi.useFakeTimers()
  })

  afterEach(() => {
    session.stop()
    vi.useRealTimers()
  })

  it('starts with 900 seconds remaining (default 15 minutes)', () => {
    expect(session.remaining).toBe(900)
  })

  it('uses the configured idle timeout when changed', () => {
    settings.saveSettings({ idleTimeoutMinutes: 6 })
    session.start()
    expect(session.remaining).toBe(360)
  })

  it('clamps the configured timeout between 1 and 120 minutes', () => {
    settings.saveSettings({ idleTimeoutMinutes: 500 })
    expect(settings.idleTimeoutMinutes).toBe(120)
    settings.saveSettings({ idleTimeoutMinutes: 0 })
    expect(settings.idleTimeoutMinutes).toBe(1)
  })

  it('countdown ticks every second', () => {
    session.start()

    vi.advanceTimersByTime(1000)
    expect(session.remaining).toBe(899)

    vi.advanceTimersByTime(5000)
    expect(session.remaining).toBe(894)
  })

  it('shows warning when remaining <= 60', () => {
    session.start()
    expect(session.showWarning).toBe(false)

    vi.advanceTimersByTime(841000) // 59s left
    expect(session.remaining).toBe(59)
    expect(session.showWarning).toBe(true)
  })

  it('warningSeconds is capped at 60', () => {
    session.start()
    vi.advanceTimersByTime(840000) // 60s remaining
    expect(session.warningSeconds).toBe(60)

    vi.advanceTimersByTime(30000) // 30s remaining
    expect(session.warningSeconds).toBe(30)
  })

  it('warningSeconds tracks remaining when below 60', () => {
    session.start()
    vi.advanceTimersByTime(841000) // 59s remaining
    expect(session.warningSeconds).toBe(59)
  })

  it('warningSeconds is capped at 60 even when remaining is higher', () => {
    session.start()
    vi.advanceTimersByTime(1000) // 899s remaining
    expect(session.warningSeconds).toBe(60)
  })

  it('activity resets the countdown', () => {
    session.start()
    vi.advanceTimersByTime(60000) // 840s left
    expect(session.remaining).toBe(840)

    session.activity()
    expect(session.remaining).toBe(900)
    expect(session.showWarning).toBe(false)
  })

  it('stop() clears the interval', () => {
    session.start()
    session.stop()

    vi.advanceTimersByTime(5000)
    expect(session.remaining).toBe(900)
  })

  it('terminate is called via tick reaching zero and redirects to login', async () => {
    session.start()
    // Fast-forward to zero
    vi.advanceTimersByTime(900000)

    // Give async terminate() a chance to resolve
    await vi.advanceTimersByTimeAsync(0)

    expect(auth.token).toBeNull()
    const router = (await import('@/router')).default
    expect(router.push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('does not tick when not authenticated', () => {
    auth.token = null
    auth.user = null
    session.start()

    vi.advanceTimersByTime(5000)
    expect(session.remaining).toBe(900)
  })

  it('start() is idempotent', () => {
    session.start()
    session.start() // second call should be a no-op
    vi.advanceTimersByTime(1000)
    expect(session.remaining).toBe(899)
  })

  it('activity is exposed for manual activity reporting', () => {
    expect(typeof session.activity).toBe('function')
  })

  it('returning to the page after brief absence keeps the session', () => {
    session.start()

    // Simulate 2 minutes away then coming back.
    sessionStorage.setItem('session_last_active', String(Date.now() - 120000))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(auth.token).not.toBeNull()
    expect(session.remaining).toBe(900 - 120)
  })

  it('returning to the page after exceeding the grace period terminates', async () => {
    session.start()

    // Simulate 16 minutes away then coming back.
    sessionStorage.setItem('session_last_active', String(Date.now() - 960000))
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(0)

    expect(auth.token).toBeNull()
    const router = (await import('@/router')).default
    expect(router.push).toHaveBeenCalledWith({ name: 'login' })
  })
})