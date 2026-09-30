/**
 * Debounced, race-safe list searching for the back-office list pages.
 *
 * The guest page's nationality box is meant to behave as a search bar, and was
 * reported as "not working" even though the endpoint was correct. The cause was
 * on this side of the wire: the input called `load()` on every keystroke, so
 * typing a term issued one request per character against a list of thousands.
 * Nothing stopped a slow early request from landing after a fast late one, and
 * the last response to *arrive* won rather than the last one *typed* — leaving
 * the table showing the guests for a half-typed term. A spinner that flickers
 * and a list that contradicts what was typed read exactly like a broken search.
 *
 * Two things are needed, and neither alone is enough:
 *   - a debounce, so a burst of keystrokes costs one request; and
 *   - a sequence guard, so only the newest response is applied. The debounce
 *     reduces the window but cannot close it, because a request already in
 *     flight when the next one is issued can still resolve out of order.
 *
 * @example
 *   const { search, runSearch } = useListSearch(load)
 *   // <input v-model="search" @input="runSearch" />
 */
import { onScopeDispose, ref } from 'vue'

/**
 * @param {Function} load  Loads the list. It is called with an `isCurrent()`
 *   predicate and MUST check it before writing any state, because the loader
 *   owns the results. A loader that ignores the argument still works, it just
 *   keeps the old last-response-wins behaviour.
 * @param {object} [opts]
 * @param {number} [opts.delay]  Quiet period after the last keystroke, in ms.
 * @returns {{ runSearch: () => void, runNow: () => Promise<void>,
 *   isLoading: import('vue').Ref<boolean> }}
 *   `runSearch` is the @input handler, `runNow` bypasses the delay for an
 *   explicit filter change, and `isLoading` reflects only the newest request.
 */
export function useListSearch(load, { delay = 300 } = {}) {
  const isLoading = ref(false)

  let timer = null
  // Bumped on every request. A response only counts when its number is still
  // the newest, so a slow earlier request cannot overwrite a newer result.
  let seq = 0

  /**
   * Runs the loader as the newest request.
   * @returns {Promise<void>}
   */
  async function run() {
    const mine = ++seq
    const isCurrent = () => mine === seq
    isLoading.value = true
    try {
      await load(isCurrent)
    } finally {
      // Only the newest request owns the spinner: letting a superseded request
      // clear it would hide that newer work is still going.
      if (isCurrent()) isLoading.value = false
    }
  }

  function runSearch() {
    clearTimeout(timer)
    timer = setTimeout(run, delay)
  }

  /** Runs immediately, for a select change or a click rather than typing. */
  function runNow() {
    clearTimeout(timer)
    return run()
  }

  // onScopeDispose rather than onBeforeUnmount: this cancels whether the owner is
  // a component being unmounted or a surrounding effect scope being torn down.
  onScopeDispose(() => clearTimeout(timer))

  return { runSearch, runNow, isLoading }
}
