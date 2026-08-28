/**
 * Shared channel-distribution panel state.
 *
 * The Auto Stopsell drawer can be opened from two places — the staff drawer's
 * Distribution accordion and the Channel Logs page's toolbar — so the open
 * state lives here at module scope and both consumers stay in sync.
 */
import { readonly, ref } from 'vue'

const stopsellOpen = ref(false)

/**
 * {@link stopsellOpen} (read-only), {@link openStopsell} and {@link closeStopsell}.
 */
export function useDistribution() {
  function openStopsell() {
    stopsellOpen.value = true
  }

  function closeStopsell() {
    stopsellOpen.value = false
  }

  return { stopsellOpen: readonly(stopsellOpen), openStopsell, closeStopsell }
}