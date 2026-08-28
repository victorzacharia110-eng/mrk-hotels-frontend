import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
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

  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
    session = useSessionStore()
    auth = useAuthStore()
    // Simulate an authenticated user so tick() doesn't bail out.
    auth.token = 'tok'
    auth.user = { user_role: 'staff' }
    vi.useFakeTimers()
  })

  afterEach(() => {
    session.stop()
    vi.useRealTimers()
  })

  it('starts with 300 seconds remaining', () => {
    expect(session.remaining).toBe(300)
  })

  it('countdown ticks every second', () => {
    session.start()

    vi.advanceTimersByTime(1000)
    expect(session.remaining).toBe(299)

    vi.advanceTimersByTime(5000)
    expect(session.remaining).toBe(294)
  })

  it('shows warning when remaining <= 60', () => {
    session.start()
    expect(session.showWarning).toBe(false)

    vi.advanceTimersByTime(241000) // 59s left
    expect(session.remaining).toBe(59)
    expect(session.showWarning).toBe(true)
  })

  it('warningSeconds is capped at 60', () => {
    session.start()
    vi.advanceTimersByTime(240000) // 60s remaining
    expect(session.warningSeconds).toBe(60)

    vi.advanceTimersByTime(30000) // 30s remaining
    expect(session.warningSeconds).toBe(30)
  })

  it('warningSeconds tracks remaining when below 60', () => {
    session.start()
    vi.advanceTimersByTime(241000) // 59s remaining
    expect(session.warningSeconds).toBe(59)
  })

  it('warningSeconds is capped at 60 even when remaining is higher', () => {
    session.start()
    vi.advanceTimersByTime(1000) // 299s remaining
    expect(session.warningSeconds).toBe(60)
  })

  it('activity resets the countdown', () => {
    session.start()
    vi.advanceTimersByTime(60000) // 240s left
    expect(session.remaining).toBe(240)

    session.activity()
    expect(session.remaining).toBe(300)
    expect(session.showWarning).toBe(false)
  })

  it('stop() clears the interval', () => {
    session.start()
    session.stop()

    vi.advanceTimersByTime(5000)
    expect(session.remaining).toBe(300)
  })

  it('terminate is called via tick reaching zero and redirects to login', async () => {
    session.start()
    // Fast-forward to zero
    vi.advanceTimersByTime(300000)

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
    expect(session.remaining).toBe(300)
  })

  it('start() is idempotent', () => {
    session.start()
    session.start() // second call should be a no-op
    vi.advanceTimersByTime(1000)
    expect(session.remaining).toBe(299)
  })

  it('activity is exposed for manual activity reporting', () => {
    expect(typeof session.activity).toBe('function')
  })
})
