import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fbDayCloseApi } from '@/api'

/**
 * The hotel's open business date, sourced from the F&B Day Close backend.
 *
 * When a cashier closes a business day the panels must start operating on the
 * NEXT working date instead of the wall-clock "today". This store fetches
 * GET /fnb/day-close once (which returns the tenant's `open_date` in the
 * hotel's own timezone), caches it, and falls back to the local date so every
 * panel still renders before the fetch completes or if it fails.
 */
const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const useWorkingDateStore = defineStore('workingDate', () => {
  const openDate = ref('')
  const timezone = ref('')
  const runningOrdersCount = ref(0)
  const unsettledOrdersCount = ref(0)
  const loading = ref(false)
  const loaded = ref(false)

  /** The business date every cashier/bar/inventory panel should default to. */
  const workingDate = computed(() => openDate.value || localToday())

  /** Fetches the open business date once; failures keep the local fallback. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const { data } = await fbDayCloseApi.index()
      openDate.value = data?.open_date || ''
      timezone.value = data?.timezone || ''
      runningOrdersCount.value = Number(data?.running_orders_count ?? 0)
      unsettledOrdersCount.value = Number(data?.unsettled_orders_count ?? 0)
      loaded.value = true
    } catch {
      // Keep the local-today fallback so panels always render.
    } finally {
      loading.value = false
    }
  }

  /** Force-refetches the business date (used after a Day Close succeeds). */
  async function reload() {
    loaded.value = false
    openDate.value = ''
    await ensureLoaded()
  }

  return {
    openDate,
    timezone,
    runningOrdersCount,
    unsettledOrdersCount,
    loading,
    loaded,
    workingDate,
    ensureLoaded,
    reload,
  }
})