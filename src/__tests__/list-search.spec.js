/**
 * The review asked "why does search bar for Nationality not work?" with the
 * endpoint answering correctly, and the fault was here: the box called load()
 * on every keystroke, so a term cost one request per character against a guest
 * list in the thousands, and a slow early request could land after a fast late
 * one. The last response to ARRIVE won rather than the last one TYPED, so the
 * table ended up showing a half-typed term's guests.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useListSearch } from '@/composables/useListSearch'

/** Runs the composable inside a scope so its unmount hook is exercised. */
function withScope(fn) {
  const scope = effectScope()
  const result = scope.run(fn)
  return { result, stop: () => scope.stop() }
}

/**
 * A loader that behaves like the real one: it resolves later for a shorter
 * term, and it honours the isCurrent() guard before writing.
 */
function makeLoader() {
  const shown = []
  const load = vi.fn(
    (isCurrent = () => true) =>
      new Promise((resolve) => {
        const term = TERMS[load.mock.calls.length - 1]
        setTimeout(() => {
          if (isCurrent()) shown.push(term)
          resolve()
        }, term === 'tan' ? 200 : 10)
      }),
  )
  return { load, shown }
}

let TERMS = []

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  TERMS = []
})
afterEach(() => vi.useRealTimers())

describe('useListSearch', () => {
  it('coalesces a burst of keystrokes into a single load', async () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const { result, stop } = withScope(() => useListSearch(load))
    const { runSearch } = result

    runSearch()
    runSearch()
    runSearch()
    runSearch()
    expect(load).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    await vi.runAllTimersAsync()
    expect(load).toHaveBeenCalledTimes(1)
    stop()
  })

  it('discards a slow earlier response that lands after a newer one', async () => {
    TERMS = ['tan', 'tanzania']
    const { load, shown } = makeLoader()
    const { result, stop } = withScope(() => useListSearch(load))
    const { runNow } = result

    // Issued in this order; the FIRST resolves LAST.
    const first = runNow()
    const second = runNow()
    await vi.runAllTimersAsync()
    await Promise.all([first, second])

    // Both responses arrived, but only the newer term reached the table.
    expect(shown).toEqual(['tanzania'])
    stop()
  })

  it('lets the newest request own the spinner', async () => {
    TERMS = ['tan', 'tanzania']
    const { load } = makeLoader()
    const { result, stop } = withScope(() => useListSearch(load))
    const { runNow, isLoading } = result

    const first = runNow()
    const second = runNow()
    await vi.runAllTimersAsync()
    await Promise.all([first, second])

    expect(isLoading.value).toBe(false)
    stop()
  })

  it('runNow bypasses the debounce for a discrete filter change', async () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const { result, stop } = withScope(() => useListSearch(load))
    const { runNow } = result

    await runNow()
    expect(load).toHaveBeenCalledTimes(1)
    stop()
  })

  it('clears a pending timer when the page is torn down', async () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const { result, stop } = withScope(() => useListSearch(load))

    result.runSearch()
    stop()
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()

    // Leaving the page mid-typing must not fire a request against a page that
    // is no longer on screen.
    expect(load).not.toHaveBeenCalled()
  })
})
