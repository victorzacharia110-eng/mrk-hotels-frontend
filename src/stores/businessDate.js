import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { businessDateApi } from '@/api'

/**
 * The hotel-wide open business date, anchored to the night audit.
 *
 * The reception board must show the day the hotel is OPERATING on, not the
 * browser's wall clock: a hotel that has not yet run night audit is still on
 * yesterday, and a browser in another timezone would read the wrong day.
 * GET /business-date returns the day after the last closed night audit,
 * auto-advanced through idle days but never past a day that still holds a
 * guest or a transaction. Falls back to the local date so the board renders
 * before the fetch lands or if it fails.
 */
const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** The hotel's calendar day, resolved in the hotel's own timezone. */
const dateInTimezone = (timezone) => {
  if (!timezone) return localToday()
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const pick = (type) => parts.find((part) => part.type === type)?.value
    return `${pick('year')}-${pick('month')}-${pick('day')}`
  } catch {
    return localToday()
  }
}

export const useBusinessDateStore = defineStore('businessDate', () => {
  const businessDate = ref('')
  const today = ref('')
  const timezone = ref('')
  const latestClosedDate = ref('')
  const autoAdvanced = ref(false)
  const loading = ref(false)
  const loaded = ref(false)

  /** The date the reception board should treat as "today". */
  const current = computed(() => businessDate.value || today.value || localToday())

  /** The hotel's calendar day in its own timezone. */
  const calendarToday = computed(() => today.value || dateInTimezone(timezone.value))

  /** True when the business date lags the wall clock (night audit is due). */
  const auditDue = computed(
    () => Boolean(businessDate.value) && businessDate.value < calendarToday.value,
  )

  /** Fetches the business date once; failures keep the local fallback. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const { data } = await businessDateApi.show()
      businessDate.value = data?.business_date || ''
      today.value = data?.today || ''
      timezone.value = data?.timezone || ''
      latestClosedDate.value = data?.latest_closed_date || ''
      autoAdvanced.value = Boolean(data?.auto_advanced)
      loaded.value = true
    } catch {
      // Keep the local-date fallback so the board always renders.
    } finally {
      loading.value = false
    }
  }

  /**
   * Force-refetches the business date (used after a night audit close).
   *
   * The previous date stays on screen while the fetch is in flight. Clearing
   * it first — as this did — made `current` fall back to the calendar/wall
   * clock for the duration of the request, so on the dashboard's 30-second
   * refresh loop the stay-view bars (purple = checking out on the business
   * date, green = otherwise in-house) flashed between two colours every cycle,
   * and a single failed refetch left the wrong date showing until a later one
   * succeeded.
   */
  async function reload() {
    loaded.value = false
    await ensureLoaded()
  }

  return {
    businessDate,
    today,
    timezone,
    latestClosedDate,
    autoAdvanced,
    loading,
    loaded,
    current,
    calendarToday,
    auditDue,
    ensureLoaded,
    reload,
  }
})
