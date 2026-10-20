import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The stale-bundle guard. A till keeps a tab open across deploys; if it keeps
 * running an old bundle, QZ Tray ends up with the wrong signing certificate.
 * These pin the contract: compare against the deployed /version.json and reload
 * only when stale and safe.
 */

vi.mock('@/version.json', () => ({ default: { version: '1.0.100' } }))

const originalLocation = window.location
let replaceSpy

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  replaceSpy = vi.fn()
  // jsdom's location is read-only; shadow what we need.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: 'https://mrk-hotels.com/pos', replace: replaceSpy },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

function mockFetch(version, { ok = true } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(version ? { version } : {}),
    }),
  )
}

describe('versionCheck', () => {
  it('exposes the version baked into the running bundle', async () => {
    const mod = await import('@/utils/versionCheck')
    expect(mod.runningVersion).toBe('1.0.100')
  })

  it('does nothing when the deployed version matches the running one', async () => {
    mockFetch('1.0.100')
    const mod = await import('@/utils/versionCheck')

    await expect(mod.checkForUpdate()).resolves.toBe(false)
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(mod.updateAvailable.value).toBe(false)
  })

  it('reloads with a cache-buster when a newer deploy is live', async () => {
    mockFetch('1.0.101')
    const mod = await import('@/utils/versionCheck')

    await expect(mod.checkForUpdate()).resolves.toBe(true)
    expect(replaceSpy).toHaveBeenCalledOnce()
    const url = replaceSpy.mock.calls[0][0]
    expect(url).toContain('_v=1.0.101')
    expect(mod.updateAvailable.value).toBe(true)
  })

  it('does not reload mid-print but keeps the update pending', async () => {
    mockFetch('1.0.101')
    const mod = await import('@/utils/versionCheck')
    mod.watchForUpdates({ isSafeToReload: () => false })

    await vi.waitFor(() => expect(mod.updateAvailable.value).toBe(true))
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('treats an unreadable version file as no update (offline is not stale)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const mod = await import('@/utils/versionCheck')

    await expect(mod.checkForUpdate()).resolves.toBe(false)
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('treats a malformed version payload as no update', async () => {
    mockFetch('')
    const mod = await import('@/utils/versionCheck')

    await expect(mod.checkForUpdate()).resolves.toBe(false)
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('only starts the watcher once', async () => {
    mockFetch('1.0.100')
    const mod = await import('@/utils/versionCheck')
    const addSpy = vi.spyOn(document, 'addEventListener')

    mod.watchForUpdates()
    mod.watchForUpdates()

    expect(addSpy.mock.calls.filter(([e]) => e === 'visibilitychange')).toHaveLength(1)
    addSpy.mockRestore()
  })
})
